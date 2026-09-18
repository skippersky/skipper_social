<script setup lang="ts">
/**
 * Workflow detail (Sprint 12).
 *
 * A read-only page for one saved workflow: lifecycle facts, the graph summary,
 * the structure rendered through the same canvas component in readonly mode and
 * the five most recent runs. Mutations are limited to the lifecycle actions the
 * list page already offers, so there is exactly one path into the builder.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import WorkflowCanvas from '../../../components/workflow/WorkflowCanvas.vue';
import { useWorkflow } from '../../../composables/useWorkflow';
import { useWorkflowBuilder } from '../../../composables/useWorkflowBuilder';
import { useWorkflowMonitor } from '../../../composables/useWorkflowMonitor';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { labelKeyFor, triggerOf } from '../../../lib/workflowGraph';
import { relativeTime } from '../../../lib/relativeTime';
import type { WorkflowRun } from '../../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('workflow.detail.metaTitle'), i18n.t('workflow.detail.metaDescription'));

const {
  detail,
  summary,
  loading,
  saving,
  error,
  open,
  enableWorkflow,
  disableWorkflow,
  duplicateWorkflow,
  deleteWorkflow
} = useWorkflow();

/* Local validation only: the detail page never overwrites the builder canvas. */
const { validateLocal } = useWorkflowBuilder();

const { runs, setWorkflowScope, loadRuns, durationOf } = useWorkflowMonitor();

const isMobile = ref(false);
const variant = computed<'graph' | 'list'>(() => (isMobile.value ? 'list' : 'graph'));

const workflowId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));

const triggerNode = computed(() => (detail.value ? triggerOf(detail.value.definition) : null));

const triggerLabel = computed(() =>
  triggerNode.value ? i18n.t(labelKeyFor(triggerNode.value)) : '-'
);

/** Five rows is what the spec asks for; the rest live on the runs page. */
const recentRuns = computed<WorkflowRun[]>(() => runs.value.slice(0, 5));

const stats = computed(() =>
  summary.value ?? { nodes: 0, edges: 0, triggers: 0, conditions: 0, actions: 0, depth: 0 }
);

function syncViewport(): void {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 1024;
}

function when(ts: number | null): string {
  if (ts === null) return '-';
  return relativeTime(ts, Date.now(), i18n.locale);
}

function clock(ts: number | null): string {
  return ts === null ? '-' : new Date(ts).toLocaleString();
}

function duration(run: WorkflowRun): string {
  return run.status === 'running'
    ? i18n.t('workflow.runDetail.stillRunning')
    : durationOf(run.durationMs, i18n.locale);
}

function runLabel(run: WorkflowRun): string {
  return i18n.t('workflow.runStatus.' + run.status);
}

async function onEnable(): Promise<void> {
  const next = await enableWorkflow(workflowId.value);
  if (next) showToast(i18n.t('workflow.detail.enabledToast'));
}

async function onDisable(): Promise<void> {
  const next = await disableWorkflow(workflowId.value);
  if (next) showToast(i18n.t('workflow.detail.disabledToast'));
}

async function onDuplicate(): Promise<void> {
  const next = await duplicateWorkflow(workflowId.value);
  if (next) showToast(i18n.t('workflow.detail.duplicatedToast'));
}

async function onDelete(): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('workflow.detail.delete'),
      message: i18n.t('workflow.detail.deleteConfirm'),
      confirmButtonText: i18n.t('workflow.detail.delete'),
      cancelButtonText: i18n.t('common.cancel')
    });
  } catch {
    return; /* dismissed */
  }
  const removed = await deleteWorkflow(workflowId.value);
  if (removed) {
    showToast(i18n.t('workflow.detail.deletedToast'));
    void router.replace('/dashboard/workflows');
  }
}

function onValidate(): void {
  if (!detail.value) return;
  const result = validateLocal(detail.value.definition);
  showToast(
    result.valid && result.issues.length === 0
      ? i18n.t('workflow.builder.validToast')
      : i18n.t('workflow.builder.invalidToast', { n: result.issues.length })
  );
}

function editWorkflow(): void {
  void router.push({ path: '/dashboard/workflows/builder', query: { id: workflowId.value } });
}

function openRuns(): void {
  void router.push({ path: '/dashboard/workflows/runs', query: { workflowId: workflowId.value } });
}

function openRun(runId: string): void {
  void router.push('/dashboard/workflows/runs/' + runId);
}

function retry(): void {
  void open(workflowId.value);
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(async () => {
  syncViewport();
  if (typeof window !== 'undefined') window.addEventListener('resize', syncViewport);
  if (workflowId.value === '') return;
  await open(workflowId.value);
  setWorkflowScope(workflowId.value);
  await loadRuns();
});
</script>

<template>
  <section class="wfd">
    <header class="wfd__top">
      <button
        class="wfd__home"
        type="button"
        :aria-label="i18n.t('workflow.backToList')"
        @click="router.push('/dashboard/workflows')"
      >&larr;</button>
      <div class="wfd__heading">
        <h1 class="wfd__title">{{ detail ? detail.name : i18n.t('workflow.detail.title') }}</h1>
        <p class="wfd__subtitle">
          <span v-if="detail" class="wfd__badge" :data-status="detail.status">
            {{ i18n.t('workflow.status.' + detail.status) }}
          </span>
          <span v-if="detail">{{ i18n.t('workflow.detail.trigger') }}: {{ triggerLabel }}</span>
        </p>
      </div>
      <div v-if="detail" class="wfd__actions">
        <button class="wfd__btn" type="button" @click="onValidate">
          {{ i18n.t('workflow.detail.validate') }}
        </button>
        <button class="wfd__btn" type="button" :disabled="saving" @click="openRuns">
          {{ i18n.t('workflow.detail.runs') }}
        </button>
        <button
          v-if="detail.status !== 'active'"
          class="wfd__btn is-primary"
          type="button"
          :disabled="saving"
          @click="onEnable"
        >{{ i18n.t('workflow.detail.enable') }}</button>
        <button
          v-else
          class="wfd__btn"
          type="button"
          :disabled="saving"
          @click="onDisable"
        >{{ i18n.t('workflow.detail.disable') }}</button>
        <button class="wfd__btn" type="button" :disabled="saving" @click="onDuplicate">
          {{ i18n.t('workflow.detail.duplicate') }}
        </button>
        <button class="wfd__btn is-primary" type="button" :disabled="saving" @click="editWorkflow">
          {{ i18n.t('workflow.detail.edit') }}
        </button>
        <button class="wfd__btn is-ghost" type="button" :disabled="saving" @click="onDelete">
          {{ i18n.t('workflow.detail.delete') }}
        </button>
      </div>
    </header>

    <div v-if="error" class="wfd__error">
      <strong>{{ i18n.t('workflow.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="wfd__btn" type="button" @click="retry">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <div v-if="!detail && !loading" class="wfd__empty">
      <h2 class="wfd__empty-title">{{ i18n.t('workflow.detail.notFound') }}</h2>
      <button class="wfd__btn is-primary" type="button" @click="router.push('/dashboard/workflows')">
        {{ i18n.t('workflow.backToList') }}
      </button>
    </div>

    <template v-if="detail">
      <dl class="wfd__facts">
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.description') }}</dt>
          <dd>{{ detail.description.trim() === '' ? i18n.t('workflow.detail.noDescription') : detail.description }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.status') }}</dt>
          <dd>{{ i18n.t('workflow.status.' + detail.status) }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.createdAt') }}</dt>
          <dd>{{ clock(detail.createdAt) }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.updatedAt') }}</dt>
          <dd>{{ clock(detail.updatedAt) }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.lastRun') }}</dt>
          <dd>{{ when(detail.lastRunAt) }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.todayRuns') }}</dt>
          <dd>{{ detail.todayRuns }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.successRuns') }}</dt>
          <dd class="is-ok">{{ detail.successRuns }}</dd>
        </div>
        <div class="wfd__fact">
          <dt>{{ i18n.t('workflow.detail.failedRuns') }}</dt>
          <dd class="is-bad">{{ detail.failedRuns }}</dd>
        </div>
      </dl>

      <div class="wfd__summary">
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.triggers') }}</span>
          <strong>{{ stats.triggers }}</strong>
        </article>
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.nodes') }}</span>
          <strong>{{ stats.nodes }}</strong>
        </article>
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.conditions') }}</span>
          <strong>{{ stats.conditions }}</strong>
        </article>
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.actions') }}</span>
          <strong>{{ stats.actions }}</strong>
        </article>
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.edges') }}</span>
          <strong>{{ stats.edges }}</strong>
        </article>
        <article class="wfd__stat">
          <span>{{ i18n.t('workflow.detail.depth') }}</span>
          <strong>{{ stats.depth }}</strong>
        </article>
      </div>

      <section class="wfd__graph">
        <header class="wfd__graph-head">
          <h2 class="wfd__h2">{{ i18n.t('workflow.detail.graphTitle') }}</h2>
          <p class="wfd__hint">{{ i18n.t('workflow.detail.readonlyHint') }}</p>
        </header>
        <WorkflowCanvas :definition="detail.definition" :variant="variant" readonly />
      </section>

      <section class="wfd__runs">
        <header class="wfd__runs-head">
          <h2 class="wfd__h2">{{ i18n.t('workflow.runs.title') }}</h2>
          <button class="wfd__btn" type="button" @click="openRuns">
            {{ i18n.t('workflow.detail.runs') }}
          </button>
        </header>
        <table v-if="recentRuns.length > 0" class="wfd__table">
          <thead>
            <tr>
              <th>{{ i18n.t('workflow.runs.colStarted') }}</th>
              <th>{{ i18n.t('workflow.runs.colStatus') }}</th>
              <th>{{ i18n.t('workflow.runs.colTrigger') }}</th>
              <th>{{ i18n.t('workflow.runs.colDuration') }}</th>
              <th><span class="wfd__sr-only">{{ i18n.t('workflow.runs.open') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in recentRuns" :key="run.id">
              <td class="wfd__mono">{{ clock(run.startedAt) }}</td>
              <td><span class="wfd__pill" :data-status="run.status">{{ runLabel(run) }}</span></td>
              <td class="wfd__trigger">{{ run.triggerReason }}</td>
              <td class="wfd__mono">{{ duration(run) }}</td>
              <td>
                <button class="wfd__btn wfd__btn--sm" type="button" @click="openRun(run.id)">
                  {{ i18n.t('workflow.runs.open') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="wfd__hint">{{ i18n.t('workflow.runs.empty') }}</p>
      </section>
    </template>

    <p v-else-if="loading" class="wfd__loading">{{ i18n.t('common.loading') }}</p>
  </section>
</template>

<style scoped>
.wfd {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  box-sizing: border-box;
}
.wfd__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.wfd__home {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.wfd__home:hover {
  background: var(--ks-bg-muted);
}
.wfd__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wfd__heading {
  flex: 1 1 280px;
  min-width: 0;
}
.wfd__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow-wrap: anywhere;
}
.wfd__subtitle {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.wfd__badge {
  padding: 2px 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ks-text-secondary);
}
.wfd__badge[data-status='active'] {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.wfd__badge[data-status='paused'] {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.wfd__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wfd__btn {
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.wfd__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
  border-color: var(--ks-primary-text);
}
.wfd__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wfd__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wfd__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wfd__btn.is-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ks-text-secondary);
}
.wfd__btn.is-ghost:hover:not(:disabled) {
  background: var(--ks-bg-muted);
  color: var(--ks-error);
  border-color: transparent;
}
.wfd__btn--sm {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.wfd__error {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.wfd__error .wfd__btn {
  margin-left: auto;
  height: 32px;
}
.wfd__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.wfd__empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wfd__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}
.wfd__fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  min-width: 0;
}
.wfd__fact dt {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wfd__fact dd {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.wfd__fact dd.is-ok {
  color: var(--ks-success);
}
.wfd__fact dd.is-bad {
  color: var(--ks-error);
}
.wfd__summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
.wfd__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.wfd__stat span {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wfd__stat strong {
  font-size: 20px;
  line-height: 24px;
  font-weight: 800;
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
}
.wfd__graph,
.wfd__runs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  min-width: 0;
}
.wfd__graph-head,
.wfd__runs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.wfd__h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wfd__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.wfd__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.wfd__table th,
.wfd__table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--ks-border-default);
  text-align: left;
  vertical-align: middle;
}
.wfd__table th {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wfd__table tbody tr:last-child td {
  border-bottom: none;
}
.wfd__mono {
  font-variant-numeric: tabular-nums;
  color: var(--ks-text-secondary);
  white-space: nowrap;
}
.wfd__trigger {
  max-width: 260px;
  color: var(--ks-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfd__pill {
  display: inline-block;
  padding: 2px 9px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ks-text-secondary);
  white-space: nowrap;
}
.wfd__pill[data-status='running'] {
  border-color: var(--ks-accent);
  color: var(--ks-accent);
}
.wfd__pill[data-status='succeeded'] {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.wfd__pill[data-status='failed'] {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.wfd__pill[data-status='stopped'] {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.wfd__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.wfd__loading {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}

@media (max-width: 1023px) {
  .wfd__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .wfd__summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .wfd__table {
    display: block;
    overflow-x: auto;
  }
}
@media (max-width: 767px) {
  .wfd {
    padding: 16px 12px 40px;
  }
  .wfd__title {
    font-size: 20px;
    line-height: 26px;
  }
  .wfd__actions {
    width: 100%;
  }
  .wfd__actions .wfd__btn {
    flex: 1 1 auto;
  }
  .wfd__facts {
    grid-template-columns: minmax(0, 1fr);
  }
  .wfd__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
