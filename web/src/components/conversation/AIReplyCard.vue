<script setup lang="ts">
import { useI18nStore } from '../../i18n';

defineProps<{ text: string; loading: boolean }>();

const emit = defineEmits<{
  (e: 'adopt'): void;
  (e: 'regenerate'): void;
  (e: 'close'): void;
}>();

const i18n = useI18nStore();
</script>

<template>
  <div class="ai-card" role="region" :aria-label="i18n.t('inbox.aiReply')">
    <p class="ai-card__label">{{ i18n.t('inbox.aiReply') }}</p>
    <p v-if="loading" class="ai-card__text ai-card__text--loading">{{ i18n.t('inbox.aiLoading') }}</p>
    <p v-else class="ai-card__text">{{ text }}</p>
    <div class="ai-card__actions">
      <button class="ai-card__btn ai-card__btn--primary" type="button" :disabled="loading" @click="emit('adopt')">
        {{ i18n.t('inbox.aiAdopt') }}
      </button>
      <button class="ai-card__btn" type="button" :disabled="loading" @click="emit('regenerate')">
        {{ i18n.t('inbox.aiRegenerate') }}
      </button>
      <button class="ai-card__btn" type="button" @click="emit('close')">
        {{ i18n.t('inbox.aiClose') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-card {
  margin: 0 12px 8px;
  padding: 12px 14px;
  border: 1px solid rgba(91, 91, 214, 0.3);
  border-radius: var(--ks-radius-card);
  background: linear-gradient(135deg, rgba(91, 91, 214, 0.08), rgba(255, 178, 56, 0.08));
}
.ai-card__label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-accent);
}
.ai-card__text {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-primary);
  white-space: pre-wrap;
}
.ai-card__text--loading {
  color: var(--ks-text-tertiary);
}
.ai-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-card__btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ai-card__btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.ai-card__btn--primary {
  border: none;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
</style>