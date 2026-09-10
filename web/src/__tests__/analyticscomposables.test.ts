import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import * as analyticsApi from '../api/analytics';
import {
  CHART_PALETTE,
  bucketLabel,
  generateBarChartOption,
  generateGaugeChartOption,
  generateLineChartOption,
  generatePieChartOption,
  useChart
} from '../composables/useChart';
import {
  DATE_RANGE_PRESETS,
  MAX_RANGE_DAYS,
  fromInputValue,
  toInputValue,
  useDateRange
} from '../composables/useDateRange';
import { DASHBOARD_DEBOUNCE_MS, useDashboard } from '../composables/useDashboard';
import { useAnalyticsStore } from '../stores/analytics';
import type { ChannelSlice, TrendPoint } from '../types';

vi.mock('../api/analytics', () => ({
  getOverviewStats: vi.fn(),
  getConversationTrend: vi.fn(),
  getMessageTrend: vi.fn(),
  getChannelDistribution: vi.fn(),
  getResponseTimeStats: vi.fn(),
  getAgentPerformance: vi.fn(),
  getTopCustomers: vi.fn()
}));

type Option = Record<string, unknown>;
type Series = Record<string, unknown>;

const DAY_MS = 86_400_000;
const BASE = new Date(2026, 8, 5).getTime();

const points: TrendPoint[] = [0, 1, 2].map((offset) => ({
  bucket: '2026-09-0' + (5 + offset),
  timestamp: BASE + offset * DAY_MS,
  count: offset + 1,
  inbound: offset,
  outbound: 1
}));

function seriesOf(option: Option): Series[] {
  return option.series as Series[];
}

function firstSeries(option: Option): Series {
  const list = seriesOf(option);
  return list[0] as Series;
}

function stubApi(): void {
  vi.mocked(analyticsApi.getOverviewStats).mockResolvedValue({
    totalCustomers: 8,
    totalConversations: 6,
    totalMessages: 37,
    unreadCount: 3,
    averageResponseMs: 60_000,
    customersChange: 150,
    conversationsChange: null,
    messagesChange: null,
    demo: true
  });
  vi.mocked(analyticsApi.getConversationTrend).mockResolvedValue(points);
  vi.mocked(analyticsApi.getMessageTrend).mockResolvedValue(points);
  vi.mocked(analyticsApi.getChannelDistribution).mockResolvedValue([]);
  vi.mocked(analyticsApi.getResponseTimeStats).mockResolvedValue({
    averageMs: 60_000,
    medianMs: 60_000,
    p90Ms: 60_000,
    p95Ms: 60_000,
    samples: 4,
    targetMinutes: 240
  });
  vi.mocked(analyticsApi.getAgentPerformance).mockResolvedValue([]);
  vi.mocked(analyticsApi.getTopCustomers).mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  stubApi();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useChart palette and labels', () => {
  it('uses the warm brand palette from the design system', () => {
    expect(CHART_PALETTE).toHaveLength(6);
    expect(CHART_PALETTE[0]).toBe('#F4633A');
    expect(CHART_PALETTE[1]).toBe('#FFB238');
    expect(useChart().palette).toBe(CHART_PALETTE);
  });

  it('labels buckets as MM-DD for days and weeks, YYYY-MM for months', () => {
    const point = points[0] as TrendPoint;

    expect(bucketLabel(point, 'day')).toBe('09-05');
    expect(bucketLabel(point, 'week')).toBe('09-05');
    expect(bucketLabel(point, 'month')).toBe('2026-09');
  });

  it('exposes every chart builder', () => {
    const chart = useChart();

    expect(chart.generateLineChartOption).toBe(generateLineChartOption);
    expect(chart.generateBarChartOption).toBe(generateBarChartOption);
    expect(chart.generatePieChartOption).toBe(generatePieChartOption);
    expect(chart.generateGaugeChartOption).toBe(generateGaugeChartOption);
    expect(chart.bucketLabel).toBe(bucketLabel);
  });
});

describe('useChart line and bar options', () => {
  it('fills the area and shows symbols for a short single series', () => {
    const option = generateLineChartOption(points, {
      series: [{ key: 'count', label: 'Conversations' }],
      granularity: 'day'
    });
    const series = firstSeries(option);

    expect(series.type).toBe('line');
    expect(series.smooth).toBe(true);
    expect(series.showSymbol).toBe(true);
    expect(series.areaStyle).toBeTruthy();
    expect(series.data).toEqual([1, 2, 3]);
    expect(option.legend).toBeUndefined();
    expect(option.backgroundColor).toBe('transparent');
    expect(option.color).toEqual(['#F4633A']);
    expect((option.xAxis as Option).data).toEqual(['09-05', '09-06', '09-07']);
    expect((option.xAxis as Option).boundaryGap).toBe(false);
  });

  it('hides symbols past 31 buckets', () => {
    const many: TrendPoint[] = Array.from({ length: 40 }, (_, index) => ({
      bucket: 'b' + index,
      timestamp: BASE + index * DAY_MS,
      count: index
    }));

    const series = firstSeries(
      generateLineChartOption(many, { series: [{ key: 'count', label: 'A' }], granularity: 'day' })
    );

    expect(series.showSymbol).toBe(false);
  });

  it('adds a legend and drops the area fill for multiple series', () => {
    const option = generateLineChartOption(points, {
      series: [
        { key: 'inbound', label: 'Inbound' },
        { key: 'outbound', label: 'Outbound' }
      ],
      granularity: 'day'
    });
    const series = seriesOf(option);

    expect(series).toHaveLength(2);
    expect(option.legend).toBeTruthy();
    expect((option.legend as Option).data).toEqual(['Inbound', 'Outbound']);
    expect(series[0]?.areaStyle).toBeUndefined();
    expect(series[0]?.data).toEqual([0, 1, 2]);
    expect(series[1]?.data).toEqual([1, 1, 1]);
    expect(option.color).toEqual(['#F4633A', '#FFB238']);
  });

  it('honours an explicit series colour over the palette', () => {
    const option = generateLineChartOption(points, {
      series: [{ key: 'count', label: 'A', color: '#15803D' }],
      granularity: 'week'
    });

    expect(option.color).toEqual(['#15803D']);
  });

  it('builds rounded bars with category gaps', () => {
    const option = generateBarChartOption(points, {
      series: [{ key: 'count', label: 'Conversations' }],
      granularity: 'month'
    });
    const series = firstSeries(option);

    expect(series.type).toBe('bar');
    expect((option.xAxis as Option).boundaryGap).toBe(true);
    expect((series.itemStyle as Option).borderRadius).toEqual([6, 6, 0, 0]);
    expect((option.xAxis as Option).data).toEqual(['2026-09', '2026-09', '2026-09']);
  });

  it('keeps the tooltip readable on a light surface', () => {
    const tooltip = generateLineChartOption(points, {
      series: [{ key: 'count', label: 'A' }],
      granularity: 'day'
    }).tooltip as Option;

    expect(tooltip.trigger).toBe('axis');
    expect(tooltip.backgroundColor).toBe('#FFFFFF');
  });
});

describe('useChart pie and gauge options', () => {
  const slices: ChannelSlice[] = [
    { platform: 'whatsapp', conversations: 3, percent: 50 },
    { platform: 'tiktok', conversations: 1, percent: 16.7 }
  ];

  it('renders a donut with localized slice names and a fallback', () => {
    const option = generatePieChartOption(slices, { labels: { whatsapp: 'WhatsApp' } });
    const series = firstSeries(option);

    expect(series.type).toBe('pie');
    expect(series.radius).toEqual(['54%', '76%']);
    expect(series.data).toEqual([
      { name: 'WhatsApp', value: 3, percent: 50 },
      { name: 'tiktok', value: 1, percent: 16.7 }
    ]);
    expect((option.tooltip as Option).formatter).toBe('{b}: {c} ({d}%)');
    expect(option.color).toEqual(CHART_PALETTE);
  });

  it('scales the gauge to the target and clamps the value', () => {
    const series = firstSeries(generateGaugeChartOption(120, { max: 480, unit: 'm' }));

    expect(series.min).toBe(0);
    expect(series.max).toBe(480);
    expect(series.data).toEqual([{ value: 120 }]);
    expect((series.detail as Option).formatter).toBe('{value}m');
  });

  it('clamps over-range values, treats null as zero and floors the max', () => {
    expect(firstSeries(generateGaugeChartOption(9999, { max: 480 })).data).toEqual([{ value: 480 }]);
    expect(firstSeries(generateGaugeChartOption(-5, { max: 480 })).data).toEqual([{ value: 0 }]);
    expect(firstSeries(generateGaugeChartOption(null, { max: 480 })).data).toEqual([{ value: 0 }]);
    expect(firstSeries(generateGaugeChartOption(5, { max: 0 })).max).toBe(1);
    expect((firstSeries(generateGaugeChartOption(5, { max: 480 })).detail as Option).formatter).toBe('{value}');
  });

  it('uses the caller colour for the progress arc', () => {
    const series = firstSeries(generateGaugeChartOption(10, { max: 100, color: '#DC2626' }));

    expect(((series.progress as Option).itemStyle as Option).color).toBe('#DC2626');
  });
});

describe('useDateRange', () => {
  it('publishes the preset list and the range guard', () => {
    expect(DATE_RANGE_PRESETS).toEqual(['today', '7d', '30d', 'custom']);
    expect(MAX_RANGE_DAYS).toBe(366);
  });

  it('converts timestamps to date inputs and back', () => {
    const ts = new Date(2026, 8, 8).getTime();

    expect(toInputValue(ts)).toBe('2026-09-08');
    expect(fromInputValue('2026-09-08')).toBe(ts);
    expect(fromInputValue(' 2026-09-08 ')).toBe(ts);
  });

  it('rejects malformed and impossible dates', () => {
    expect(fromInputValue('2026-13-40')).toBeNull();
    expect(fromInputValue('2026-02-30')).toBeNull();
    expect(fromInputValue('nope')).toBeNull();
    expect(fromInputValue('')).toBeNull();
  });

  it('defaults to the trailing 30 day window and switches presets', () => {
    const picker = useDateRange();

    expect(picker.preset.value).toBe('30d');

    picker.setPreset('7d');
    expect(picker.preset.value).toBe('7d');
    expect(picker.range.value.to - picker.range.value.from).toBeLessThan(7 * DAY_MS);

    picker.setPreset('today');
    expect(picker.preset.value).toBe('today');
    expect(picker.range.value.to - picker.range.value.from).toBeLessThan(DAY_MS);
  });

  it('reveals the custom inputs without moving the window', () => {
    const picker = useDateRange();
    const before = picker.range.value.from;

    picker.setPreset('custom');

    expect(picker.preset.value).toBe('custom');
    expect(picker.range.value.from).toBe(before);
    expect(picker.customError.value).toBeNull();
  });

  it('closes a custom window at the end of the selected day', () => {
    const picker = useDateRange();

    expect(picker.applyCustom('2026-08-01', '2026-08-10')).toBe(true);
    expect(picker.customError.value).toBeNull();
    expect(picker.range.value).toEqual({
      from: new Date(2026, 7, 1).getTime(),
      to: new Date(2026, 7, 11).getTime() - 1,
      preset: 'custom'
    });
  });

  it('validates custom windows', () => {
    const picker = useDateRange();

    expect(picker.applyCustom('2026-02-30', '2026-03-01')).toBe(false);
    expect(picker.customError.value).toBe('analytics.rangeInvalid');

    expect(picker.applyCustom('2026-08-10', '2026-08-01')).toBe(false);
    expect(picker.customError.value).toBe('analytics.rangeReversed');

    expect(picker.applyCustom('2024-01-01', '2026-01-01')).toBe(false);
    expect(picker.customError.value).toBe('analytics.rangeTooLong');
  });

  it('copies an injected range and syncs the inputs', () => {
    const picker = useDateRange({ from: 1000, to: 2000, preset: '7d' });
    expect(picker.range.value).toEqual({ from: 1000, to: 2000, preset: '7d' });

    picker.setDateRange({
      from: new Date(2026, 7, 1).getTime(),
      to: new Date(2026, 7, 5).getTime(),
      preset: 'custom'
    });

    expect(picker.customFrom.value).toBe('2026-08-01');
    expect(picker.customTo.value).toBe('2026-08-05');
    expect(picker.preset.value).toBe('custom');
  });
});

describe('useDashboard', () => {
  it('debounces range changes by 300ms', () => {
    expect(DASHBOARD_DEBOUNCE_MS).toBe(300);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const dashboard = useDashboard();

    dashboard.applyRange({ from: 1000, to: 2000, preset: 'custom' });
    expect(useAnalyticsStore().dateRange).toEqual({ from: 1000, to: 2000, preset: 'custom' });
    expect(vi.mocked(analyticsApi.getOverviewStats)).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DASHBOARD_DEBOUNCE_MS - 1);
    expect(vi.mocked(analyticsApi.getOverviewStats)).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(1);
  });

  it('collapses repeated range changes into one reload', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const dashboard = useDashboard();

    dashboard.applyRange({ from: 1, to: 2, preset: 'custom' });
    vi.advanceTimersByTime(200);
    dashboard.applyRange({ from: 3, to: 4, preset: '7d' });
    vi.advanceTimersByTime(200);

    expect(vi.mocked(analyticsApi.getOverviewStats)).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(1);
    expect(useAnalyticsStore().dateRange).toEqual({ from: 3, to: 4, preset: '7d' });
  });

  it('cancelScheduledRefresh drops a pending reload', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const dashboard = useDashboard();

    dashboard.applyRange({ from: 1, to: 2, preset: 'custom' });
    dashboard.cancelScheduledRefresh();
    vi.advanceTimersByTime(DASHBOARD_DEBOUNCE_MS * 3);

    expect(vi.mocked(analyticsApi.getOverviewStats)).not.toHaveBeenCalled();
  });

  it('setRange moves the window without loading', () => {
    const dashboard = useDashboard();

    dashboard.setRange({ from: 5000, to: 6000, preset: 'today' });

    expect(useAnalyticsStore().dateRange).toEqual({ from: 5000, to: 6000, preset: 'today' });
    expect(vi.mocked(analyticsApi.getOverviewStats)).not.toHaveBeenCalled();
  });

  it('mirrors the store slices and delegates each loader', async () => {
    const dashboard = useDashboard();

    await expect(dashboard.refreshAll()).resolves.toBe(true);
    expect(dashboard.overviewStats.value?.totalCustomers).toBe(8);
    expect(dashboard.conversationTrend.value).toHaveLength(3);
    expect(dashboard.messageTrend.value).toHaveLength(3);
    expect(dashboard.responseTimeStats.value?.samples).toBe(4);
    expect(dashboard.hasDemoData.value).toBe(true);
    expect(dashboard.loading.value).toBe(false);
    expect(dashboard.error.value).toBeNull();
    await flushPromises();

    await expect(dashboard.loadOverviewStats(true)).resolves.toBe(true);
    await expect(dashboard.loadConversationTrend(true)).resolves.toBe(true);
    await expect(dashboard.loadMessageTrend(true)).resolves.toBe(true);
    await expect(dashboard.loadChannelDistribution(true)).resolves.toBe(true);
    await expect(dashboard.loadResponseTimeStats(true)).resolves.toBe(true);
    await expect(dashboard.loadTopCustomers(true)).resolves.toBe(true);
    await expect(dashboard.loadAgentPerformance(true)).resolves.toBe(true);

    expect(vi.mocked(analyticsApi.getOverviewStats)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyticsApi.getTopCustomers)).toHaveBeenCalledTimes(2);
  });

  it('surfaces a store failure through error', async () => {
    vi.mocked(analyticsApi.getOverviewStats).mockRejectedValue(new Error('offline'));
    const dashboard = useDashboard();

    await expect(dashboard.loadOverviewStats()).resolves.toBe(false);
    expect(dashboard.error.value).toBe('api.network');
  });
});
