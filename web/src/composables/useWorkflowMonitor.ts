/**
 * Workflow run monitor (Sprint 12).
 *
 * Owns the run list filters and the live poll. The spec asks for a probe every
 * two seconds, so the poller runs on a self scheduling timeout rather than a
 * fixed interval: that lets a failed probe back off exponentially up to
 * RUN_POLL_MAX_INTERVAL_MS instead of hammering a backend that is already
 * struggling, and it lets the monitor stop the instant the view unmounts.
 */
import { computed, onScopeDispose, ref } from 'vue';
import { useWorkflowStore, WORKFLOW_RUN_PAGE_SIZE } from '../stores/workflow';
import { formatDuration, nodeStateCounts, progressOf } from '../lib/workflowRun';
import { RUN_POLL_INTERVAL_MS, RUN_POLL_MAX_INTERVAL_MS } from '../types';
import type { UiLocale } from '../i18n/messages';
import type {
  NodeRunState,
  WorkflowRun,
  WorkflowRunListParams,
  WorkflowRunStats,
  WorkflowRunStatus
} from '../types';

export type RunStatusFilter = WorkflowRunStatus | 'all';

export const RUN_STATUS_FILTERS: RunStatusFilter[] = [
  'all',
  'running',
  'succeeded',
  'failed',
  'stopped'
];

/**
 * Exponential backoff for the poller. Failure 0 is the nominal 2s cadence; each
 * consecutive failure doubles it until the 30s ceiling, and one success resets.
 */
export function nextPollInterval(failures: number): number {
  if (failures <= 0) return RUN_POLL_INTERVAL_MS;
  return Math.min(RUN_POLL_INTERVAL_MS * Math.pow(2, failures), RUN_POLL_MAX_INTERVAL_MS);
}

export function useWorkflowMonitor() {
  const store = useWorkflowStore();

  const statusFilter = ref<RunStatusFilter>('all');
  const workflowId = ref<string | null>(null);
  const from = ref<number | null>(null);
  const to = ref<number | null>(null);
  const polling = ref(false);
  const failures = ref(0);

  const runs = computed(() => store.runs);
  const runsTotal = computed(() => store.runsTotal);
  const runsHasMore = computed(() => store.runsHasMore);
  const currentRun = computed(() => store.currentRun);
  const runStats = computed<WorkflowRunStats>(() => store.runStats);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const hasDemoData = computed(() => store.runsAreDemo);
  const runningRuns = computed(() => runs.value.filter((run) => run.status === 'running'));
  const progress = computed(() => (currentRun.value ? progressOf(currentRun.value) : 0));
  const stateCounts = computed<Record<NodeRunState, number> | null>(() =>
    currentRun.value ? nodeStateCounts(currentRun.value) : null
  );

  let timer: ReturnType<typeof setTimeout> | null = null;

  function runParams(offset = 0): WorkflowRunListParams {
    const params: WorkflowRunListParams = { limit: WORKFLOW_RUN_PAGE_SIZE, offset };
    if (workflowId.value) params.workflowId = workflowId.value;
    if (statusFilter.value !== 'all') params.status = statusFilter.value;
    if (from.value !== null) params.from = from.value;
    if (to.value !== null) params.to = to.value;
    return params;
  }

  function setWorkflowScope(id: string | null): void {
    workflowId.value = id;
  }

  function setDateRange(nextFrom: number | null, nextTo: number | null): void {
    from.value = nextFrom;
    to.value = nextTo;
  }

  async function loadRuns(): Promise<WorkflowRun[]> {
    return store.fetchRuns(runParams(0));
  }

  /** Alias kept because the spec names this entry point refresh. */
  const refresh = loadRuns;

  async function filterStatus(next: RunStatusFilter): Promise<WorkflowRun[]> {
    statusFilter.value = next;
    return loadRuns();
  }

  async function loadMoreRuns(): Promise<void> {
    await store.loadMoreRuns(runParams(runs.value.length));
  }

  async function loadStats(): Promise<WorkflowRunStats> {
    const params = runParams(0);
    delete params.offset;
    delete params.limit;
    return store.fetchRunStats(params);
  }

  async function openRun(runId: string): Promise<WorkflowRun | null> {
    return store.fetchRun(runId);
  }

  async function stopRun(runId: string): Promise<WorkflowRun | null> {
    return store.stopRun(runId);
  }

  /** Re-runs by asking the engine for a fresh instance of the same workflow. */
  async function rerun(targetWorkflowId: string): Promise<WorkflowRun | null> {
    return store.triggerRun(targetWorkflowId);
  }

  function durationOf(ms: number, locale?: UiLocale): string {
    return formatDuration(ms, locale);
  }

  /* ----------------------------------------------------------------- polling */

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** One probe. Resolves so tests can await a single tick deterministically. */
  async function tick(): Promise<void> {
    if (currentRun.value) {
      const before = currentRun.value;
      const next = await store.pollRun(before.id);
      failures.value = next && next.id === before.id ? 0 : failures.value + 1;
    } else {
      const before = runs.value.length;
      const list = await store.pollRuns(runParams(0));
      failures.value = list.length > 0 || before === 0 ? 0 : failures.value + 1;
    }
    if (polling.value) schedule();
  }

  function schedule(): void {
    clearTimer();
    if (!polling.value) return;
    timer = setTimeout(() => {
      void tick();
    }, nextPollInterval(failures.value));
  }

  /** Starts the monitor loop; safe to call twice. */
  function startPolling(intervalMs: number = RUN_POLL_INTERVAL_MS): void {
    polling.value = true;
    failures.value = 0;
    clearTimer();
    timer = setTimeout(() => {
      void tick();
    }, intervalMs);
  }

  function stopPolling(): void {
    polling.value = false;
    failures.value = 0;
    clearTimer();
  }

  /** Poll only while something can still change; a finished run needs no probe. */
  function syncPollingWithRuns(): void {
    const live = store.hasRunningRuns || currentRun.value?.status === 'running';
    if (live) {
      if (!polling.value) startPolling();
    } else {
      stopPolling();
    }
  }

  onScopeDispose(stopPolling);

  return {
    runs,
    runsTotal,
    runsHasMore,
    currentRun,
    runStats,
    loading,
    saving,
    error,
    hasDemoData,
    runningRuns,
    progress,
    stateCounts,
    polling,
    failures,
    statusFilter,
    workflowId,
    from,
    to,
    runParams,
    setWorkflowScope,
    setDateRange,
    loadRuns,
    refresh,
    filterStatus,
    loadMoreRuns,
    loadStats,
    openRun,
    stopRun,
    rerun,
    durationOf,
    startPolling,
    stopPolling,
    tick,
    syncPollingWithRuns
  };
}
