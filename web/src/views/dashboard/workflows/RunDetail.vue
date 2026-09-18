<script setup lang="ts">
/**
 * One workflow run, node by node (Sprint 12).
 *
 * The engine lives on the server, so this page is a replay console rather than
 * an executor. It loads a single WorkflowRun, repaints the graph the builder
 * drew with per node run states overlaid, and keeps a two second probe alive
 * only while the run can still change. Failed probes back off exponentially and
 * say so on screen, because a silently stalled refresh reads as a hung run.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import ExecutionPath from '../../../components/workflow/ExecutionPath.vue';
import RunTimeline from '../../../components/workflow/RunTimeline.vue';
import WorkflowCanvas from '../../../components/workflow/WorkflowCanvas.vue';
import { useWorkflow } from '../../../composables/useWorkflow';
import { useWorkflowMonitor } from '../../../composables/useWorkflowMonitor';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { emptyDefinition, kindOfType } from '../../../lib/workflowGraph';
import { nodeTypeDefOrFallback } from '../../../lib/workflowNodes';
import { relativeTime } from '../../../lib/relativeTime';
import { NODE_RUN_STATES, RUN_POLL_INTERVAL_MS } from '../../../types';
import type { NodeRun, NodeRunState, WorkflowDefinition } from '../../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('workflow.runDetail.metaTitle'), i18n.t('workflow.runDetail.metaDescription'));

const {
  currentRun,
  loading,
  saving,
  error,
  failures,
  progress,
  stateCounts,
  openRun,
  stopRun,
  rerun,
  durationOf,
  stopPolling,
  syncPollingWithRuns
} = useWorkflowMonitor();

/* The graph itself comes from the parent workflow; a run only carries states. */
const { detail, open } = useWorkflow();

const runId = computed(() => (typeof route.params.runId === 'string' ? route.params.runId : ''));

const isMobile = ref(false);
const variant = computed<'graph' | 'list'>(() => (isMobile.value ? 'list' : 'graph'));

const selectedNodeId = ref<string | null>(null);

const definition = computed<WorkflowDefinition>(() =>
  detail.value ? detail.value.definition : emptyDefinition()
);
const hasGraph = computed(() => definition.value.nodes.length > 0);

const notFound = computed(() => !loading.value && currentRun.value === null);
const isLive = computed(() => currentRun.value?.status === 'running');
const isDemo = computed(() => currentRun.value?.demo === true);

/** Painted onto the canvas so a running node pulses and a failed one reads red. */
const nodeStates = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  const run = currentRun.value;
  if (!run) return map;
  for (const item of run.nodeRuns) map[item.nodeId] = item.state;
  return map;
});

const states = NODE_RUN_STATES;

const counts = computed(() => {
  const source = stateCounts.value;
  const out: Record<NodeRunState, string> = {
    pending: '0',
    running: '0',
    succeeded: '0',
    failed: '0',
    skipped: '0'
  };
  if (!source) return out;
  for (const key of states) out[key] = String(source[key] ?? 0);
  return out;
});

const percent = computed(() => Math.round(progress.value * 100));
const pollSeconds = computed(() => Math.max(1, Math.round(RUN_POLL_INTERVAL_MS / 1000)));

const statusLabel = computed(() =>
  currentRun.value ? i18n.t('workflow.runStatus.' + currentRun.value.status) : '-'
);

const startedText = computed(() => {
  const run = currentRun.value;
  if (!run) return '-';
  return new Date(run.startedAt).toLocaleString();
});

const startedAgo = computed(() => {
  const run = currentRun.value;
  if (!run) return '';
  return relativeTime(run.startedAt, Date.now(), i18n.locale);
});

const endedText = computed(() => {
  const run = currentRun.value;
  if (!run) return '-';
  if (run.endedAt === null) return i18n.t('workflow.runDetail.stillRunning');
  return new Date(run.endedAt).toLocaleString();
});

const durationText = computed(() => {
  const run = currentRun.value;
  return run ? durationOf(run.durationMs, i18n.locale) : '-';
});

/* The inspector answers "what went in and out of the node I clicked". */
const selectedRun = computed<NodeRun | null>(() => {
  const run = currentRun.value;
  const id = selectedNodeId.value;
  if (!run || !id) return null;
  return run.nodeRuns.find((item) => item.nodeId === id) ?? null;
});

const selectedLabel = computed(() => {
  const item = selectedRun.value;
  if (!item) return '';
  if (item.nodeName && item.nodeName.trim()) return item.nodeName;
  return i18n.t(nodeTypeDefOrFallback(item.nodeType, kindOfType(item.nodeType)).labelKey);
});

const selectedType = computed(() => {
  const item = selectedRun.value;
  if (!item) return '';
  return i18n.t(nodeTypeDefOrFallback(item.nodeType, kindOfType(item.nodeType)).labelKey);
});

function payloadOf(value: Record<string, unknown> | undefined): string {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

const selectedInput = computed(() => payloadOf(selectedRun.value?.input));
const selectedOutput = computed(() => payloadOf(selectedRun.value?.output));

function syncViewport(): void {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 1024;
}

function clock(ts: number): string {
  return new Date(ts).toLocaleString();
}

function onSelectNode(nodeId: string | null): void {
  selectedNodeId.value = selectedNodeId.value === nodeId ? null : nodeId;
}

function backToRuns(): void {
  const run = currentRun.value;
  if (!run) {
    void router.push('/dashboard/workflows/runs');
    return;
  }
  void router.push({ path: '/dashboard/workflows/runs', query: { workflowId: run.workflowId } });
}

function openWorkflow(): void {
  const run = currentRun.value;
  if (!run) return;
  void router.push('/dashboard/workflows/' + run.workflowId);
}

async function load(id: string): Promise<void> {
  if (id === '') return;
  stopPolling();
  selectedNodeId.value = null;
  const run = await openRun(id);
  if (run && (!detail.value || detail.value.id !== run.workflowId)) {
    await open(run.workflowId);
  }
  syncPollingWithRuns();
}

async function onStop(): Promise<void> {
  const run = currentRun.value;
  if (!run) return;
  if (run.status !== 'running') {
    showToast(i18n.t('workflow.runs.stopUnavailable'));
    return;
  }
  const next = await stopRun(run.id);
  if (next) showToast(i18n.t('workflow.runDetail.stoppedToast'));
  syncPollingWithRuns();
}

async function onRerun(): Promise<void> {
  const run = currentRun.value;
  if (!run) return;
  const next = await rerun(run.workflowId);
  if (next) {
    showToast(i18n.t('workflow.runDetail.rerunToast'));
    await router.push('/dashboard/workflows/runs/' + next.id);
  }
}

watch(runId, (id) => {
  void load(id);
});

/* A finished run needs no probe; syncPollingWithRuns parks the timer. */
watch(
  () => currentRun.value?.status,
  () => {
    syncPollingWithRuns();
  }
);

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(async () => {
  syncViewport();
  if (typeof window !== 'undefined') window.addEventListener('resize', syncViewport);
  await load(runId.value);
});

onBeforeUnmount(() => {
  stopPolling();
  if (typeof window !== 'undefined') window.removeEventListener('resize', syncViewport);
});
</script>

<template>
  <section class="wfrd">
    <header class="wfrd__top">
      <button
        class="wfrd__home"
        type="button"
        :aria-label="i18n.t('workflow.runs.title')"
        @click="backToRuns"
      >&larr;</button>
      <div class="wfrd__heading">
        <h1 class="wfrd__title">
          {{ i18n.t('workflow.runDetail.title') }}
          <span v-if="currentRun" class="wfrd__id">{{ currentRun.id }}</span>
        </h1>
        <p class="wfrd__subtitle">
          <span v-if="currentRun" class="wfrd__pill" :data-status="currentRun.status">
            {{ statusLabel }}
          </span>
          <span v-if="isLive" class="wfrd__live">
            <span class="wfrd__live-dot" aria-hidden="true"></span>
            {{ i18n.t('workflow.runDetail.live') }}
          </span>
        </p>
      </div>
      <div class="wfrd__actions">
        <button
          class="wfrd__btn"
          type="button"
          :disabled="saving || !isLive"
          @click="onStop"
        >{{ i18n.t('workflow.runDetail.stop') }}</button>
        <button
          class="wfrd__btn"
          type="button"
          :disabled="saving || !currentRun"
          @click="onRerun"
        >{{ i18n.t('workflow.runDetail.rerun') }}</button>
        <button
          class="wfrd__btn is-primary"
          type="button"
          :disabled="!currentRun"
          @click="openWorkflow"
        >{{ i18n.t('workflow.runDetail.openWorkflow') }}</button>
      </div>
    </header>

    <div v-if="isDemo" class="wfrd__demo">
      <span>{{ i18n.t('workflow.runs.demoNotice') }}</span>
    </div>

    <div v-if="error" class="wfrd__error">
      <strong>{{ i18n.t('workflow.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="wfrd__btn" type="button" @click="load(runId)">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <p v-if="notFound" class="wfrd__missing">{{ i18n.t('workflow.runDetail.notFound') }}</p>

    <template v-if="currentRun">
      <dl class="wfrd__meta">
        <div class="wfrd__fact">
          <dt>{{ i18n.t('workflow.runDetail.workflow') }}</dt>
          <dd>
            <button class="wfrd__link" type="button" @click="openWorkflow">
              {{ currentRun.workflowName }}
            </button>
          </dd>
        </div>
        <div class="wfrd__fact">
          <dt>{{ i18n.t('workflow.runDetail.trigger') }}</dt>
          <dd class="wfrd__trigger">{{ currentRun.triggerReason }}</dd>
        </div>
        <div class="wfrd__fact">
          <dt>{{ i18n.t('workflow.runDetail.started') }}</dt>
          <dd class="wfrd__mono" :title="clock(currentRun.startedAt)">{{ startedAgo }}</dd>
        </div>
        <div class="wfrd__fact">
          <dt>{{ i18n.t('workflow.runDetail.ended') }}</dt>
          <dd class="wfrd__mono">{{ endedText }}</dd>
        </div>
        <div class="wfrd__fact">
          <dt>{{ i18n.t('workflow.runDetail.duration') }}</dt>
          <dd class="wfrd__mono">{{ durationText }}</dd>
        </div>
      </dl>

      <div class="wfrd__progress">
        <div class="wfrd__progress-head">
          <span>{{ i18n.t('workflow.runDetail.progress') }}</span>
          <strong>{{ percent }}%</strong>
        </div>
        <span class="wfrd__bar">
          <span class="wfrd__bar-fill" :style="{ width: percent + '%' }"></span>
        </span>
        <ul class="wfrd__counts" :aria-label="i18n.t('workflow.runDetail.countsTitle')">
          <li v-for="state in states" :key="state" class="wfrd__count" :data-state="state">
            <span class="wfrd__count-dot" aria-hidden="true"></span>
            <span class="wfrd__count-label">{{ i18n.t('workflow.nodeState.' + state) }}</span>
            <strong>{{ counts[state] }}</strong>
          </li>
        </ul>
      </div>

      <p v-if="isLive" class="wfrd__hint">
        {{ i18n.t('workflow.runDetail.liveHint', { n: pollSeconds }) }}
      </p>
      <p v-if="failures > 0" class="wfrd__hint is-warn">
        {{ i18n.t('workflow.runDetail.backoffHint', { n: failures }) }}
      </p>

      <section v-if="hasGraph" class="wfrd__graph">
        <h2 class="wfrd__section-title">{{ i18n.t('workflow.detail.graphTitle') }}</h2>
        <WorkflowCanvas
          :definition="definition"
          :variant="variant"
          readonly
          :selected-node-id="selectedNodeId"
          :node-states="nodeStates"
          @select="onSelectNode"
        />
      </section>

      <section class="wfrd__path">
        <h2 class="wfrd__section-title">{{ i18n.t('workflow.runDetail.pathTitle') }}</h2>
        <ExecutionPath :run="currentRun" @select="onSelectNode" />
      </section>

      <section v-if="selectedRun" class="wfrd__inspector">
        <header class="wfrd__inspector-head">
          <div>
            <h2 class="wfrd__section-title">{{ selectedLabel }}</h2>
            <p class="wfrd__inspector-sub">
              {{ selectedType }}
              <span class="wfrd__pill" :data-status="selectedRun.state">
                {{ i18n.t('workflow.nodeState.' + selectedRun.state) }}
              </span>
            </p>
          </div>
          <button
            class="wfrd__btn is-ghost"
            type="button"
            @click="selectedNodeId = null"
          >{{ i18n.t('common.close') }}</button>
        </header>
        <dl class="wfrd__inspector-facts">
          <div class="wfrd__fact">
            <dt>{{ i18n.t('workflow.timeline.started') }}</dt>
            <dd class="wfrd__mono">
              {{ selectedRun.startedAt === null ? i18n.t('workflow.timeline.notStarted') : clock(selectedRun.startedAt) }}
            </dd>
          </div>
          <div class="wfrd__fact">
            <dt>{{ i18n.t('workflow.runDetail.duration') }}</dt>
            <dd class="wfrd__mono">{{ durationOf(selectedRun.durationMs, i18n.locale) }}</dd>
          </div>
          <div class="wfrd__fact">
            <dt>{{ i18n.t('workflow.timeline.attempts', { n: selectedRun.attempts }) }}</dt>
            <dd class="wfrd__mono">{{ selectedRun.attempts }}</dd>
          </div>
        </dl>
        <p v-if="selectedRun.error" class="wfrd__inspector-error">
          <strong>{{ i18n.t('workflow.timeline.error') }}</strong>
          <code>{{ selectedRun.error }}</code>
        </p>
        <div class="wfrd__payloads">
          <div class="wfrd__payload">
            <h3>{{ i18n.t('workflow.timeline.input') }}</h3>
            <pre v-if="selectedInput">{{ selectedInput }}</pre>
            <p v-else class="wfrd__none">{{ i18n.t('workflow.timeline.noData') }}</p>
          </div>
          <div class="wfrd__payload">
            <h3>{{ i18n.t('workflow.timeline.output') }}</h3>
            <pre v-if="selectedOutput">{{ selectedOutput }}</pre>
            <p v-else class="wfrd__none">{{ i18n.t('workflow.timeline.noData') }}</p>
          </div>
        </div>
      </section>

      <section class="wfrd__log">
        <h2 class="wfrd__section-title">{{ i18n.t('workflow.runDetail.logTitle') }}</h2>
        <RunTimeline :node-runs="currentRun.nodeRuns" @select="onSelectNode" />
      </section>
    </template>
  </section>
</template>

<style scoped>
.wfrd {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}
.wfrd__top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.wfrd__home {
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.wfrd__home:hover {
  border-color: var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.wfrd__heading {
  flex: 1 1 auto;
  min-width: 0;
}
.wfrd__title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}
.wfrd__id {
  padding: 1px 8px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 500;
}
.wfrd__subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 6px 0 0;
}
.wfrd__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}
.wfrd__btn {
  padding: 8px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    background var(--ks-motion-fast) var(--ks-ease), opacity var(--ks-motion-fast) var(--ks-ease);
}
.wfrd__btn:hover:not(:disabled) {
  border-color: var(--ks-border-strong);
}
.wfrd__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wfrd__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wfrd__btn.is-ghost {
  background: transparent;
}
.wfrd__pill {
  padding: 2px 10px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.wfrd__pill[data-status='succeeded'] {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.wfrd__pill[data-status='failed'] {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.wfrd__pill[data-status='stopped'] {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.wfrd__pill[data-status='running'],
.wfrd__pill[data-status='pending'] {
  border-color: var(--ks-primary);
  color: var(--ks-primary-text);
}
.wfrd__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ks-primary-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.wfrd__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ks-primary);
  animation: wfrd-blink 1.4s var(--ks-ease) infinite;
}
@keyframes wfrd-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
.wfrd__demo,
.wfrd__error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--ks-border-default);
  border-left: 3px solid var(--ks-primary);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 13px;
}
.wfrd__error {
  border-left-color: var(--ks-error);
}
.wfrd__missing {
  margin: 0;
  padding: 40px 16px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  color: var(--ks-text-tertiary);
  font-size: 14px;
  text-align: center;
}
.wfrd__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 1px;
  margin: 0;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-border-default);
  overflow: hidden;
}
.wfrd__fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--ks-bg-surface);
}
.wfrd__fact dt {
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.wfrd__fact dd {
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.wfrd__mono {
  font-variant-numeric: tabular-nums;
}
.wfrd__trigger {
  font-weight: 500;
  color: var(--ks-text-secondary);
}
.wfrd__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ks-primary-text);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.wfrd__progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wfrd__progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.wfrd__progress-head strong {
  color: var(--ks-text-primary);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.wfrd__bar {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  overflow: hidden;
}
.wfrd__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  transition: width var(--ks-motion-normal) var(--ks-ease);
}
.wfrd__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.wfrd__count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ks-text-secondary);
  font-size: 12px;
}
.wfrd__count strong {
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
}
.wfrd__count-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--ks-text-tertiary);
}
.wfrd__count[data-state='running'] .wfrd__count-dot {
  background: var(--ks-primary);
}
.wfrd__count[data-state='succeeded'] .wfrd__count-dot {
  background: var(--ks-success);
}
.wfrd__count[data-state='failed'] .wfrd__count-dot {
  background: var(--ks-error);
}
.wfrd__count[data-state='skipped'] .wfrd__count-dot {
  background: var(--ks-warning);
}
.wfrd__hint {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
.wfrd__hint.is-warn {
  color: var(--ks-warning);
}
.wfrd__section-title {
  margin: 0 0 10px;
  color: var(--ks-text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 21px;
}
.wfrd__graph,
.wfrd__path,
.wfrd__log,
.wfrd__inspector {
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wfrd__inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-left: 3px solid var(--ks-accent);
}
.wfrd__inspector-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.wfrd__inspector-head .wfrd__section-title {
  margin: 0;
}
.wfrd__inspector-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 6px 0 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
.wfrd__inspector-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin: 0;
}
.wfrd__inspector-error {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  color: var(--ks-error);
  font-size: 12px;
}
.wfrd__inspector-error code {
  color: var(--ks-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
}
.wfrd__payloads {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.wfrd__payload h3 {
  margin: 0 0 6px;
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.wfrd__payload pre {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.wfrd__none {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
@media (max-width: 1023px) {
  .wfrd {
    padding: 16px 16px 32px;
  }
  .wfrd__top {
    flex-wrap: wrap;
  }
  .wfrd__actions {
    width: 100%;
    flex-wrap: wrap;
  }
  .wfrd__btn {
    flex: 1 1 auto;
  }
}
@media (max-width: 767px) {
  .wfrd__title {
    font-size: 19px;
    line-height: 26px;
  }
  .wfrd__meta {
    grid-template-columns: 1fr;
  }
  .wfrd__payloads {
    grid-template-columns: 1fr;
  }
}
</style>
