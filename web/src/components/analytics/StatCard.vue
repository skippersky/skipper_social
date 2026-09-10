<script setup lang="ts">
import { computed } from 'vue';
import { formatChange, trendDirection } from '../../lib/metrics';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    unit?: string;
    change?: number | null;
    hint?: string;
    loading?: boolean;
  }>(),
  { unit: '', change: undefined, hint: '', loading: false }
);

const showChange = computed(() => props.change !== undefined);
const direction = computed(() => trendDirection(props.change ?? null));
const changeText = computed(() => formatChange(props.change ?? null));
</script>

<template>
  <article class="stat" :aria-busy="loading ? 'true' : 'false'">
    <p class="stat__label">{{ label }}</p>
    <p class="stat__value">
      <span v-if="loading" class="stat__skeleton" aria-hidden="true"></span>
      <template v-else>
        {{ value }}<span v-if="unit" class="stat__unit">{{ unit }}</span>
      </template>
    </p>
    <p v-if="showChange && !loading" class="stat__change" :class="`is-${direction}`" :data-direction="direction">
      <span class="stat__arrow" aria-hidden="true"></span>
      <span class="stat__delta">{{ changeText }}</span>
    </p>
    <p v-else-if="hint && !loading" class="stat__hint">{{ hint }}</p>
  </article>
</template>

<style scoped>
.stat {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.stat::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--ks-grad-brand);
  opacity: 0.85;
}
.stat__label {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.stat__value {
  margin: 0;
  font-size: 28px;
  line-height: 34px;
  font-weight: 800;
  color: var(--ks-text-primary);
  font-variant-numeric: tabular-nums;
}
.stat__unit {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.stat__change {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
.stat__change.is-up {
  color: var(--ks-success);
}
.stat__change.is-down {
  color: var(--ks-error);
}
.stat__change.is-flat {
  color: var(--ks-text-tertiary);
}
.stat__arrow {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}
.is-up .stat__arrow {
  border-bottom: 6px solid currentColor;
}
.is-down .stat__arrow {
  border-top: 6px solid currentColor;
}
.is-flat .stat__arrow {
  width: 8px;
  height: 2px;
  border: none;
  border-radius: 1px;
  background: currentColor;
}
.stat__delta {
  font-variant-numeric: tabular-nums;
}
.stat__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.stat__skeleton {
  display: block;
  width: 72px;
  height: 26px;
  border-radius: 8px;
  background: var(--ks-bg-muted);
}
</style>