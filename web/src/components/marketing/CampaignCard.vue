<script setup lang="ts">
/**
 * One campaign in the list grid (Sprint 11).
 *
 * Presentational by design: every action is an emit, so the list view owns the
 * store calls and the toasts. Status drives both the badge and which actions
 * are reachable, which makes an illegal transition such as pausing a finished
 * campaign impossible from the UI rather than merely rejected by the server.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { Campaign } from '../../types';

const props = defineProps<{ campaign: Campaign; now?: number }>();

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'start', id: string): void;
  (e: 'pause', id: string): void;
  (e: 'cancel', id: string): void;
}>();

const i18n = useI18nStore();

/** Injectable so tests can freeze the "created 2h ago" label. */
const clock = computed(() => props.now ?? Date.now());
const status = computed(() => props.campaign.status);
const percent = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.campaign.progress.percent)))
);
const createdText = computed(() =>
  i18n.t('marketing.card.created', {
    time: relativeTime(props.campaign.createdAt, clock.value, i18n.locale)
  })
);
const channelNames = computed(() =>
  props.campaign.channels.map((platform) => i18n.t('channels.platform.' + platform))
);
const showProgress = computed(
  () => status.value === 'running' || status.value === 'paused' || percent.value > 0
);
const canStart = computed(() => status.value === 'draft' || status.value === 'paused');
const canPause = computed(() => status.value === 'running');
const canCancel = computed(
  () => status.value === 'draft' || status.value === 'running' || status.value === 'paused'
);

function onOpen(): void {
  emit('open', props.campaign.id);
}
function onStart(): void {
  emit('start', props.campaign.id);
}
function onPause(): void {
  emit('pause', props.campaign.id);
}
function onCancel(): void {
  emit('cancel', props.campaign.id);
}
</script>

<template>
  <article class="c-card" :class="'is-' + status">
    <header class="c-card__head">
      <h3 class="c-card__name">{{ campaign.name }}</h3>
      <span class="c-card__status" :class="'is-' + status">
        {{ i18n.t('marketing.status.' + status) }}
      </span>
    </header>

    <p class="c-card__summary">{{ campaign.content.title }}</p>

    <dl class="c-card__meta">
      <div class="c-card__meta-row">
        <dt>{{ i18n.t('marketing.card.recipients', { n: campaign.recipientCount }) }}</dt>
        <dd>{{ createdText }}</dd>
      </div>
      <div class="c-card__meta-row">
        <dt>{{ i18n.t('marketing.card.channels') }}</dt>
        <dd class="c-card__channels">
          <span v-for="name in channelNames" :key="name" class="c-card__chip">{{ name }}</span>
        </dd>
      </div>
    </dl>

    <div v-if="showProgress" class="c-card__progress">
      <div class="c-card__progress-head">
        <span>{{ i18n.t('marketing.card.progress') }}</span>
        <span class="c-card__percent">{{ percent }}%</span>
      </div>
      <div
        class="c-card__bar"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span class="c-card__bar-fill" :style="{ width: percent + '%' }"></span>
      </div>
      <div class="c-card__counts">
        <span class="c-card__count is-sent">
          {{ i18n.t('marketing.card.sent') }} {{ campaign.progress.sent }}
        </span>
        <span class="c-card__count is-failed">
          {{ i18n.t('marketing.card.failed') }} {{ campaign.progress.failed }}
        </span>
      </div>
    </div>

    <footer class="c-card__actions">
      <button v-if="canStart" class="c-card__btn is-primary" type="button" @click="onStart">
        {{ i18n.t('marketing.card.start') }}
      </button>
      <button v-if="canPause" class="c-card__btn" type="button" @click="onPause">
        {{ i18n.t('marketing.card.pause') }}
      </button>
      <button v-if="canCancel" class="c-card__btn is-danger" type="button" @click="onCancel">
        {{ i18n.t('marketing.card.cancel') }}
      </button>
      <button class="c-card__btn is-ghost" type="button" @click="onOpen">
        {{ i18n.t('marketing.card.open') }}
      </button>
    </footer>
  </article>
</template>

<style scoped>
.c-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: box-shadow var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.c-card:hover {
  border-color: var(--ks-border-strong);
  box-shadow: var(--ks-shadow-float);
}
.c-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.c-card__name {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
  word-break: break-word;
}
.c-card__status {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
.c-card__status.is-running {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.c-card__status.is-paused {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.c-card__status.is-completed {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.c-card__status.is-cancelled {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.c-card__summary {
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.c-card__meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.c-card__meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.c-card__meta-row dt {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.c-card__meta-row dd {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-secondary);
  text-align: right;
}
.c-card__channels {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.c-card__chip {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  border: 1px solid var(--ks-border-default);
  font-size: 11px;
  color: var(--ks-text-secondary);
}
.c-card__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.c-card__progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.c-card__percent {
  font-variant-numeric: tabular-nums;
  color: var(--ks-text-secondary);
  font-weight: 600;
}
.c-card__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  overflow: hidden;
}
.c-card__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  transition: width var(--ks-motion-normal) var(--ks-ease);
}
.c-card__counts {
  display: flex;
  gap: 12px;
  font-size: 11px;
}
.c-card__count.is-sent {
  color: var(--ks-success);
}
.c-card__count.is-failed {
  color: var(--ks-error);
}
.c-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px solid var(--ks-border-default);
}
.c-card__btn {
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
.c-card__btn:hover {
  background: var(--ks-bg-muted);
}
.c-card__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.c-card__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.c-card__btn.is-primary:hover {
  filter: brightness(1.04);
}
.c-card__btn.is-danger {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.c-card__btn.is-ghost {
  border-color: transparent;
  color: var(--ks-primary-text);
}
.c-card__btn.is-ghost:hover {
  background: var(--ks-bg-muted);
}

@media (max-width: 767px) {
  .c-card {
    padding: 14px;
  }
  .c-card__meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .c-card__meta-row dd {
    text-align: left;
  }
  .c-card__channels {
    justify-content: flex-start;
  }
  .c-card__btn {
    flex: 1 1 auto;
  }
}
</style>
