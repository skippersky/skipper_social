<script setup lang="ts">
/**
 * One reusable marketing template (Sprint 11).
 *
 * Presentational like CampaignCard: the view owns the store calls and the
 * toasts, this card only renders the template and emits intent. The prop is
 * named item rather than template so the SFC template block stays unambiguous.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { summarizeContent } from '../../lib/marketingContent';
import { relativeTime } from '../../lib/relativeTime';
import type { MarketingTemplate } from '../../types';

const props = defineProps<{ item: MarketingTemplate; now?: number }>();

const emit = defineEmits<{
  (e: 'use', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
}>();

const i18n = useI18nStore();
const clock = computed(() => props.now ?? Date.now());

const categoryLabel = computed(() => i18n.t('marketing.goal.' + props.item.category));
const usageText = computed(() => i18n.t('marketing.templates.usage', { n: props.item.usageCount }));
const createdText = computed(() =>
  i18n.t('marketing.card.created', {
    time: relativeTime(props.item.createdAt, clock.value, i18n.locale)
  })
);

/** The card shows a stable excerpt so long bodies never stretch the grid. */
const excerpt = computed(() => summarizeContent({ body: props.item.content }, 120));

function onUse(): void {
  emit('use', props.item.id);
}
function onEdit(): void {
  emit('edit', props.item.id);
}
function onDelete(): void {
  emit('delete', props.item.id);
}
</script>

<template>
  <article class="t-card">
    <header class="t-card__head">
      <h3 class="t-card__name">{{ item.name }}</h3>
      <span class="t-card__category">{{ categoryLabel }}</span>
    </header>

    <p class="t-card__title">{{ item.title }}</p>
    <p class="t-card__excerpt">{{ excerpt }}</p>

    <dl class="t-card__meta">
      <div class="t-card__meta-row">
        <dt>{{ usageText }}</dt>
        <dd>{{ createdText }}</dd>
      </div>
    </dl>

    <footer class="t-card__actions">
      <button class="t-card__btn is-primary" type="button" @click="onUse">
        {{ i18n.t('marketing.templates.use') }}
      </button>
      <button class="t-card__btn" type="button" @click="onEdit">
        {{ i18n.t('marketing.templates.edit') }}
      </button>
      <button class="t-card__btn is-danger" type="button" @click="onDelete">
        {{ i18n.t('marketing.templates.delete') }}
      </button>
    </footer>
  </article>
</template>

<style scoped>
.t-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: box-shadow var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.t-card:hover {
  border-color: var(--ks-border-strong);
  box-shadow: var(--ks-shadow-float);
}
.t-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.t-card__name {
  margin: 0;
  font-size: 15px;
  line-height: 21px;
  font-weight: 700;
  color: var(--ks-text-primary);
  word-break: break-word;
}
.t-card__category {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 11px;
  font-weight: 700;
}
.t-card__title {
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.t-card__excerpt {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.t-card__meta {
  margin: 0;
}
.t-card__meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.t-card__meta-row dt {
  font-size: 11px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.t-card__meta-row dd {
  margin: 0;
  font-size: 11px;
  color: var(--ks-text-tertiary);
  text-align: right;
}
.t-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--ks-border-default);
}
.t-card__btn {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.t-card__btn:hover {
  background: var(--ks-bg-muted);
}
.t-card__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.t-card__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.t-card__btn.is-primary:hover {
  filter: brightness(1.04);
}
.t-card__btn.is-danger {
  border-color: var(--ks-error);
  color: var(--ks-error);
}

@media (max-width: 767px) {
  .t-card {
    padding: 14px;
  }
  .t-card__btn {
    flex: 1 1 auto;
  }
  .t-card__meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .t-card__meta-row dd {
    text-align: left;
  }
}
</style>
