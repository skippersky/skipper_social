<script setup lang="ts">
/**
 * Live delivery panel for a batch send (Sprint 11).
 *
 * The dialog is a window onto lib/sendQueue, not a second scheduler: it renders
 * whatever progress the queue pushed into the store and forwards pause, resume,
 * cancel and retry as emits. Two product rules stay visible here - the stop
 * button is always reachable while a batch runs, and failures are listed with
 * their reason so retry is never a blind re-send.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { formatDuration } from '../../lib/sendQueue';
import type { QueueFailure, QueueSummary } from '../../lib/sendQueue';
import type { BatchSendProgress } from '../../types';

const props = withDefaults(
  defineProps<{
    open: boolean;
    progress: BatchSendProgress | null;
    summary: QueueSummary | null;
    failures?: QueueFailure[];
    paused?: boolean;
  }>(),
  { failures: () => [], paused: false }
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'cancel'): void;
  (e: 'retry'): void;
}>();

const i18n = useI18nStore();

const running = computed(() => props.progress !== null && props.progress.running);
const percent = computed(() =>
  Math.min(100, Math.max(0, Math.round(props.progress?.percent ?? 0)))
);
const doneText = computed(() =>
  i18n.t('marketing.progress.done', {
    done: props.progress?.done ?? 0,
    total: props.progress?.total ?? 0
  })
);
const etaText = computed(() =>
  i18n.t('marketing.progress.eta', { text: formatDuration(props.progress?.etaMs ?? 0) })
);
const finishedText = computed(() => {
  const summary = props.summary;
  if (!summary) return '';
  return summary.cancelled
    ? i18n.t('marketing.progress.cancelled', { skipped: summary.skipped })
    : i18n.t('marketing.progress.finished', { sent: summary.sent, failed: summary.failed });
});
/** A live run owns the list; a finished summary still carries its own failures. */
const visibleFailures = computed<QueueFailure[]>(() =>
  props.failures.length > 0 ? props.failures : props.summary?.failures ?? []
);
const canRetry = computed(() => visibleFailures.value.length > 0 && !running.value);

function close(): void {
  emit('update:open', false);
}

/** An in-flight batch must not vanish behind an accidental backdrop click. */
function onBackdrop(): void {
  if (running.value) return;
  close();
}
</script>

<template>
  <div v-if="open" class="s-prog-overlay" role="dialog" aria-modal="true" @click.self="onBackdrop">
    <div class="s-prog">
      <header class="s-prog__head">
        <h2 class="s-prog__title">{{ i18n.t('marketing.progress.title') }}</h2>
        <button
          class="s-prog__close"
          type="button"
          :aria-label="i18n.t('marketing.progress.close')"
          :disabled="running"
          @click="close"
        >&times;</button>
      </header>

      <div
        class="s-prog__bar"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span
          class="s-prog__bar-fill"
          :class="{ 'is-stopped': !running }"
          :style="{ width: percent + '%' }"
        ></span>
      </div>

      <div class="s-prog__row">
        <span class="s-prog__done">{{ doneText }}</span>
        <span class="s-prog__percent">{{ percent }}%</span>
      </div>

      <dl class="s-prog__stats">
        <div class="s-prog__stat">
          <dt>{{ i18n.t('marketing.progress.rate', { n: progress?.ratePerMinute ?? 0 }) }}</dt>
          <dd>{{ etaText }}</dd>
        </div>
        <div v-if="progress && progress.currentName" class="s-prog__stat">
          <dt>{{ i18n.t('marketing.progress.current', { name: progress.currentName }) }}</dt>
          <dd :class="{ 'is-failed': progress.failed > 0 }">
            {{ i18n.t('marketing.progress.failed', { n: progress.failed }) }}
          </dd>
        </div>
      </dl>

      <p v-if="finishedText" class="s-prog__summary" role="status">{{ finishedText }}</p>

      <section v-if="visibleFailures.length > 0" class="s-prog__failures">
        <h3 class="s-prog__failures-title">{{ i18n.t('marketing.progress.failureReason') }}</h3>
        <ul class="s-prog__failure-list">
          <li v-for="failure in visibleFailures" :key="failure.id" class="s-prog__failure">
            <span class="s-prog__failure-name">{{ failure.name }}</span>
            <span class="s-prog__failure-reason">{{ failure.reason }}</span>
          </li>
        </ul>
      </section>
      <p v-else-if="summary" class="s-prog__no-failures">
        {{ i18n.t('marketing.progress.noFailures') }}
      </p>

      <footer class="s-prog__actions">
        <template v-if="running">
          <button v-if="paused" class="s-prog__btn is-primary" type="button" @click="emit('resume')">
            {{ i18n.t('marketing.progress.resume') }}
          </button>
          <button v-else class="s-prog__btn" type="button" @click="emit('pause')">
            {{ i18n.t('marketing.progress.pause') }}
          </button>
          <button class="s-prog__btn is-danger" type="button" @click="emit('cancel')">
            {{ i18n.t('marketing.progress.cancel') }}
          </button>
        </template>
        <template v-else>
          <button v-if="canRetry" class="s-prog__btn is-primary" type="button" @click="emit('retry')">
            {{ i18n.t('marketing.progress.retryFailed') }}
          </button>
          <button class="s-prog__btn" type="button" @click="close">
            {{ i18n.t('marketing.progress.close') }}
          </button>
        </template>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.s-prog-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(23 16 12 / 52%);
  backdrop-filter: blur(2px);
}
.s-prog {
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-float);
}
.s-prog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.s-prog__title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.s-prog__close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.s-prog__close:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.s-prog__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  overflow: hidden;
}
.s-prog__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  transition: width var(--ks-motion-normal) var(--ks-ease);
}
.s-prog__bar-fill.is-stopped {
  background: var(--ks-primary-text);
}
.s-prog__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.s-prog__percent {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.s-prog__stats {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
}
.s-prog__stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.s-prog__stat dt {
  color: var(--ks-text-tertiary);
}
.s-prog__stat dd {
  margin: 0;
  color: var(--ks-text-secondary);
}
.s-prog__stat dd.is-failed {
  color: var(--ks-error);
  font-weight: 600;
}
.s-prog__summary {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-soft);
  font-size: 13px;
  color: var(--ks-text-primary);
}
.s-prog__failures {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.s-prog__failures-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-text-secondary);
}
.s-prog__failure-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}
.s-prog__failure {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--ks-border-default);
  border-left: 3px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  font-size: 12px;
}
.s-prog__failure-name {
  color: var(--ks-text-primary);
  font-weight: 600;
}
.s-prog__failure-reason {
  color: var(--ks-text-tertiary);
  text-align: right;
  word-break: break-word;
}
.s-prog__no-failures {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.s-prog__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.s-prog__btn {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.s-prog__btn:hover {
  background: var(--ks-bg-muted);
}
.s-prog__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.s-prog__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.s-prog__btn.is-danger {
  border-color: var(--ks-error);
  color: var(--ks-error);
}

@media (max-width: 767px) {
  .s-prog-overlay {
    padding: 12px;
    align-items: flex-end;
  }
  .s-prog {
    max-width: none;
    max-height: 90vh;
  }
  .s-prog__btn {
    flex: 1 1 auto;
  }
}
</style>
