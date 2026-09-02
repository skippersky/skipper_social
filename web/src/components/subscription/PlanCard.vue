<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { Plan } from '../../types';

const props = defineProps<{
  plan: Plan;
  current?: boolean;
  selected?: boolean;
  ctaText?: string;
  ctaDisabled?: boolean;
}>();

const emit = defineEmits<{ (e: 'select'): void; (e: 'cta'): void }>();
const i18n = useI18nStore();

function format(value: number): string {
  return value >= 1000 ? value.toLocaleString('en-US') : String(value);
}

const rows = computed(() => [
  { label: i18n.t('pricing.rowAi'), value: format(props.plan.quotas.aiGenerations) },
  { label: i18n.t('pricing.rowMessages'), value: format(props.plan.quotas.messages) },
  {
    label: i18n.t('pricing.rowChannels'),
    value: props.plan.quotas.channels === -1 ? i18n.t('pricing.allChannels') : String(props.plan.quotas.channels)
  },
  {
    label: i18n.t('pricing.rowPublish'),
    value: props.plan.quotas.scheduledPosts > 0 ? format(props.plan.quotas.scheduledPosts) : '—'
  }
]);
</script>

<template>
  <article
    class="plan-card"
    :class="{ 'plan-card--current': current, 'plan-card--selected': selected }"
    @click="emit('select')"
  >
    <p v-if="current" class="plan-card__badge">{{ i18n.t('upgrade.current') }}</p>
    <h3 class="plan-card__name">{{ plan.name }}</h3>
    <p class="plan-card__price">${{ plan.priceUsd }}<span>{{ i18n.t('pricing.month') }}</span></p>
    <ul class="plan-card__rows">
      <li v-for="row in rows" :key="row.label" class="plan-card__row">
        <span>{{ row.label }}</span>
        <strong>{{ row.value }}</strong>
      </li>
    </ul>
    <button
      v-if="ctaText"
      type="button"
      class="plan-card__cta"
      :disabled="ctaDisabled"
      @click.stop="emit('cta')"
    >
      {{ ctaText }}
    </button>
  </article>
</template>
<style scoped>
.plan-card {
  position: relative;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease), box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.plan-card:hover {
  border-color: var(--ks-border-strong);
}
.plan-card--selected {
  border: 2px solid var(--ks-primary);
  box-shadow: var(--ks-shadow-float);
}
.plan-card--current {
  outline: 2px solid var(--ks-accent);
  outline-offset: 2px;
  cursor: default;
}
.plan-card__badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--ks-accent);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.plan-card__name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-secondary);
}
.plan-card__price {
  margin: 10px 0 14px;
  font-family: Sora, sans-serif;
  font-size: 32px;
  font-weight: 800;
}
.plan-card__price span {
  font-size: 13px;
  font-weight: 500;
  color: var(--ks-text-tertiary);
}
.plan-card__rows {
  list-style: none;
  margin: 0 0 18px;
  padding: 14px 0 0;
  border-top: 1px solid var(--ks-border-default);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.plan-card__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.plan-card__row strong {
  color: var(--ks-text-primary);
}
.plan-card__cta {
  height: 42px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.plan-card__cta:hover:not(:disabled) {
  filter: brightness(1.05);
}
.plan-card__cta:disabled {
  opacity: 0.55;
  cursor: default;
}
@media (max-width: 600px) {
  .plan-card__cta {
    width: 100%;
  }
}
</style>