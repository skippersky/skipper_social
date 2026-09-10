import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts';

/**
 * Single import point for charts: only the series and components the dashboard
 * renders are registered, so the bundle never pulls in all of ECharts.
 */
use([CanvasRenderer, LineChart, PieChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent]);

export type ChartOption = EChartsOption;

/** Chart builders emit plain objects; this narrows them at the vue-echarts boundary. */
export function asChartOption(option: Record<string, unknown>): ChartOption {
  return option as ChartOption;
}

export { VChart };
