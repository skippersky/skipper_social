<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DATE_RANGE_PRESETS, toInputValue } from '../../composables/useDateRange';
import { useI18nStore } from '../../i18n';
import type { DateRangePreset } from '../../types';

const props = withDefaults(
  defineProps<{ preset: DateRangePreset; from: number; to: number; error?: string | null }>(),
  { error: null }
);

const emit = defineEmits<{
  (e: 'preset', value: DateRangePreset): void;
  (e: 'custom', from: string, to: string): void;
}>();

const i18n = useI18nStore();
const customFrom = ref(toInputValue(props.from));
const customTo = ref(toInputValue(props.to));
const isCustom = computed(() => props.preset === 'custom');

watch(
  () => [props.from, props.to],
  () => {
    customFrom.value = toInputValue(props.from);
    customTo.value = toInputValue(props.to);
  }
);

function submitCustom(): void {
  emit('custom', customFrom.value, customTo.value);
}
</script>

<template>
  <div class="range">
    <div class="range__presets" role="group" :aria-label="i18n.t('analytics.rangeLabel')">
      <button
        v-for="item in DATE_RANGE_PRESETS"
        :key="item"
        class="range__chip"
        type="button"
        :class="{ 'is-active': item === preset }"
        :aria-pressed="item === preset"
        @click="emit('preset', item)"
      >{{ i18n.t(`analytics.range.${item}`) }}</button>
    </div>

    <form v-if="isCustom" class="range__custom" @submit.prevent="submitCustom">
      <label class="range__field">
        <span class="range__field-label">{{ i18n.t('analytics.rangeFrom') }}</span>
        <input
          v-model="customFrom"
          class="range__input"
          type="date"
          :aria-label="i18n.t('analytics.rangeFrom')"
        />
      </label>
      <span class="range__sep" aria-hidden="true">&rarr;</span>
      <label class="range__field">
        <span class="range__field-label">{{ i18n.t('analytics.rangeTo') }}</span>
        <input
          v-model="customTo"
          class="range__input"
          type="date"
          :aria-label="i18n.t('analytics.rangeTo')"
        />
      </label>
      <button class="range__apply" type="submit">{{ i18n.t('analytics.rangeApply') }}</button>
    </form>

    <p v-if="error" class="range__error">{{ i18n.t(error) }}</p>
  </div>
</template>

<style scoped>
.range {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.range__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.range__chip {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.range__chip:hover {
  background: var(--ks-bg-muted);
}
.range__chip.is-active {
  background: var(--ks-grad-soft);
  border-color: var(--ks-primary-text);
  color: var(--ks-primary-text);
  font-weight: 700;
}
.range__custom {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}
.range__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.range__field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.range__input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
}
.range__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.range__sep {
  padding-bottom: 9px;
  color: var(--ks-text-tertiary);
}
.range__apply {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.range__apply:hover {
  filter: brightness(1.05);
}
.range__error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-error);
}
</style>