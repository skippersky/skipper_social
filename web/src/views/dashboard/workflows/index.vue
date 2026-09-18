<script setup lang="ts">
/**
 * Automation workflow hub (Sprint 12).
 *
 * The module landing page: today's numbers on top, the workflow grid below,
 * narrowed by status and searched by name. Every lifecycle action is an emit
 * from WorkflowCard handled here, so the store stays the only thing that talks
 * to the api and the demo fallback renders through the same template.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import WorkflowCard from '../../../components/workflow/WorkflowCard.vue';
import { WORKFLOW_STATUS_FILTERS, useWorkflow } from '../../../composables/useWorkflow';
import type { WorkflowStatusFilter } from '../../../composables/useWorkflow';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { useWorkflowStore } from '../../../stores/workflow';

const i18n = useI18nStore();
const router = useRouter();
const store = useWorkflowStore();

usePageMeta(i18n.t('workflow.metaTitle'), i18n.t('workflow.metaDescription'));

/* Destructured so each slice auto-unwraps in the template. */
const {
  workflows,
  total,
  hasMore,
  loading,
  saving,
  error,
  overview,
  statusFilter,
  query,
  refresh,
  search,
  filterStatus,
  loadMore,
  loadOverview,
  enableWorkflow,
  disableWorkflow,
  deleteWorkflow,
  duplicateWorkflow
} = useWorkflow();

/* Sample-data disclosure, mirroring marketing, analytics and the customer list. */
const DEMO_HIDDEN_KEY = 'ks-workflow-demo-hidden';
const demoHidden = ref(false);
const showDemoBar = computed(() => store.hasDemoData && !demoHidden.value);

/** Local mirror so typing does not fire a request per keystroke. */
const searchText = ref('');
const filters = WORKFLOW_STATUS_FILTERS;

const kpi = computed(() => ({
  active: formatNumber(overview.value.activeWorkflows, i18n.locale),
  triggers: formatNumber(overview.value.todayTriggers, i18n.locale),
  succeeded: formatNumber(overview.value.todaySucceeded, i18n.locale),
  failed: formatNumber(overview.value.todayFailed, i18n.locale)
}));

/** A filter or a search term means "nothing matched", not "nothing exists". */
const isFiltered = computed(() => statusFilter.value !== 'all' || query.value.trim() !== '');

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

function statusLabel(item: WorkflowStatusFilter): string {
  return item === 'all' ? i18n.t('workflow.filterAll') : i18n.t('workflow.status.' + item);
}

function onStatus(next: WorkflowStatusFilter): void {
  void filterStatus(next);
}

function onSearchSubmit(): void {
  void search(searchText.value);
}

function clearSearch(): void {
  searchText.value = '';
  void search('');
}

function openDetail(id: string): void {
  void router.push('/dashboard/workflows/' + id);
}

function openBuilder(id?: string): void {
  if (id) {
    void router.push({ path: '/dashboard/workflows/builder', query: { id: id } });
    return;
  }
  void router.push('/dashboard/workflows/builder');
}

function openRuns(id?: string): void {
  if (id) {
    void router.push({ path: '/dashboard/workflows/runs', query: { workflowId: id } });
    return;
  }
  void router.push('/dashboard/workflows/runs');
}

async function onEnable(id: string): Promise<void> {
  const next = await enableWorkflow(id);
  if (next) showToast(i18n.t('workflow.detail.enabledToast'));
}

async function onDisable(id: string): Promise<void> {
  const next = await disableWorkflow(id);
  if (next) showToast(i18n.t('workflow.detail.disabledToast'));
}

async function onDuplicate(id: string): Promise<void> {
  const next = await duplicateWorkflow(id);
  if (next) showToast(i18n.t('workflow.detail.duplicatedToast'));
}

async function onDelete(id: string): Promise<void> {
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
  const removed = await deleteWorkflow(id);
  if (removed) showToast(i18n.t('workflow.detail.deletedToast'));
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(() => {
  try {
    demoHidden.value = localStorage.getItem(DEMO_HIDDEN_KEY) === '1';
  } catch {
    /* private mode */
  }
  searchText.value = query.value;
  void loadOverview();
  void refresh();
});
</script>

<template>
  <section class="wf">
    <header class="wf__top">
      <button
        class="wf__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <div class="wf__heading">
        <h1 class="wf__title">{{ i18n.t('workflow.title') }}</h1>
        <p class="wf__subtitle">{{ i18n.t('workflow.subtitle') }}</p>
      </div>
      <div class="wf__top-actions">
        <router-link class="wf__link" to="/dashboard/workflows/templates">
          {{ i18n.t('workflow.templatesEntry') }}
        </router-link>
        <button class="wf__btn" type="button" @click="openRuns()">
          {{ i18n.t('workflow.runsEntry') }}
        </button>
        <button class="wf__btn is-primary" type="button" @click="openBuilder()">
          {{ i18n.t('workflow.newWorkflow') }}
        </button>
      </div>
    </header>

    <div v-if="showDemoBar" class="wf__demo">
      <span>{{ i18n.t('workflow.demoNotice') }}</span>
      <button type="button" :aria-label="i18n.t('workflow.demoHide')" @click="hideDemo">&times;</button>
    </div>

    <div class="wf__kpis">
      <article class="wf__kpi">
        <span class="wf__kpi-label">{{ i18n.t('workflow.kpi.active') }}</span>
        <strong class="wf__kpi-value">{{ kpi.active }}</strong>
      </article>
      <article class="wf__kpi">
        <span class="wf__kpi-label">{{ i18n.t('workflow.kpi.todayTriggers') }}</span>
        <strong class="wf__kpi-value">{{ kpi.triggers }}</strong>
      </article>
      <article class="wf__kpi">
        <span class="wf__kpi-label">{{ i18n.t('workflow.kpi.todaySucceeded') }}</span>
        <strong class="wf__kpi-value wf__kpi-value--ok">{{ kpi.succeeded }}</strong>
      </article>
      <article class="wf__kpi">
        <span class="wf__kpi-label">{{ i18n.t('workflow.kpi.todayFailed') }}</span>
        <strong class="wf__kpi-value wf__kpi-value--bad">{{ kpi.failed }}</strong>
      </article>
    </div>

    <div class="wf__toolbar">
      <form class="wf__search" @submit.prevent="onSearchSubmit">
        <label class="wf__sr-only" for="wf-search">{{ i18n.t('workflow.searchPlaceholder') }}</label>
        <input
          id="wf-search"
          v-model="searchText"
          class="wf__input"
          type="search"
          :placeholder="i18n.t('workflow.searchPlaceholder')"
        />
        <button class="wf__btn" type="submit" :disabled="loading">
          {{ i18n.t('common.search') }}
        </button>
        <button
          v-if="searchText !== ''"
          class="wf__btn is-ghost"
          type="button"
          @click="clearSearch"
        >{{ i18n.t('common.clear') }}</button>
      </form>
      <span class="wf__count">{{ i18n.t('workflow.totalWorkflows', { n: total }) }}</span>
    </div>

    <div class="wf__tabs" role="tablist">
      <button
        v-for="item in filters"
        :key="item"
        class="wf__tab"
        :class="{ 'is-active': statusFilter === item }"
        type="button"
        role="tab"
        :aria-selected="statusFilter === item"
        @click="onStatus(item)"
      >{{ statusLabel(item) }}</button>
    </div>

    <div v-if="error" class="wf__error">
      <strong>{{ i18n.t('workflow.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="wf__btn" type="button" @click="refresh()">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <div v-if="workflows.length > 0" class="wf__grid">
      <WorkflowCard
        v-for="item in workflows"
        :key="item.id"
        :workflow="item"
        @open="openDetail"
        @edit="openBuilder"
        @enable="onEnable"
        @disable="onDisable"
        @duplicate="onDuplicate"
        @delete="onDelete"
        @runs="openRuns"
      />
    </div>

    <div v-else-if="!loading" class="wf__empty">
      <h2 class="wf__empty-title">
        {{ isFiltered ? i18n.t('workflow.filteredEmpty') : i18n.t('workflow.empty') }}
      </h2>
      <p class="wf__empty-hint">{{ i18n.t('workflow.emptyHint') }}</p>
      <div class="wf__empty-actions">
        <button class="wf__btn is-primary" type="button" @click="openBuilder()">
          {{ i18n.t('workflow.newWorkflow') }}
        </button>
        <button class="wf__btn" type="button" @click="router.push('/dashboard/workflows/templates')">
          {{ i18n.t('workflow.templatesEntry') }}
        </button>
      </div>
    </div>

    <p v-else class="wf__loading">{{ i18n.t('common.loading') }}</p>

    <div v-if="hasMore" class="wf__more">
      <button class="wf__btn" type="button" :disabled="loading || saving" @click="loadMore()">
        {{ i18n.t('workflow.loadMore') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.wf {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  box-sizing: border-box;
}
.wf__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.wf__home {
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
.wf__home:hover {
  background: var(--ks-bg-muted);
}
.wf__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wf__heading {
  flex: 1 1 320px;
  min-width: 0;
}
.wf__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wf__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.wf__top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wf__link {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 14px;
  border-radius: var(--ks-radius-btn);
  color: var(--ks-primary-text);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.wf__link:hover {
  background: var(--ks-bg-muted);
}
.wf__link:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wf__btn {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.wf__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.wf__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wf__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wf__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wf__btn.is-primary:hover:not(:disabled) {
  filter: brightness(1.04);
}
.wf__btn.is-ghost {
  border-color: transparent;
  color: var(--ks-primary-text);
}
.wf__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--ks-warning);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-soft);
  font-size: 12px;
  color: var(--ks-text-primary);
}
.wf__demo button {
  flex: none;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.wf__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.wf__kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wf__kpi-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wf__kpi-value {
  font-size: 24px;
  line-height: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ks-text-primary);
}
.wf__kpi-value--ok {
  color: var(--ks-success);
}
.wf__kpi-value--bad {
  color: var(--ks-error);
}
.wf__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.wf__search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 360px;
  min-width: 0;
}
.wf__sr-only {
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
.wf__input {
  flex: 1;
  min-width: 160px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.wf__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.wf__count {
  font-size: 12px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.wf__tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  align-self: flex-start;
}
.wf__tab {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.wf__tab:hover {
  color: var(--ks-text-primary);
}
.wf__tab.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.wf__tab:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wf__error {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.wf__error .wf__btn {
  margin-left: auto;
  height: 32px;
}
.wf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.wf__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.wf__empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wf__empty-hint {
  margin: 0;
  max-width: 460px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.wf__empty-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.wf__loading {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.wf__more {
  display: flex;
  justify-content: center;
}

@media (max-width: 1023px) {
  .wf__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .wf {
    padding: 16px 12px 40px;
  }
  .wf__title {
    font-size: 20px;
    line-height: 26px;
  }
  .wf__top-actions {
    width: 100%;
  }
  .wf__top-actions .wf__btn.is-primary {
    flex: 1 1 auto;
  }
  .wf__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .wf__search {
    flex: 1 1 100%;
  }
  .wf__tab {
    flex: 1 1 auto;
  }
}
</style>
