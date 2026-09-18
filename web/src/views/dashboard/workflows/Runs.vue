<script setup lang="ts">
/**
 * Workflow run history (Sprint 12).
 *
 * A flat log of every execution the engine produced, filterable by status and
 * by local date range, and optionally scoped to one workflow when the detail
 * page links here with a query. The summary strip is computed by the api layer,
 * so the numbers stay correct even while only one page of rows is loaded.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { RUN_STATUS_FILTERS, useWorkflowMonitor } from '../../../composables/useWorkflowMonitor';
import type { RunStatusFilter } from '../../../composables/useWorkflowMonitor';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { progressOf } from '../../../lib/workflowRun';
import { relativeTime } from '../../../lib/relativeTime';
import type { WorkflowRun } from '../../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('workflow.runs.metaTitle'), i18n.t('workflow.runs.metaDescription'));

const {
  runs,
  runsTotal,
  runsHasMore,
  runStats,
  loading,
  saving,
  error,
  hasDemoData,
  statusFilter,
  workflowId,
  setWorkflowScope,
  setDateRange,
  loadRuns,
  loadStats,
  filterStatus,
  loadMoreRuns,
  stopRun,
  rerun,
  durationOf,
  syncPollingWithRuns
} = useWorkflowMonitor();

const filters = RUN_STATUS_FILTERS;
const DAY_MS = 86400000;

/** The date inputs speak local YYYY-MM-DD while the api speaks epoch ms. */
const fromText = ref('');
const toText = ref('');

const demoVisible = computed(() => hasDemoData.value);
const scoped = computed(() => workflowId.value !== null && workflowId.value !== '');

const stats = computed(() => ({
  total: formatNumber(runStats.value.total, i18n.locale),
  successRate: Math.round(runStats.value.successRate * 100) + '%',
  average: durationOf(runStats.value.averageDurationMs, i18n.locale),
  running: formatNumber(runStats.value.running, i18n.locale)
}));

function dayStart(text: string): number | null {
  const parts = text.split('-');
  if (parts.length !== 3) return null;
  const ms = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function applyRange(): Promise<void> {
  const from = dayStart(fromText.value);
  const to = dayStart(toText.value);
  setDateRange(from, to === null ? null : to + DAY_MS - 1);
  await loadRuns();
  await loadStats();
  syncPollingWithRuns();
}

async function resetRange(): Promise<void> {
  fromText.value = '';
  toText.value = '';
  await applyRange();
}

async function clearScope(): Promise<void> {
  setWorkflowScope(null);
  await loadRuns();
  await loadStats();
}

function filterLabel(item: RunStatusFilter): string {
  return item === 'all' ? i18n.t('workflow.filterAll') : i18n.t('workflow.runStatus.' + item);
}

async function onFilter(next: RunStatusFilter): Promise<void> {
  await filterStatus(next);
  await loadStats();
  syncPollingWithRuns();
}

function statusLabel(run: WorkflowRun): string {
  return i18n.t('workflow.runStatus.' + run.status);
}

function started(run: WorkflowRun): string {
  return relativeTime(run.startedAt, Date.now(), i18n.locale);
}

function clock(ts: number): string {
  return new Date(ts).toLocaleString();
}

function progress(run: WorkflowRun): number {
  return Math.round(progressOf(run) * 100);
}

function openRun(runId: string): void {
  void router.push('/dashboard/workflows/runs/' + runId);
}

function openWorkflow(id: string): void {
  void router.push('/dashboard/workflows/' + id);
}

async function onStop(run: WorkflowRun): Promise<void> {
  if (run.status !== 'running') {
    showToast(i18n.t('workflow.runs.stopUnavailable'));
    return;
  }
  const next = await stopRun(run.id);
  if (next) showToast(i18n.t('workflow.runs.stoppedToast'));
  syncPollingWithRuns();
}

async function onRerun(run: WorkflowRun): Promise<void> {
  const next = await rerun(run.workflowId);
  if (next) showToast(i18n.t('workflow.runs.rerunToast'));
  syncPollingWithRuns();
}

async function onMore(): Promise<void> {
  await loadMoreRuns();
  syncPollingWithRuns();
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(async () => {
  const scope = typeof route.query.workflowId === 'string' ? route.query.workflowId : '';
  if (scope !== '') setWorkflowScope(scope);
  await loadRuns();
  await loadStats();
  syncPollingWithRuns();
});
</script>

<template>
  <section class="wfr">
    <header class="wfr__top">
      <button
        class="wfr__home"
        type="button"
        :aria-label="i18n.t('workflow.backToList')"
        @click="router.push('/dashboard/workflows')"
      >&larr;</button>
      <div class="wfr__heading">
        <h1 class="wfr__title">{{ i18n.t('workflow.runs.title') }}</h1>
        <p class="wfr__subtitle">{{ i18n.t('workflow.runs.subtitle') }}</p>
      </div>
      <span class="wfr__count">{{ i18n.t('workflow.runs.total', { n: runsTotal }) }}</span>
    </header>

    <div v-if="scoped" class="wfr__scope">
      <span>{{ i18n.t('workflow.runs.scopedTo') }}</span>
      <button class="wfr__btn" type="button" @click="clearScope">
        {{ i18n.t('workflow.runs.clearScope') }}
      </button>
    </div>

    <div v-if="demoVisible" class="wfr__demo">
      <span>{{ i18n.t('workflow.runs.demoNotice') }}</span>
    </div>

    <div class="wfr__stats">
      <article class="wfr__stat">
        <span>{{ i18n.t('workflow.runs.statsTotal') }}</span>
        <strong>{{ stats.total }}</strong>
      </article>
      <article class="wfr__stat">
        <span>{{ i18n.t('workflow.runs.statsSuccessRate') }}</span>
        <strong class="is-ok">{{ stats.successRate }}</strong>
      </article>
      <article class="wfr__stat">
        <span>{{ i18n.t('workflow.runs.statsAvgDuration') }}</span>
        <strong>{{ stats.average }}</strong>
      </article>
      <article class="wfr__stat">
        <span>{{ i18n.t('workflow.runs.statsRunning') }}</span>
        <strong class="is-live">{{ stats.running }}</strong>
      </article>
    </div>

    <form class="wfr__filters" @submit.prevent="applyRange">
      <label class="wfr__field">
        <span class="wfr__label">{{ i18n.t('workflow.runs.colStarted') }}</span>
        <input v-model="fromText" class="wfr__input" type="date" />
      </label>
      <label class="wfr__field">
        <span class="wfr__sr-only">{{ i18n.t('common.clear') }}</span>
        <input v-model="toText" class="wfr__input" type="date" />
      </label>
      <button class="wfr__btn" type="submit" :disabled="loading">
        {{ i18n.t('common.search') }}
      </button>
      <button class="wfr__btn is-ghost" type="button" @click="resetRange">
        {{ i18n.t('common.clear') }}
      </button>
    </form>

    <div class="wfr__tabs" role="tablist">
      <button
        v-for="item in filters"
        :key="item"
        class="wfr__tab"
        :class="{ 'is-active': statusFilter === item }"
        type="button"
        role="tab"
        :aria-selected="statusFilter === item"
        @click="onFilter(item)"
      >{{ filterLabel(item) }}</button>
    </div>

    <div v-if="error" class="wfr__error">
      <strong>{{ i18n.t('workflow.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="wfr__btn" type="button" @click="loadRuns()">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <div v-if="runs.length > 0" class="wfr__table-wrap">
      <table class="wfr__table">
        <thead>
          <tr>
            <th>{{ i18n.t('workflow.runs.colWorkflow') }}</th>
            <th>{{ i18n.t('workflow.runs.colStatus') }}</th>
            <th>{{ i18n.t('workflow.runs.colTrigger') }}</th>
            <th>{{ i18n.t('workflow.runs.colStarted') }}</th>
            <th>{{ i18n.t('workflow.runs.colDuration') }}</th>
            <th>{{ i18n.t('workflow.runs.colProgress') }}</th>
            <th><span class="wfr__sr-only">{{ i18n.t('workflow.runs.open') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id" :data-status="run.status">
            <td>
              <button class="wfr__link" type="button" @click="openWorkflow(run.workflowId)">
                {{ run.workflowName }}
              </button>
            </td>
            <td><span class="wfr__pill" :data-status="run.status">{{ statusLabel(run) }}</span></td>
            <td class="wfr__trigger">{{ run.triggerReason }}</td>
            <td class="wfr__mono" :title="clock(run.startedAt)">{{ started(run) }}</td>
            <td class="wfr__mono">{{ durationOf(run.durationMs, i18n.locale) }}</td>
            <td>
              <span class="wfr__bar">
                <span class="wfr__bar-fill" :style="{ width: progress(run) + '%' }"></span>
              </span>
              <span class="wfr__bar-text">{{ progress(run) }}%</span>
            </td>
            <td class="wfr__row-actions">
              <button class="wfr__btn wfr__btn--sm" type="button" @click="openRun(run.id)">
                {{ i18n.t('workflow.runs.open') }}
              </button>
              <button
                class="wfr__btn wfr__btn--sm"
                type="button"
                :disabled="saving || run.status !== 'running'"
                @click="onStop(run)"
              >{{ i18n.t('workflow.runs.stop') }}</button>
              <button
                class="wfr__btn wfr__btn--sm"
                type="button"
                :disabled="saving"
                @click="onRerun(run)"
              >{{ i18n.t('workflow.runs.rerun') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="wfr__empty">
      <h2 class="wfr__empty-title">{{ i18n.t('workflow.runs.empty') }}</h2>
      <p class="wfr__empty-hint">{{ i18n.t('workflow.runs.emptyHint') }}</p>
      <button class="wfr__btn is-primary" type="button" @click="router.push('/dashboard/workflows')">
        {{ i18n.t('workflow.backToList') }}
      </button>
    </div>

    <p v-else class="wfr__loading">{{ i18n.t('common.loading') }}</p>

    <div v-if="runsHasMore" class="wfr__more">
      <button class="wfr__btn" type="button" :disabled="loading" @click="onMore">
        {{ i18n.t('workflow.runs.loadMore') }}
      </button>
    </div>
  </section>
</template>
