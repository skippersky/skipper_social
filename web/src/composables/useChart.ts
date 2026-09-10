import type { ChannelSlice, TrendGranularity, TrendPoint } from '../types';

/** Warm brand palette from DESIGN_SYSTEM.md (terracotta, gold, indigo, success, warning, error). */
export const CHART_PALETTE = ['#F4633A', '#FFB238', '#5B5BD6', '#15803D', '#B45309', '#DC2626'];
export const CHART_TEXT_COLOR = '#555B6E';
export const CHART_MUTED_COLOR = '#667085';
export const CHART_AXIS_COLOR = '#E5E7F0';
export const CHART_BORDER_COLOR = '#FFFFFF';
export const CHART_TRACK_COLOR = '#EEF0F6';
export const CHART_PRIMARY_COLOR = '#F4633A';
export const CHART_PRIMARY_TEXT = '#C2410C';

export type ChartOptionObject = Record<string, unknown>;
export type TrendSeriesKey = 'count' | 'inbound' | 'outbound';

export interface TrendSeriesSpec {
  key: TrendSeriesKey;
  label: string;
  color?: string;
}

export interface TrendChartConfig {
  series: TrendSeriesSpec[];
  granularity: TrendGranularity;
  valueLabel?: string;
}

export interface PieChartConfig {
  /** Localized slice names keyed by platform. */
  labels: Record<string, string>;
}

export interface GaugeChartConfig {
  max: number;
  unit?: string;
  color?: string;
  trackColor?: string;
}

/** Axis label per granularity: MM-DD for days and weeks, YYYY-MM for months. */
export function bucketLabel(point: TrendPoint, granularity: TrendGranularity): string {
  const date = new Date(point.timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return granularity === 'month' ? `${date.getFullYear()}-${month}` : `${month}-${day}`;
}

function seriesValue(point: TrendPoint, key: TrendSeriesKey): number {
  if (key === 'inbound') return point.inbound ?? 0;
  if (key === 'outbound') return point.outbound ?? 0;
  return point.count;
}

function colorOf(spec: TrendSeriesSpec, index: number): string {
  return spec.color ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

function axisSkeleton(points: TrendPoint[], config: TrendChartConfig, multiSeries: boolean): ChartOptionObject {
  return {
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => bucketLabel(point, config.granularity)),
      axisLine: { lineStyle: { color: CHART_AXIS_COLOR } },
      axisTick: { show: false },
      axisLabel: { color: CHART_MUTED_COLOR, fontSize: 11, hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      name: config.valueLabel,
      nameTextStyle: { color: CHART_MUTED_COLOR, fontSize: 11, align: 'right' },
      splitLine: { lineStyle: { color: CHART_AXIS_COLOR, type: 'dashed' } },
      axisLabel: { color: CHART_MUTED_COLOR, fontSize: 11 }
    },
    grid: { left: 8, right: 14, top: multiSeries ? 36 : 18, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_BORDER_COLOR,
      borderColor: CHART_AXIS_COLOR,
      borderWidth: 1,
      textStyle: { color: '#171A21', fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: CHART_AXIS_COLOR } }
    }
  };
}

function baseOption(config: TrendChartConfig, points: TrendPoint[]): ChartOptionObject {
  const multiSeries = config.series.length > 1;
  const option = axisSkeleton(points, config, multiSeries);
  option.color = config.series.map((spec, index) => colorOf(spec, index));
  option.backgroundColor = 'transparent';
  if (multiSeries) {
    option.legend = {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      data: config.series.map((spec) => spec.label),
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 12 }
    };
  }
  return option;
}

/** Smoothed line chart; a single series also gets a soft brand area fill. */
export function generateLineChartOption(points: TrendPoint[], config: TrendChartConfig): ChartOptionObject {
  const option = baseOption(config, points);
  const single = config.series.length === 1;
  option.series = config.series.map((spec, index) => ({
    name: spec.label,
    type: 'line',
    smooth: true,
    showSymbol: points.length <= 31,
    symbolSize: 6,
    lineStyle: { width: 2, color: colorOf(spec, index) },
    itemStyle: { color: colorOf(spec, index) },
    areaStyle: single ? { color: colorOf(spec, index), opacity: 0.12 } : undefined,
    emphasis: { focus: 'series' },
    data: points.map((point) => seriesValue(point, spec.key))
  }));
  return option;
}

/** Rounded bar chart, same axes and tooltip as the line variant. */
export function generateBarChartOption(points: TrendPoint[], config: TrendChartConfig): ChartOptionObject {
  const option = baseOption(config, points);
  option.xAxis = { ...(option.xAxis as ChartOptionObject), boundaryGap: true };
  option.series = config.series.map((spec, index) => ({
    name: spec.label,
    type: 'bar',
    barMaxWidth: 18,
    itemStyle: { color: colorOf(spec, index), borderRadius: [6, 6, 0, 0] },
    emphasis: { focus: 'series' },
    data: points.map((point) => seriesValue(point, spec.key))
  }));
  return option;
}

/** Donut chart of channel shares; slice names come from the caller's i18n labels. */
export function generatePieChartOption(slices: ChannelSlice[], config: PieChartConfig): ChartOptionObject {
  return {
    backgroundColor: 'transparent',
    color: CHART_PALETTE,
    tooltip: {
      trigger: 'item',
      backgroundColor: CHART_BORDER_COLOR,
      borderColor: CHART_AXIS_COLOR,
      borderWidth: 1,
      textStyle: { color: '#171A21', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: CHART_TEXT_COLOR, fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['54%', '76%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: CHART_BORDER_COLOR, borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 700, color: '#171A21', formatter: '{b}\n{d}%' }
        },
        data: slices.map((slice) => ({
          name: config.labels[slice.platform] ?? slice.platform,
          value: slice.conversations,
          percent: slice.percent
        }))
      }
    ]
  };
}

/** Gauge scaled to a service target; value is expressed in the unit the caller passes. */
export function generateGaugeChartOption(value: number | null, config: GaugeChartConfig): ChartOptionObject {
  const max = Math.max(1, config.max);
  const safe = value === null ? 0 : Math.min(max, Math.max(0, value));
  const color = config.color ?? CHART_PRIMARY_COLOR;
  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max,
        splitNumber: 4,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        axisLine: { lineStyle: { width: 14, color: [[1, config.trackColor ?? CHART_TRACK_COLOR]] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: CHART_AXIS_COLOR, width: 1 } },
        axisLabel: { color: CHART_MUTED_COLOR, fontSize: 10, distance: 16 },
        pointer: { show: true, width: 4, length: '58%', itemStyle: { color: CHART_PRIMARY_TEXT } },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '34%'],
          fontSize: 22,
          fontWeight: 700,
          color: '#171A21',
          formatter: config.unit ? `{value}${config.unit}` : '{value}'
        },
        data: [{ value: safe }]
      }
    ]
  };
}

/** Chart option builders shared by the analytics components. */
export function useChart() {
  return {
    palette: CHART_PALETTE,
    bucketLabel,
    generateLineChartOption,
    generateBarChartOption,
    generatePieChartOption,
    generateGaugeChartOption
  };
}
