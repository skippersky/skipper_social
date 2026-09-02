<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';

const props = defineProps<{ label: string; used: number; limit: number }>();
const i18n = useI18nStore();

const included = computed(() => props.limit > 0);
const percent = computed(() =>
  included.value ? Math.min(100, Math.round((props.used / props.limit) * 100)) : 0
);
const stateClass = computed(() => {
  if (!included.value) return 'usage-bar--na';
  if (percent.value >= 100) return 'usage-bar--over';
  if (percent.value >= 80) return 'usage-bar--warn';
  return '';
});
</script>

<template>
  <div class="usage-bar" :class="stateClass">
    <div class="usage-bar__head">
      <span class="usage-bar__label">{{ label }}</span>
      <span class="usage-bar__value">{{ included ? `${used} / ${limit}` : '—' }}</span>
    </div>
    <div
      class="usage-bar__track"
      role="progressbar"
      :aria-valuenow="included ? percent : 0"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="usage-bar__fill" :style="{ width: percent + '%' }"></div>
    </div>
    <p v-if="included && percent >= 100" class="usage-bar__note">{{ i18n.t('usage.overLimit') }}</p>
    <p v-else-if="included && percent >= 80" class="usage-bar__note">{{ i18n.t('usage.nearLimit') }}</p>
    <p v-else-if="!included" class="usage-bar__note">{{ i18n.t('usage.notIncluded') }}</p>
  </div>
</template>
<style scoped>
.usage-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.usage-bar__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.usage-bar__label {
  color: var(--ks-text-secondary);
}
.usage-bar__value {
  font-weight: 600;
  color: var(--ks-text-primary);
}
.usage-bar__track {
  height: 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  overflow: hidden;
}
.usage-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  transition: width var(--ks-motion-normal) var(--ks-ease);
}
.usage-bar--warn .usage-bar__fill {
  background: var(--ks-warning);
}
.usage-bar--over .usage-bar__fill {
  background: var(--ks-error);
}
.usage-bar__note {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.usage-bar--warn .usage-bar__note {
  color: var(--ks-warning);
}
.usage-bar--over .usage-bar__note {
  color: var(--ks-error);
}
.usage-bar--na .usage-bar__value {
  color: var(--ks-text-tertiary);
}
</style>