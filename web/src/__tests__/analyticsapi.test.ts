import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../api/analytics';
import { ApiError } from '../api/http';
import { presetRange } from '../stores/analytics';
import type { DateRange } from '../types';

const DAY_MS = 86_400_000;

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: ok, code: ok ? 'OK' : 'HTTP_' + status, message: '', data })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

/** Trailing 30 day window, matching what the dashboard asks for on first paint. */
function last30(): DateRange {
  return presetRange('30d');
}

function queryOf(url: unknown): URLSearchParams {
  const text = String(url);
  return new URLSearchParams(text.slice(text.indexOf('?') + 1));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('analytics api range helper', () => {
  it('builds a trailing 30 day fallback window', () => {
    const now = new Date(2026, 8, 8, 9, 30).getTime();
    const range = analyticsApi.fallbackRange(now);

    expect(range.preset).toBe('30d');
    expect(range.to).toBe(now);
    expect(range.from).toBe(now - 29 * DAY_MS);
  });

  it('defaults to the fallback window when the caller passes nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const earliest = Date.now() - 29 * DAY_MS - 5_000;

    await analyticsApi.getOverviewStats();
    const params = queryOf(fetchMock.mock.calls[0][0]);
    const from = Number(params.get('from'));
    const to = Number(params.get('to'));

    expect(from).toBeGreaterThanOrEqual(earliest);
    expect(to - from).toBe(29 * DAY_MS);
    expect(params.get('granularity')).toBeNull();
  });
});

describe('analytics api demo aggregation', () => {
  it('aggregates the overview from the seeded inbox and directory', async () => {
    offline();
    const stats = await analyticsApi.getOverviewStats({ range: last30() });

    expect(stats).toMatchObject({
      totalCustomers: 8,
      totalConversations: 6,
      totalMessages: 37,
      unreadCount: 3,
      demo: true,
      conversationsChange: null,
      messagesChange: null
    });
    expect(stats.averageResponseMs).toBeGreaterThan(0);
    expect(stats.customersChange).toBe(150);
  });

  it('spreads the demo message trend over 30 continuous day buckets', async () => {
    offline();
    const points = await analyticsApi.getMessageTrend({ range: last30(), granularity: 'day' });

    expect(points).toHaveLength(30);
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(37);
    for (const point of points) {
      expect((point.inbound ?? 0) + (point.outbound ?? 0)).toBe(point.count);
      expect(point.count).toBeGreaterThanOrEqual(0);
    }
    const stamps = points.map((point) => point.timestamp);
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    expect(points[0].bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rolls the trend up to coarser buckets without losing messages', async () => {
    offline();
    const range = last30();
    const days = await analyticsApi.getMessageTrend({ range, granularity: 'day' });
    const weeks = await analyticsApi.getMessageTrend({ range, granularity: 'week' });
    const months = await analyticsApi.getMessageTrend({ range, granularity: 'month' });

    expect(weeks.length).toBeLessThan(days.length);
    expect(months.length).toBeLessThanOrEqual(weeks.length);
    expect(weeks.reduce((sum, point) => sum + point.count, 0)).toBe(37);
    expect(months.reduce((sum, point) => sum + point.count, 0)).toBe(37);
    expect(weeks[0].bucket.endsWith('w')).toBe(true);
    expect(months[0].bucket).toMatch(/^\d{4}-\d{2}$/);
  });

  it('counts distinct conversations per bucket in the conversation trend', async () => {
    offline();
    const points = await analyticsApi.getConversationTrend({ range: last30(), granularity: 'day' });

    expect(points).toHaveLength(30);
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.count).toBeLessThanOrEqual(6);
      expect(point.inbound).toBeUndefined();
    }
  });

  it('ranks the demo channel mix by conversation share', async () => {
    offline();
    const slices = await analyticsApi.getChannelDistribution({ range: last30() });

    expect(slices).toEqual([
      { platform: 'whatsapp', conversations: 3, percent: 50 },
      { platform: 'facebook', conversations: 1, percent: 16.7 },
      { platform: 'instagram', conversations: 1, percent: 16.7 },
      { platform: 'tiktok', conversations: 1, percent: 16.7 }
    ]);
    expect(Math.abs(slices.reduce((sum, slice) => sum + slice.percent, 0) - 100)).toBeLessThan(0.5);
  });

  it('derives response time percentiles against the four hour target', async () => {
    offline();
    const stats = await analyticsApi.getResponseTimeStats({ range: last30() });

    expect(stats.samples).toBe(14);
    expect(stats.targetMinutes).toBe(240);
    expect(stats.averageMs).toBeGreaterThan(0);
    expect(stats.medianMs).not.toBeNull();
    expect(stats.p90Ms! >= stats.medianMs!).toBe(true);
    expect(stats.p95Ms! >= stats.p90Ms!).toBe(true);
  });

  it('returns the busiest demo customers first and honours the limit', async () => {
    offline();
    const range = last30();
    const top = await analyticsApi.getTopCustomers({ range, limit: 5 });

    expect(top.map((row) => row.id)).toEqual(['u-1', 'u-2', 'u-3', 'u-4', 'u-6']);
    expect(top[0]).toMatchObject({ name: 'Amani Juma', conversations: 1, messages: 28 });
    const counts = top.map((row) => row.messages);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    for (const row of top) expect(row.lastContactAt).not.toBeNull();

    const limited = await analyticsApi.getTopCustomers({ range, limit: 2 });
    expect(limited.map((row) => row.id)).toEqual(['u-1', 'u-2']);

    const floored = await analyticsApi.getTopCustomers({ range, limit: 0 });
    expect(floored).toHaveLength(1);
  });

  it('splits the demo conversations across two staff members', async () => {
    offline();
    const agents = await analyticsApi.getAgentPerformance({ range: last30() });

    expect(agents.map((agent) => agent.name)).toEqual(['Neema K.', 'Joseph M.']);
    expect(agents.reduce((sum, agent) => sum + agent.conversations, 0)).toBe(6);
    expect(agents.reduce((sum, agent) => sum + agent.messages, 0)).toBe(37);
    expect(agents[0].satisfaction).toBe(4.8);
    expect(agents[1].satisfaction).toBe(4.6);
  });

  it('reports an empty window when nothing happened inside it', async () => {
    offline();
    const quiet: DateRange = { from: Date.now() - 400 * DAY_MS, to: Date.now() - 380 * DAY_MS, preset: 'custom' };

    const stats = await analyticsApi.getOverviewStats({ range: quiet });
    expect(stats).toMatchObject({ totalConversations: 0, totalMessages: 0, conversationsChange: null, demo: true });
    expect(await analyticsApi.getChannelDistribution({ range: quiet })).toEqual([]);
    expect(await analyticsApi.getTopCustomers({ range: quiet })).toEqual([]);
    expect(await analyticsApi.getResponseTimeStats({ range: quiet })).toMatchObject({
      averageMs: null,
      medianMs: null,
      p90Ms: null,
      samples: 0
    });
    const agents = await analyticsApi.getAgentPerformance({ range: quiet });
    expect(agents.every((agent) => agent.conversations === 0 && agent.satisfaction === null)).toBe(true);
  });
});

describe('analytics api backend passthrough', () => {
  it('serialises the window, granularity and limit as query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const range: DateRange = { from: 1_700_000_000_000, to: 1_700_086_400_000, preset: '7d' };

    await analyticsApi.getMessageTrend({ range, granularity: 'week' });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/v1/analytics/messages/trend?from=1700000000000&to=1700086400000&granularity=week'
    );

    await analyticsApi.getTopCustomers({ range, limit: 3 });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      '/api/v1/analytics/customers/top?from=1700000000000&to=1700086400000&limit=3'
    );

    await analyticsApi.getOverviewStats({ range });
    expect(String(fetchMock.mock.calls[2][0])).toBe('/api/v1/analytics/overview?from=1700000000000&to=1700086400000');
  });

  it('calls the documented endpoint for every slice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);
    const range: DateRange = { from: 1, to: 2, preset: 'today' };

    await analyticsApi.getConversationTrend({ range, granularity: 'month' });
    await analyticsApi.getChannelDistribution({ range });
    await analyticsApi.getResponseTimeStats({ range });
    await analyticsApi.getAgentPerformance({ range });

    expect(fetchMock.mock.calls.map((call) => String(call[0]).split('?')[0])).toEqual([
      '/api/v1/analytics/conversations/trend',
      '/api/v1/analytics/channels/distribution',
      '/api/v1/analytics/response-time',
      '/api/v1/analytics/agents/performance'
    ]);
    expect(queryOf(fetchMock.mock.calls[0][0]).get('granularity')).toBe('month');
  });

  it('returns backend payloads untouched', async () => {
    const overview = {
      totalCustomers: 3,
      totalConversations: 2,
      totalMessages: 9,
      unreadCount: 1,
      averageResponseMs: 60_000,
      customersChange: 12.5,
      conversationsChange: -4,
      messagesChange: null
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(overview)));

    const stats = await analyticsApi.getOverviewStats({ range: presetRange('7d') });
    expect(stats).toEqual(overview);
    expect(stats.demo).toBeUndefined();
  });

  it('falls back to demo data when the endpoint is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));

    const stats = await analyticsApi.getOverviewStats({ range: last30() });
    expect(stats).toMatchObject({ demo: true, totalMessages: 37 });
  });

  it('surfaces server errors instead of masking them with demo data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyticsApi.getMessageTrend({ range: last30(), granularity: 'day' })).rejects.toBeInstanceOf(ApiError);
    const failure: unknown = await analyticsApi.getChannelDistribution({ range: last30() }).catch((error) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('HTTP_500');
    expect(fetchMock.mock.calls.length).toBe(4);
  });
});
