<script setup lang="ts">
import { useI18nStore } from '../../i18n';
import type { ContentPreview } from '../../types';

defineProps<{ previews: ContentPreview[] }>();

const i18n = useI18nStore();
</script>

<template>
  <section class="c-prev">
    <header class="c-prev__head">
      <h2 class="c-prev__title">{{ i18n.t('marketing.preview.title') }}</h2>
      <p class="c-prev__hint">{{ i18n.t('marketing.preview.hint') }}</p>
    </header>

    <p v-if="previews.length === 0" class="c-prev__empty">
      {{ i18n.t('marketing.preview.empty') }}
    </p>

    <div v-else class="c-prev__grid">
      <article
        v-for="preview in previews"
        :key="preview.platform"
        class="c-prev__card"
        :class="{ 'is-over': preview.truncated }"
      >
        <header class="c-prev__card-head">
          <span class="c-prev__platform">
            {{ i18n.t('channels.platform.' + preview.platform) }}
          </span>
          <span class="c-prev__count">
            {{ i18n.t('marketing.preview.charCount', { n: preview.charCount, limit: preview.limit }) }}
          </span>
        </header>
        <h3 class="c-prev__msg-title">{{ preview.title }}</h3>
        <p class="c-prev__msg-body">{{ preview.body }}</p>
        <span v-if="preview.cta" class="c-prev__cta">{{ preview.cta }}</span>
        <span v-if="preview.truncated" class="c-prev__warn">
          {{ i18n.t('marketing.preview.truncated') }}
        </span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.c-prev {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.c-prev__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.c-prev__title {
  margin: 0;
  font-size: 15px;
  line-height: 21px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.c-prev__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.c-prev__empty {
  margin: 0;
  padding: 20px 14px;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-surface);
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
}
.c-prev__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.c-prev__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.c-prev__card.is-over {
  border-color: var(--ks-warning);
}
.c-prev__card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.c-prev__platform {
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-primary-text);
}
.c-prev__count {
  margin-left: auto;
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.c-prev__msg-title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.c-prev__msg-body {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.c-prev__cta {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 12px;
  font-weight: 700;
}
.c-prev__warn {
  font-size: 11px;
  font-weight: 600;
  color: var(--ks-warning);
}
</style>
