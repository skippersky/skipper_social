<script setup lang="ts">
import { useI18nStore, type UiLocale } from '../i18n';

const i18n = useI18nStore();

const options: Array<{ value: UiLocale; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'zh', label: '中文' },
  { value: 'fr', label: 'FR' }
];
</script>

<template>
  <div class="lang-switch" role="group" :aria-label="i18n.t('lang.aria')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="lang-switch__option"
      :class="{ 'lang-switch__option--active': i18n.locale === option.value }"
      :aria-pressed="i18n.locale === option.value"
      @click="i18n.setLocale(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
}
.lang-switch__option {
  border: none;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--ks-motion-fast) var(--ks-ease),
    background var(--ks-motion-fast) var(--ks-ease);
}
.lang-switch__option:hover {
  color: var(--ks-text-primary);
}
.lang-switch__option--active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: 0 2px 8px rgba(23, 26, 33, 0.08);
}
</style>