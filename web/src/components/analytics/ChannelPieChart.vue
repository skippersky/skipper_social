<script setup lang="ts">
import { computed } from 'vue';
import ChartPanel from './ChartPanel.vue';
import { generatePieChartOption } from '../../composables/useChart';
import { useI18nStore } from '../../i18n';
import { asChartOption, VChart } from '../../lib/echarts';
import type { ChannelSlice } from '../../types';

const props = withDefaults(
  defineProps<{ slices: ChannelSlice[]; loading?: boolean; error?: string | null }>(),
  { loading: false, error: null }
);

const emit = defineEmits<{ (e: 'retry'): void }>();

const i18n = useI18nStore();

const labels = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const slice of props.slices) {
    map[slice.platform] = i18n.t(`channels.platform.${slice.platform}`);
  }
  return map;
});

const option = computed(() =>
  asChartOption(generatePieChartOption(props.slices, { labels: labels.value }))
);

const total = computed(() => props.slices.reduce((sum, slice) => sum + slice.conversations, 0));
const isEmpty = computed(() => props.slices.length === 0);
</script>

<template>
  <ChartPanel
    :title="i18n.t('analytics.channelTitle')"
    :subtitle="i18n.t('analytics.channelSubtitle')"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    @retry="emit('retry')"
  >
    <div class="pie">
      <div class="pie__canvas">
        <VChart :option="option" autoresize class="pie__chart" />
        <div class="pie__center" aria-hidden="true">
          <span class="pie__center-value">{{ total }}</span>
          <span class="pie__center-label">{{ i18n.t('analytics.channelTotal') }}</span>
        </div>
      </div>
      <ul class="pie__list">
        <li v-for="slice in slices" :key="slice.platform" class="pie__row">
          <span class="pie__name">{{ labels[slice.platform] }}</span>
          <span class="pie__count">{{ i18n.t('analytics.channelCount', { n: slice.conversations }) }}</span>
          <span class="pie__percent">{{ slice.percent }}%</span>
        </li>
      </ul>
    </div>
  </ChartPanel>
</template>

<style scoped>
.pie {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.pie__canvas {
  position: relative;
  height: 236px;
  min-width: 0;
}
.pie__chart {
  width: 100%;
  height: 100%;
}
.pie__center {
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.pie__center-value {
  font-size: 24px;
  line-height: 28px;
  font-weight: 800;
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
}
.pie__center-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.pie__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pie__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  background: var(--ks-bg-base);
}
.pie__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.pie__count {
  font-size: 12px;
  color: var(--ks-text-secondary);
}
.pie__percent {
  min-width: 48px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-primary-text);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .pie__canvas {
    height: 210px;
  }
}
</style>