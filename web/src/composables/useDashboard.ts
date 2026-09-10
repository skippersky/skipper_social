import { computed, getCurrentScope, onScopeDispose } from 'vue';
import { useAnalyticsStore } from '../stores/analytics';
import type { DateRange } from '../types';

/** Range changes settle for 300ms before every slice reloads (spec: debounce). */
export const DASHBOARD_DEBOUNCE_MS = 300;

/** Dashboard orchestration: loading, refresh and debounced range changes. */
export function useDashboard() {
  const store = useAnalyticsStore();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const overviewStats = computed(() => store.overviewStats);
  const conversationTrend = computed(() => store.conversationTrend);
  const messageTrend = computed(() => store.messageTrend);
  const channelDistribution = computed(() => store.channelDistribution);
  const responseTimeStats = computed(() => store.responseTimeStats);
  const topCustomers = computed(() => store.topCustomers);
  const agentPerformance = computed(() => store.agentPerformance);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const hasDemoData = computed(() => store.hasDemoData);
  const dateRange = computed(() => store.dateRange);

  function loadOverviewStats(force = false): Promise<boolean> {
    return store.fetchOverviewStats(force);
  }

  function loadConversationTrend(force = false): Promise<boolean> {
    return store.fetchConversationTrend(force);
  }

  function loadMessageTrend(force = false): Promise<boolean> {
    return store.fetchMessageTrend(force);
  }

  function loadChannelDistribution(force = false): Promise<boolean> {
    return store.fetchChannelDistribution(force);
  }

  function loadResponseTimeStats(force = false): Promise<boolean> {
    return store.fetchResponseTimeStats(force);
  }

  function loadTopCustomers(force = false): Promise<boolean> {
    return store.fetchTopCustomers(force);
  }

  function loadAgentPerformance(force = false): Promise<boolean> {
    return store.fetchAgentPerformance(force);
  }

  function refreshAll(force = false): Promise<boolean> {
    return store.refreshAll(force);
  }

  function cancelScheduledRefresh(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleRefresh(): void {
    cancelScheduledRefresh();
    timer = setTimeout(() => {
      timer = null;
      void refreshAll(true);
    }, DASHBOARD_DEBOUNCE_MS);
  }

  /** Sets the window without reloading; pairs with an explicit refreshAll(). */
  function setRange(range: DateRange): void {
    store.setDateRange(range);
  }

  /** Applies a new window and reloads everything once the user stops changing it. */
  function applyRange(range: DateRange): void {
    store.setDateRange(range);
    scheduleRefresh();
  }

  if (getCurrentScope()) onScopeDispose(cancelScheduledRefresh);

  return {
    overviewStats,
    conversationTrend,
    messageTrend,
    channelDistribution,
    responseTimeStats,
    topCustomers,
    agentPerformance,
    loading,
    error,
    hasDemoData,
    dateRange,
    loadOverviewStats,
    loadConversationTrend,
    loadMessageTrend,
    loadChannelDistribution,
    loadResponseTimeStats,
    loadTopCustomers,
    loadAgentPerformance,
    refreshAll,
    scheduleRefresh,
    cancelScheduledRefresh,
    setRange,
    applyRange
  };
}
