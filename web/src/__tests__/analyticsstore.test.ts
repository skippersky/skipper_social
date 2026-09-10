import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as analyticsApi from '../api/analytics';
import { ApiError } from '../api/http';
import { TOP_CUSTOMER_LIMIT, presetRange, useAnalyticsStore } from '../stores/analytics';
import type { OverviewStats, TrendPoint } from '../types';

vi.mock('../api/analytics', () => ({
  getOverviewStats: vi.fn(),
  getConversationTrend: vi.fn(),
  getMessageTrend: vi.fn(),
  getChannelDistribution: vi.fn(),
  getResponseTimeStats: vi.fn(),
  getAgentPerformance: vi.fn(),
  getTopCustomers: vi.fn()
}));

const DAY_MS = 86_400_000;
const NOON = new Date(2026, 8, 8, 12, 0, 0).getTime();

const overview: OverviewStats = {
  totalCustomers: 8,
  totalConversations: 6,
  totalMessages: 37,
  unreadCount: 3,
  averageResponseMs: 10_071_429,
  customersChange: 150,
  conversationsChange: null,
  messagesChange: null,
  demo: true
};

const trend: TrendPoint[] = [
  { bucket: '2026-09-07', timestamp: new Date(2026, 8, 7).getTime(), count: 4, inbound: 3, outbound: 1 }
];

/** Every slice answers so refreshAll exercises the full dashboard load. */
function stubHappyPath(): void {
  vi.mocked(analyticsApi.getOverviewStats).mockResolvedValue(overview);
  vi.mocked(analyticsApi.getConversationTrend).mockResolvedValue(trend);
  vi.mocked(analyticsApi.getMessageTrend).mockResolvedValue(trend);
  vi.mocked(analyticsApi.getChannelDistribution).mockResolvedValue([
    { platform: 'whatsapp', conversations: 3, percent: 50 }
  ]);
  vi.mocked(analyticsApi.getResponseTimeStats).mockResolvedValue({
    averageMs: 10_071_429,
    medianMs: 10_800_000,
    p90Ms: 10_800_000,
    p95Ms: 10_800_000,
    samples: 14,
    targetMinutes: 240
  });
  vi.mocked(analyticsApi.getAgentPerformance).mockResolvedValue([
    {
      agentId: 'agent-1',
      name: 'Neema K.',
      conversations: 3,
      messages: 31,
      averageResponseMs: 60_000,
      satisfaction: 4.8
    }
  ]);
  vi.mocked(analyticsApi.getTopCustomers).mockResolvedValue([
    { id: 'u-1', name: 'Amani Juma', conversations: 1, messages: 28, lastContactAt: 1 }
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  stubHappyPath();
});

describe('presetRange', () => {
  it('builds trailing windows for today, 7d and 30d', () => {
    expect(presetRange('today', NOON)).toEqual({
      from: new Date(2026, 8, 8).getTime(),
      to: NOON,
      preset: 'today'
    });
    expect(presetRange('7d', NOON).from).toBe(new Date(2026, 8, 2).getTime());
    expect(presetRange('30d', NOON).from).toBe(new Date(2026, 7, 10).getTime());
    expect(presetRange('30d', NOON).to - presetRange('30d', NOON).from).toBeGreaterThan(29 * DAY_MS);
  });

  it('keeps the 30 day window but tags custom ranges', () => {
    const custom = presetRange('custom', NOON);
    const trailing = presetRange('30d', NOON);

    expect(custom.preset).toBe('custom');
    expect(custom.from).toBe(trailing.from);
    expect(custom.to).toBe(trailing.to);
  });
});

describe('analytics store', () => {
  it('starts empty with a 30 day window and day buckets', () => {
    const store = useAnalyticsStore();

    expect(store.dateRange.preset).toBe('30d');
    expect(store.conversationGranularity).toBe('day');
    expect(store.messageGranularity).toBe('day');
    expect(store.overviewStats).toBeNull();
    expect(store.conversationTrend).toEqual([]);
    expect(store.messageTrend).toEqual([]);
    expect(store.channelDistribution).toEqual([]);
    expect(store.responseTimeStats).toBeNull();
    expect(store.topCustomers).toEqual([]);
    expect(store.agentPerformance).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasDemoData).toBe(false);
    expect(store.totalCustomers).toBe(0);
    expect(store.totalConversations).toBe(0);
    expect(store.totalMessages).toBe(0);
    expect(store.unreadCount).toBe(0);
    expect(store.averageResponseTime).toBeNull();
  });

  it('refreshAll loads every slice and feeds the getters', async () => {
    const store = useAnalyticsStore();

    await expect(store.refreshAll()).resolves.toBe(true);

    expect(store.overviewStats).toEqual(overview);
    expect(store.conversationTrend).toEqual(trend);
    expect(store.messageTrend).toEqual(trend);
    expect(store.channelDistribution).toHaveLength(1);
    expect(store.responseTimeStats?.samples).toBe(14);
    expect(store.topCustomers[0]?.id).toBe('u-1');
    expect(store.agentPerformance[0]?.agentId).toBe('agent-1');
    expect(store.totalCustomers).toBe(8);
    expect(store.totalConversations).toBe(6);
    expect(store.totalMessages).toBe(37);
    expect(store.unreadCount).toBe(3);
    expect(store.averageResponseTime).toBe(10_071_429);
    expect(store.hasDemoData).toBe(true);
    expect(store.loading).toBe(false);
  });

  it('caches each slice by range signature', async () => {
    const store = useAnalyticsStore();

    await store.refreshAll();
    await store.refreshAll();

    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyticsApi.getTopCustomers)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analyticsApi.getAgentPerformance)).toHaveBeenCalledTimes(1);
  });

  it('force refresh bypasses the cache', async () => {
    const store = useAnalyticsStore();

    await store.refreshAll();
    await store.refreshAll(true);

    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyticsApi.getChannelDistribution)).toHaveBeenCalledTimes(2);
  });

  it('treats granularity as part of the trend cache key', async () => {
    const store = useAnalyticsStore();

    await store.refreshAll();
    store.setConversationGranularity('week');
    await store.fetchConversationTrend();
    await store.fetchMessageTrend();

    expect(vi.mocked(analyticsApi.getConversationTrend)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyticsApi.getConversationTrend).mock.calls[1]?.[0]?.granularity).toBe('week');
    expect(vi.mocked(analyticsApi.getMessageTrend)).toHaveBeenCalledTimes(1);
  });

  it('copies the window handed to setDateRange and re-keys the cache', async () => {
    const store = useAnalyticsStore();
    const before = store.rangeSignature;
    const next = { from: 1000, to: 2000, preset: 'custom' as const };

    store.setDateRange(next);
    next.from = 9999;

    expect(store.dateRange).toEqual({ from: 1000, to: 2000, preset: 'custom' });
    expect(store.rangeSignature).toBe('1000:2000');
    expect(store.rangeSignature).not.toBe(before);

    await store.fetchOverviewStats();
    await store.fetchOverviewStats();
    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(1);
  });

  it('invalidate drops the cache so the next fetch reloads', async () => {
    const store = useAnalyticsStore();

    await store.fetchOverviewStats();
    expect(Object.keys(store.loadedFor)).toContain('overview');

    store.invalidate();
    expect(store.loadedFor).toEqual({});

    await store.fetchOverviewStats();
    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(2);
  });

  it('requests the configured top customer limit', async () => {
    const store = useAnalyticsStore();

    await store.fetchTopCustomers();

    expect(TOP_CUSTOMER_LIMIT).toBe(5);
    expect(vi.mocked(analyticsApi.getTopCustomers).mock.calls[0]?.[0]?.limit).toBe(TOP_CUSTOMER_LIMIT);
  });

  it('maps a timeout onto api.timeout and reports false', async () => {
    vi.mocked(analyticsApi.getOverviewStats).mockRejectedValue(new ApiError('TIMEOUT', ''));
    const store = useAnalyticsStore();

    await expect(store.fetchOverviewStats()).resolves.toBe(false);
    expect(store.error).toBe('api.timeout');
    expect(store.loading).toBe(false);
  });

  it('maps a 5xx failure onto api.500 and fails refreshAll', async () => {
    vi.mocked(analyticsApi.getChannelDistribution).mockRejectedValue(new ApiError('HTTP_500', ''));
    const store = useAnalyticsStore();

    await expect(store.refreshAll()).resolves.toBe(false);
    expect(store.error).toBe('api.500');
    expect(store.overviewStats).toEqual(overview);
  });

  it('falls back to api.network for non ApiError failures', async () => {
    vi.mocked(analyticsApi.getOverviewStats).mockRejectedValue(new Error('offline'));
    const store = useAnalyticsStore();

    await store.fetchOverviewStats();

    expect(store.error).toBe('api.network');
    expect(store.overviewStats).toBeNull();
  });

  it('clears a previous error once a later load succeeds', async () => {
    vi.mocked(analyticsApi.getOverviewStats).mockRejectedValueOnce(new Error('offline'));
    const store = useAnalyticsStore();

    await store.fetchOverviewStats();
    expect(store.error).toBe('api.network');

    await store.fetchOverviewStats();
    expect(store.error).toBeNull();
    expect(store.overviewStats).toEqual(overview);
  });

  it('tracks hasDemoData from the overview demo flag', async () => {
    const store = useAnalyticsStore();

    await store.fetchOverviewStats();
    expect(store.hasDemoData).toBe(true);

    vi.mocked(analyticsApi.getOverviewStats).mockResolvedValue({ ...overview, demo: false });
    await store.fetchOverviewStats(true);
    expect(store.hasDemoData).toBe(false);
  });
});
