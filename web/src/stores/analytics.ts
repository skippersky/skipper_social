import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as analyticsApi from '../api/analytics';
import { apiErrorI18nKey } from '../api/http';
import type {
  AgentPerformance,
  ChannelSlice,
  DateRange,
  DateRangePreset,
  OverviewStats,
  ResponseTimeStats,
  TopCustomer,
  TrendGranularity,
  TrendPoint
} from '../types';

const DAY_MS = 86_400_000;
export const TOP_CUSTOMER_LIMIT = 5;

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Trailing windows; 'custom' falls back to 30 days and is meant to be overwritten. */
export function presetRange(preset: DateRangePreset, now = Date.now()): DateRange {
  if (preset === 'today') return { from: startOfDay(now), to: now, preset };
  if (preset === '7d') return { from: startOfDay(now - 6 * DAY_MS), to: now, preset };
  return { from: startOfDay(now - 29 * DAY_MS), to: now, preset: preset === 'custom' ? 'custom' : '30d' };
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const dateRange = ref<DateRange>(presetRange('30d'));
  const conversationGranularity = ref<TrendGranularity>('day');
  const messageGranularity = ref<TrendGranularity>('day');

  const overviewStats = ref<OverviewStats | null>(null);
  const conversationTrend = ref<TrendPoint[]>([]);
  const messageTrend = ref<TrendPoint[]>([]);
  const channelDistribution = ref<ChannelSlice[]>([]);
  const responseTimeStats = ref<ResponseTimeStats | null>(null);
  const topCustomers = ref<TopCustomer[]>([]);
  const agentPerformance = ref<AgentPerformance[]>([]);

  const error = ref<string | null>(null);
  const pending = ref(0);
  /** Slice name -> range/granularity signature it was loaded for (request cache). */
  const loadedFor = ref<Record<string, string>>({});

  const loading = computed(() => pending.value > 0);
  const rangeSignature = computed(() => `${dateRange.value.from}:${dateRange.value.to}`);
  const hasDemoData = computed(() => overviewStats.value?.demo === true);

  const totalCustomers = computed(() => overviewStats.value?.totalCustomers ?? 0);
  const totalConversations = computed(() => overviewStats.value?.totalConversations ?? 0);
  const totalMessages = computed(() => overviewStats.value?.totalMessages ?? 0);
  const unreadCount = computed(() => overviewStats.value?.unreadCount ?? 0);
  const averageResponseTime = computed(() => overviewStats.value?.averageResponseMs ?? null);

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function params(granularity?: TrendGranularity): analyticsApi.AnalyticsParams {
    const next: analyticsApi.AnalyticsParams = { range: { ...dateRange.value } };
    if (granularity) next.granularity = granularity;
    return next;
  }

  /** Runs one slice unless it was already loaded for the same signature. */
  async function run(slice: string, signature: string, task: () => Promise<void>, force: boolean): Promise<boolean> {
    if (!force && loadedFor.value[slice] === signature) return true;
    if (pending.value === 0) error.value = null;
    pending.value += 1;
    try {
      await task();
      loadedFor.value = { ...loadedFor.value, [slice]: signature };
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      pending.value -= 1;
    }
  }

  async function fetchOverviewStats(force = false): Promise<boolean> {
    return run('overview', rangeSignature.value, async () => {
      overviewStats.value = await analyticsApi.getOverviewStats(params());
    }, force);
  }

  async function fetchConversationTrend(force = false): Promise<boolean> {
    const signature = `${rangeSignature.value}:${conversationGranularity.value}`;
    return run('conversationTrend', signature, async () => {
      conversationTrend.value = await analyticsApi.getConversationTrend(params(conversationGranularity.value));
    }, force);
  }

  async function fetchMessageTrend(force = false): Promise<boolean> {
    const signature = `${rangeSignature.value}:${messageGranularity.value}`;
    return run('messageTrend', signature, async () => {
      messageTrend.value = await analyticsApi.getMessageTrend(params(messageGranularity.value));
    }, force);
  }

  async function fetchChannelDistribution(force = false): Promise<boolean> {
    return run('channelDistribution', rangeSignature.value, async () => {
      channelDistribution.value = await analyticsApi.getChannelDistribution(params());
    }, force);
  }

  async function fetchResponseTimeStats(force = false): Promise<boolean> {
    return run('responseTime', rangeSignature.value, async () => {
      responseTimeStats.value = await analyticsApi.getResponseTimeStats(params());
    }, force);
  }

  async function fetchAgentPerformance(force = false): Promise<boolean> {
    return run('agentPerformance', rangeSignature.value, async () => {
      agentPerformance.value = await analyticsApi.getAgentPerformance(params());
    }, force);
  }

  async function fetchTopCustomers(force = false): Promise<boolean> {
    return run('topCustomers', rangeSignature.value, async () => {
      topCustomers.value = await analyticsApi.getTopCustomers({ ...params(), limit: TOP_CUSTOMER_LIMIT });
    }, force);
  }

  async function refreshAll(force = false): Promise<boolean> {
    const results = await Promise.all([
      fetchOverviewStats(force),
      fetchConversationTrend(force),
      fetchMessageTrend(force),
      fetchChannelDistribution(force),
      fetchResponseTimeStats(force),
      fetchTopCustomers(force),
      fetchAgentPerformance(force)
    ]);
    return results.every(Boolean);
  }

  function setDateRange(range: DateRange): void {
    dateRange.value = { ...range };
  }

  function setConversationGranularity(granularity: TrendGranularity): void {
    conversationGranularity.value = granularity;
  }

  function setMessageGranularity(granularity: TrendGranularity): void {
    messageGranularity.value = granularity;
  }

  /** Drops the request cache so the next refresh hits the api again. */
  function invalidate(): void {
    loadedFor.value = {};
  }

  return {
    dateRange,
    conversationGranularity,
    messageGranularity,
    overviewStats,
    conversationTrend,
    messageTrend,
    channelDistribution,
    responseTimeStats,
    topCustomers,
    agentPerformance,
    loading,
    error,
    loadedFor,
    rangeSignature,
    hasDemoData,
    totalCustomers,
    totalConversations,
    totalMessages,
    unreadCount,
    averageResponseTime,
    fetchOverviewStats,
    fetchConversationTrend,
    fetchMessageTrend,
    fetchChannelDistribution,
    fetchResponseTimeStats,
    fetchAgentPerformance,
    fetchTopCustomers,
    refreshAll,
    setDateRange,
    setConversationGranularity,
    setMessageGranularity,
    invalidate
  };
});
