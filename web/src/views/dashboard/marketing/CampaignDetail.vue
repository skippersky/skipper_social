<script setup lang="ts">
/**
 * Campaign detail (Sprint 11).
 *
 * Read-mostly page: it loads one campaign with its delivery records, mirrors
 * the live batch counters while a throttled send loop is running, and exposes
 * the same start/pause/cancel transitions as the list card plus a retry for
 * failed messages. Everything flows useMarketing -> store -> api, so the demo
 * fallback and the real backend render through one template.
 */
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useMarketing } from '../../../composables/useMarketing';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { formatDuration } from '../../../lib/sendQueue';
import { relativeTime } from '../../../lib/relativeTime';
import { useMarketingStore } from '../../../stores/marketing';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();
const store = useMarketingStore();

usePageMeta(i18n.t('marketing.detail.title'), i18n.t('marketing.metaDescription'));

const {
  detail,
  records,
  stats,
  loading,
  saving,
  sending,
  error,
  progress,
  open,
  transition
} = useMarketing();

const campaignId = computed(() => String(route.params.id ?? ''));
const notFound = computed(() => !loading.value && detail.value === null);

/** The send loop only ever drives the campaign it was started from. */
const live = computed(() => (sending.value ? progress.value : null));

const status = computed(() => detail.value?.status ?? 'draft');
const percent = computed(() =>
  Math.min(100, Math.max(0, Math.round(live.value?.percent ?? detail.value?.progress.percent ?? 0)))
);
const sentCount = computed(() => live.value?.done ?? detail.value?.progress.sent ?? 0);
const failedCount = computed(() => live.value?.failed ?? detail.value?.progress.failed ?? 0);
const pendingCount = computed(() => {
  const current = live.value;
  if (current) return Math.max(0, current.total - current.done - current.failed);
  return detail.value?.progress.pending ?? 0;
});
const rate = computed(() => live.value?.ratePerMinute ?? detail.value?.progress.ratePerMinute ?? 0);
const etaText = computed(() => (live.value ? formatDuration(live.value.etaMs) : ''));
const showProgress = computed(
  () =>
    live.value !== null ||
    status.value === 'running' ||
    status.value === 'paused' ||
    percent.value > 0
);

const canStart = computed(() => status.value === 'draft' || status.value === 'paused');
const canPause = computed(() => status.value === 'running');
const canCancel = computed(
  () => status.value === 'draft' || status.value === 'running' || status.value === 'paused'
);
const failedRecords = computed(() => records.value.filter((item) => item.status === 'failed'));
const canRetry = computed(() => failedRecords.value.length > 0 && !saving.value);

const channelNames = computed(() =>
  (detail.value?.channels ?? []).map((platform) => i18n.t('channels.platform.' + platform))
);
const createdText = computed(() => {
  const campaign = detail.value;
  if (!campaign) return '';
  return i18n.t('marketing.card.created', {
    time: relativeTime(campaign.createdAt, Date.now(), i18n.locale)
  });
});

function num(value: number | undefined): string {
  return formatNumber(value ?? 0, i18n.locale);
}
function pct(value: number | undefined): string {
  return (value ?? 0) + '%';
}
/** Absolute stamp for a delivery row; a dash keeps the column aligned. */
function stamp(ms: number | null): string {
  return ms === null ? '\u2014' : new Date(ms).toLocaleString();
}

const statTiles = computed(() => [
  { key: 'delivered', label: i18n.t('marketing.detail.delivered'), value: num(stats.value?.delivered) },
  { key: 'opened', label: i18n.t('marketing.detail.opened'), value: num(stats.value?.opened) },
  { key: 'clicked', label: i18n.t('marketing.detail.clicked'), value: num(stats.value?.clicked) },
  { key: 'replied', label: i18n.t('marketing.detail.replied'), value: num(stats.value?.replied) },
  { key: 'converted', label: i18n.t('marketing.detail.converted'), value: num(stats.value?.converted) }
]);

const rateRows = computed(() => [
  { key: 'openRate', label: i18n.t('marketing.detail.openRate'), value: pct(stats.value?.openRate) },
  { key: 'clickRate', label: i18n.t('marketing.detail.clickRate'), value: pct(stats.value?.clickRate) },
  { key: 'replyRate', label: i18n.t('marketing.detail.replyRate'), value: pct(stats.value?.replyRate) },
  {
    key: 'conversionRate',
    label: i18n.t('marketing.detail.conversionRate'),
    value: pct(stats.value?.conversionRate)
  }
]);

const TOAST_KEY: Record<'start' | 'pause' | 'cancel', string> = {
  start: 'marketing.startedToast',
  pause: 'marketing.pausedToast',
  cancel: 'marketing.cancelledToast'
};

async function onTransition(action: 'start' | 'pause' | 'cancel'): Promise<void> {
  const next = await transition(campaignId.value, action);
  if (next) showToast(i18n.t(TOAST_KEY[action]));
}

async function onRetry(): Promise<void> {
  const count = await store.retryFailed(campaignId.value);
  showToast(
    count > 0
      ? i18n.t('marketing.retriedToast', { n: count })
      : i18n.t('marketing.progress.noFailures')
  );
}

function refresh(): void {
  void open(campaignId.value);
}
function backToList(): void {
  void router.push('/dashboard/marketing');
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});
watch(campaignId, (id) => {
  if (id) void open(id);
});
onMounted(() => {
  if (campaignId.value) void open(campaignId.value);
});
</script>

<template>
  <section class="mkt-d">
    <header class="mkt-d__top">
      <button
        class="mkt-d__home"
        type="button"
        :aria-label="i18n.t('marketing.detail.backToList')"
        @click="backToList"
      >&larr;</button>
      <div class="mkt-d__heading">
        <h1 class="mkt-d__title">
          {{ detail ? detail.name : i18n.t('marketing.detail.title') }}
        </h1>
        <p v-if="detail" class="mkt-d__subtitle">{{ detail.content.title }}</p>
      </div>
      <span v-if="detail" class="mkt-d__status" :class="'is-' + status">
        {{ i18n.t('marketing.status.' + status) }}
      </span>
    </header>

    <div v-if="notFound" class="mkt-d__empty">
      <h2 class="mkt-d__empty-title">{{ i18n.t('marketing.detail.notFound') }}</h2>
      <button class="mkt-d__btn" type="button" @click="backToList">
        {{ i18n.t('marketing.detail.backToList') }}
      </button>
    </div>

    <template v-else-if="detail">
      <div class="mkt-d__actions">
        <button class="mkt-d__btn" type="button" :disabled="loading" @click="refresh">
          {{ i18n.t('marketing.detail.refresh') }}
        </button>
        <button
          v-if="canStart"
          class="mkt-d__btn is-primary"
          type="button"
          :disabled="saving"
          @click="onTransition('start')"
        >
          {{ i18n.t('marketing.card.start') }}
        </button>
        <button
          v-if="canPause"
          class="mkt-d__btn"
          type="button"
          :disabled="saving"
          @click="onTransition('pause')"
        >
          {{ i18n.t('marketing.card.pause') }}
        </button>
        <button
          v-if="canRetry"
          class="mkt-d__btn"
          type="button"
          @click="onRetry"
        >
          {{ i18n.t('marketing.progress.retryFailed') }}
          ({{ failedRecords.length }})
        </button>
        <button
          v-if="canCancel"
          class="mkt-d__btn is-danger"
          type="button"
          :disabled="saving"
          @click="onTransition('cancel')"
        >
          {{ i18n.t('marketing.card.cancel') }}
        </button>
      </div>

      <p v-if="error" class="mkt-d__error">{{ i18n.t(error) }}</p>

      <dl class="mkt-d__meta">
        <div class="mkt-d__meta-row">
          <dt>{{ i18n.t('marketing.card.recipients', { n: detail.recipientCount }) }}</dt>
          <dd>{{ createdText }}</dd>
        </div>
        <div class="mkt-d__meta-row">
          <dt>{{ i18n.t('marketing.card.channels') }}</dt>
          <dd class="mkt-d__chips">
            <span v-for="name in channelNames" :key="name" class="mkt-d__chip">{{ name }}</span>
          </dd>
        </div>
        <div class="mkt-d__meta-row">
          <dt>{{ i18n.t('marketing.send.perMinute') }}</dt>
          <dd>{{ i18n.t('marketing.detail.rate', { n: rate }) }}</dd>
        </div>
      </dl>

      <section v-if="showProgress" class="mkt-d__panel">
        <div class="mkt-d__progress-head">
          <h2 class="mkt-d__panel-title">{{ i18n.t('marketing.card.progress') }}</h2>
          <span class="mkt-d__percent">{{ percent }}%</span>
        </div>
        <div
          class="mkt-d__bar"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="mkt-d__bar-fill" :style="{ width: percent + '%' }"></span>
        </div>
        <ul class="mkt-d__counters">
          <li class="is-sent">{{ i18n.t('marketing.card.sent') }} {{ sentCount }}</li>
          <li class="is-failed">{{ i18n.t('marketing.card.failed') }} {{ failedCount }}</li>
          <li>{{ i18n.t('marketing.history.status.pending') }} {{ pendingCount }}</li>
          <li v-if="etaText">{{ i18n.t('marketing.progress.eta', { text: etaText }) }}</li>
        </ul>
      </section>

      <section class="mkt-d__panel">
        <h2 class="mkt-d__panel-title">{{ i18n.t('marketing.detail.statsTitle') }}</h2>
        <div class="mkt-d__stats">
          <article v-for="tile in statTiles" :key="tile.key" class="mkt-d__stat">
            <span class="mkt-d__stat-label">{{ tile.label }}</span>
            <strong class="mkt-d__stat-value">{{ tile.value }}</strong>
          </article>
        </div>
        <dl class="mkt-d__rates">
          <div v-for="row in rateRows" :key="row.key" class="mkt-d__rate">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="mkt-d__panel">
        <h2 class="mkt-d__panel-title">{{ i18n.t('marketing.detail.recordsTitle') }}</h2>
        <ul v-if="records.length > 0" class="mkt-d__records">
          <li v-for="record in records" :key="record.id" class="mkt-d__record">
            <span class="mkt-d__record-name">{{ record.recipientName }}</span>
            <span class="mkt-d__record-channel">
              {{ i18n.t('channels.platform.' + record.channel) }}
            </span>
            <span class="mkt-d__record-status" :class="'is-' + record.status">
              {{ i18n.t('marketing.history.status.' + record.status) }}
            </span>
            <span class="mkt-d__record-time">{{ stamp(record.sentAt) }}</span>
            <span v-if="record.failureReason" class="mkt-d__record-reason">
              {{ record.failureReason }}
            </span>
          </li>
        </ul>
        <p v-else class="mkt-d__records-empty">
          {{ i18n.t('marketing.detail.recordsEmpty') }}
        </p>
      </section>
    </template>

    <p v-else class="mkt-d__loading">{{ i18n.t('common.loading') }}</p>
  </section>
</template>

<style scoped>
.mkt-d {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  box-sizing: border-box;
}
.mkt-d__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.mkt-d__home {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.mkt-d__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mkt-d__heading {
  flex: 1 1 260px;
  min-width: 0;
}
.mkt-d__title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--ks-text-primary);
  word-break: break-word;
}
.mkt-d__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-tertiary);
}
.mkt-d__status {
  flex: none;
  align-self: center;
  padding: 4px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.mkt-d__status.is-running {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.mkt-d__status.is-paused {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.mkt-d__status.is-completed {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.mkt-d__status.is-cancelled {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.mkt-d__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mkt-d__btn {
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
.mkt-d__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.mkt-d__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mkt-d__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mkt-d__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.mkt-d__btn.is-primary:hover:not(:disabled) {
  filter: brightness(1.04);
}
.mkt-d__btn.is-danger {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.mkt-d__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.mkt-d__meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.mkt-d__meta-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.mkt-d__meta-row dt {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.mkt-d__meta-row dd {
  margin: 0;
  font-size: 13px;
  color: var(--ks-text-primary);
}
.mkt-d__chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.mkt-d__chip {
  padding: 1px 8px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  font-size: 11px;
  color: var(--ks-text-secondary);
}
.mkt-d__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.mkt-d__panel-title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.mkt-d__progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.mkt-d__percent {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ks-primary-text);
}
.mkt-d__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  overflow: hidden;
}
.mkt-d__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  transition: width var(--ks-motion-normal) var(--ks-ease);
}
.mkt-d__counters {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--ks-text-secondary);
  font-variant-numeric: tabular-nums;
}
.mkt-d__counters .is-sent {
  color: var(--ks-success);
}
.mkt-d__counters .is-failed {
  color: var(--ks-error);
}
.mkt-d__stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.mkt-d__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
}
.mkt-d__stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.mkt-d__stat-value {
  font-size: 22px;
  line-height: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ks-text-primary);
}
.mkt-d__rates {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--ks-border-default);
}
.mkt-d__rate {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.mkt-d__rate dt {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.mkt-d__rate dd {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ks-primary-text);
}
.mkt-d__records {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mkt-d__record {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) 96px minmax(0, 1.4fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  font-size: 12px;
  color: var(--ks-text-secondary);
}
.mkt-d__record-name {
  font-weight: 600;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mkt-d__record-time {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.mkt-d__record-status {
  justify-self: start;
  padding: 1px 8px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.mkt-d__record-status.is-sent {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.mkt-d__record-status.is-failed {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.mkt-d__record-status.is-pending {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.mkt-d__record-reason {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--ks-error);
}
.mkt-d__records-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.mkt-d__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.mkt-d__empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.mkt-d__loading {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}

@media (max-width: 1023px) {
  .mkt-d__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .mkt-d__rates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mkt-d__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .mkt-d {
    padding: 16px 12px 40px;
  }
  .mkt-d__title {
    font-size: 20px;
    line-height: 26px;
  }
  .mkt-d__actions .mkt-d__btn {
    flex: 1 1 auto;
  }
  .mkt-d__meta {
    grid-template-columns: minmax(0, 1fr);
  }
  .mkt-d__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mkt-d__rates {
    grid-template-columns: minmax(0, 1fr);
  }
  .mkt-d__record {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 4px;
  }
  .mkt-d__record-channel {
    grid-column: 1;
  }
  .mkt-d__record-status {
    grid-column: 2;
    justify-self: end;
  }
  .mkt-d__record-time {
    grid-column: 1 / -1;
    text-align: left;
  }
}
</style>
