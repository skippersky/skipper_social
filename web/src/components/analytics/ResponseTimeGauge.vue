<script setup lang="ts">
import { computed } from 'vue';
import ChartPanel from './ChartPanel.vue';
import { generateGaugeChartOption } from '../../composables/useChart';
import { useI18nStore } from '../../i18n';
import { formatDuration } from '../../lib/metrics';
import { asChartOption, VChart } from '../../lib/echarts';
import type { ResponseTimeStats } from '../../types';

const props = withDefaults(
  defineProps<{ stats: ResponseTimeStats | null; loading?: boolean; error?: string | null }>(),
  { loading: false, error: null }
);

const emit = defineEmits<{ (e: 'retry'): void }>();

const i18n = useI18nStore();

const averageMinutes = computed(() =>
  props.stats?.averageMs === null || props.stats === null
    ? null
    : Math.round(props.stats.averageMs / 60_000)
);

const targetMinutes = computed(() => props.stats?.targetMinutes ?? 240);
const gaugeMax = computed(() => Math.max(60, targetMinutes.value * 2));

/** Traffic light against the service target: under, close to, or over it. */
const gaugeColor = computed(() => {
  const value = averageMinutes.value;
  if (value === null) return '#15803D';
  if (value > targetMinutes.value) return '#DC2626';
  if (value > targetMinutes.value * 0.75) return '#B45309';
  return '#15803D';
});

const option = computed(() =>
  asChartOption(
    generateGaugeChartOption(averageMinutes.value, {
      max: gaugeMax.value,
      unit: 'm',
      color: gaugeColor.value
    })
  )
);

const rows = computed(() => {
  const stats = props.stats;
  if (!stats) return [];
  return [
    { key: 'median', label: i18n.t('analytics.responseMedian'), value: formatDuration(stats.medianMs) },
    { key: 'p90', label: i18n.t('analytics.responseP90'), value: formatDuration(stats.p90Ms) },
    { key: 'p95', label: i18n.t('analytics.responseP95'), value: formatDuration(stats.p95Ms) },
    {
      key: 'samples',
      label: i18n.t('analytics.responseSamples'),
      value: i18n.t('analytics.responseSampleCount', { n: stats.samples })
    },
    {
      key: 'target',
      label: i18n.t('analytics.responseTargetLabel'),
      value: formatDuration(stats.targetMinutes * 60_000)
    }
  ];
});

const isEmpty = computed(() => props.stats === null);
</script>

<template>
  <ChartPanel
    :title="i18n.t('analytics.responseTitle')"
    :subtitle="i18n.t('analytics.responseSubtitle')"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    @retry="emit('retry')"
  >
    <div class="gauge">
      <div class="gauge__canvas">
        <VChart :option="option" autoresize class="gauge__chart" />
      </div>
      <dl class="gauge__list">
        <div v-for="row in rows" :key="row.key" class="gauge__row">
          <dt class="gauge__label">{{ row.label }}</dt>
          <dd class="gauge__value">{{ row.value }}</dd>
        </div>
      </dl>
    </div>
  </ChartPanel>
</template>

<style scoped>
.gauge {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.gauge__canvas {
  position: relative;
  flex: 0 0 46%;
  height: 200px;
  min-width: 0;
}
.gauge__chart {
  width: 100%;
  height: 100%;
}
.gauge__list {
  flex: 1;
  min-width: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gauge__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 10px;
  background: var(--ks-bg-base);
}
.gauge__label {
  font-size: 12px;
  color: var(--ks-text-secondary);
}
.gauge__value {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .gauge {
    flex-direction: column;
    align-items: stretch;
  }
  .gauge__canvas {
    flex: none;
    height: 190px;
  }
}
</style>