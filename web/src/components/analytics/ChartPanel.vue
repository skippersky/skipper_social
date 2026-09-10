<script setup lang="ts">
import { useI18nStore } from '../../i18n';

withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
  }>(),
  { subtitle: '', loading: false, error: null, empty: false }
);

const emit = defineEmits<{ (e: 'retry'): void }>();

const i18n = useI18nStore();
</script>

<template>
  <section class="panel" :aria-busy="loading ? 'true' : 'false'">
    <header class="panel__head">
      <div class="panel__heading">
        <h2 class="panel__title">{{ title }}</h2>
        <p v-if="subtitle" class="panel__subtitle">{{ subtitle }}</p>
      </div>
      <div class="panel__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="error" class="panel__state">
      <p class="panel__state-text panel__state-text--error">{{ i18n.t(error) }}</p>
      <button class="panel__retry" type="button" @click="emit('retry')">
        {{ i18n.t('analytics.retry') }}
      </button>
    </div>
    <div v-else-if="loading" class="panel__state" role="status" :aria-label="i18n.t('analytics.loading')">
      <span class="panel__skeleton" aria-hidden="true"></span>
      <span class="panel__skeleton panel__skeleton--short" aria-hidden="true"></span>
    </div>
    <div v-else-if="empty" class="panel__state">
      <p class="panel__state-text">{{ i18n.t('analytics.noData') }}</p>
    </div>
    <div v-else class="panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.panel__heading {
  min-width: 0;
}
.panel__title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.panel__subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.panel__actions {
  flex-shrink: 0;
}
.panel__body {
  min-width: 0;
}
.panel__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  padding: 16px;
  text-align: center;
}
.panel__state-text {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.panel__state-text--error {
  color: var(--ks-error);
}
.panel__retry {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.panel__retry:hover {
  background: var(--ks-bg-muted);
}
.panel__skeleton {
  display: block;
  width: 100%;
  height: 12px;
  border-radius: 6px;
  background: var(--ks-bg-muted);
}
.panel__skeleton--short {
  width: 60%;
}
</style>