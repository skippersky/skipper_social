<script setup lang="ts">
import { computed } from 'vue';
import ChartPanel from './ChartPanel.vue';
import { asChartOption, VChart } from '../../lib/echarts';
import {
  generateBarChartOption,
  generateLineChartOption,
  type TrendSeriesSpec
} from '../../composables/useChart';
import { useI18nStore } from '../../i18n';
import type { TrendGranularity, TrendPoint } from '../../types';

const props = withDefaults(
  defineProps<{
    title: string;
    points: TrendPoint[];
    granularity: TrendGranularity;
    series: TrendSeriesSpec[];
    variant?: 'line' | 'bar';
    loading?: boolean;
    error?: string | null;
  }>(),
  { variant: 'line', loading: false, error: null }
);

const emit = defineEmits<{
  (e: 'update:granularity', value: TrendGranularity): void;
  (e: 'retry'): void;
}>();

const i18n = useI18nStore();
const GRANULARITIES: TrendGranularity[] = ['day', 'week', 'month'];

const option = computed(() =>
  asChartOption(
    props.variant === 'bar'
      ? generateBarChartOption(props.points, { series: props.series, granularity: props.granularity })
      : generateLineChartOption(props.points, { series: props.series, granularity: props.granularity })
  )
);

const isEmpty = computed(() => props.points.length === 0);
</script>

<template>
  <ChartPanel
    :title="title"
    :subtitle="i18n.t('analytics.trendSubtitle')"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    @retry="emit('retry')"
  >
    <template #actions>
      <div class="segmented" role="group" :aria-label="i18n.t('analytics.granularityLabel')">
        <button
          v-for="item in GRANULARITIES"
          :key="item"
          class="segmented__btn"
          type="button"
          :class="{ 'is-active': item === granularity }"
          :aria-pressed="item === granularity"
          @click="emit('update:granularity', item)"
        >{{ i18n.t(`analytics.granularity.${item}`) }}</button>
      </div>
    </template>
    <div class="trend__canvas">
      <VChart :option="option" autoresize class="trend__chart" />
    </div>
  </ChartPanel>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-muted);
}
.segmented__btn {
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.segmented__btn.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  font-weight: 700;
  box-shadow: var(--ks-shadow-card);
}
.trend__canvas {
  position: relative;
  height: 260px;
  min-width: 0;
}
.trend__chart {
  width: 100%;
  height: 100%;
}
@media (max-width: 1023px) {
  .trend__canvas {
    height: 240px;
  }
}
@media (max-width: 767px) {
  .trend__canvas {
    height: 220px;
  }
}
</style>