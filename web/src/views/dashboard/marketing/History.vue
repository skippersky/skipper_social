<script setup lang="ts">
/**
 * Send history (Sprint 11).
 *
 * A flat log of every delivery attempt, filterable by date range and campaign,
 * plus a CSV export of exactly what is on screen. Filter state lives in
 * useMarketing so the store keeps owning paging and de-duplication.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useMarketing } from '../../../composables/useMarketing';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { relativeTime } from '../../../lib/relativeTime';

const i18n = useI18nStore();
const router = useRouter();

usePageMeta(i18n.t('marketing.history.title'), i18n.t('marketing.metaDescription'));

const {
  history,
  historyTotal,
  historyHasMore,
  loading,
  error,
  campaigns,
  refresh,
  setHistoryRange,
  setHistoryCampaign,
  loadHistory,
  loadMoreHistory,
  exportCsv
} = useMarketing();

/** The date inputs speak local YYYY-MM-DD while the api speaks epoch ms. */
const fromText = ref('');
const toText = ref('');
const campaignId = ref('');

const DAY_MS = 86400000;

const options = computed(() => campaigns.value.map((item) => ({ id: item.id, name: item.name })));

/** Midnight of the picked local day, or null when the field is blank/invalid. */
function dayStart(text: string): number | null {
  const parts = text.split('-');
  if (parts.length !== 3) return null;
  const ms = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function apply(): Promise<void> {
  const from = dayStart(fromText.value);
  const to = dayStart(toText.value);
  setHistoryRange(from, to === null ? null : to + DAY_MS - 1);
  setHistoryCampaign(campaignId.value === '' ? null : campaignId.value);
  await loadHistory();
}

async function reset(): Promise<void> {
  fromText.value = '';
  toText.value = '';
  campaignId.value = '';
  await apply();
}

function onExport(): void {
  const result = exportCsv();
  showToast(
    result.downloaded
      ? i18n.t('marketing.history.exportedToast', { n: result.rows, file: result.filename })
      : i18n.t('marketing.history.exportFailedToast')
  );
}

/** Queued rows have no timestamp yet, so they read as pending. */
function when(sentAt: number | null): string {
  return sentAt === null
    ? i18n.t('marketing.history.status.pending')
    : relativeTime(sentAt, Date.now(), i18n.locale);
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(async () => {
  await refresh();
  await loadHistory();
});
</script>

<template>
  <section class="hist">
    <header class="hist__top">
      <button
        class="hist__back"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/dashboard/marketing')"
      >&larr;</button>
      <div class="hist__heading">
        <h1 class="hist__title">{{ i18n.t('marketing.history.title') }}</h1>
        <p class="hist__subtitle">{{ i18n.t('marketing.history.subtitle') }}</p>
      </div>
      <span class="hist__count">{{ i18n.t('marketing.history.total', { n: historyTotal }) }}</span>
    </header>

    <form class="hist__filters" @submit.prevent="apply">
      <label class="hist__field">
        <span class="hist__label">{{ i18n.t('marketing.history.from') }}</span>
        <input v-model="fromText" class="hist__input" type="date" />
      </label>
      <label class="hist__field">
        <span class="hist__label">{{ i18n.t('marketing.history.to') }}</span>
        <input v-model="toText" class="hist__input" type="date" />
      </label>
      <label class="hist__field hist__field--grow">
        <span class="hist__label">{{ i18n.t('marketing.history.campaign') }}</span>
        <select v-model="campaignId" class="hist__input">
          <option value="">{{ i18n.t('marketing.history.allCampaigns') }}</option>
          <option v-for="item in options" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <div class="hist__actions">
        <button class="hist__btn is-primary" type="submit" :disabled="loading">
          {{ i18n.t('common.search') }}
        </button>
        <button class="hist__btn" type="button" :disabled="loading" @click="reset">
          {{ i18n.t('marketing.history.reset') }}
        </button>
        <button class="hist__btn" type="button" :disabled="history.length === 0" @click="onExport">
          {{ i18n.t('marketing.history.export') }}
        </button>
      </div>
    </form>

    <p v-if="error" class="hist__error">{{ i18n.t(error) }}</p>

    <div v-if="history.length > 0" class="hist__table">
      <div class="hist__head" aria-hidden="true">
        <span>{{ i18n.t('marketing.history.colRecipient') }}</span>
        <span>{{ i18n.t('marketing.history.colCampaign') }}</span>
        <span>{{ i18n.t('marketing.history.colChannel') }}</span>
        <span>{{ i18n.t('marketing.history.colStatus') }}</span>
        <span>{{ i18n.t('marketing.history.colTime') }}</span>
      </div>
      <article v-for="row in history" :key="row.id" class="hist__row">
        <span class="hist__cell hist__cell--name" :data-label="i18n.t('marketing.history.colRecipient')">
          {{ row.recipientName }}
        </span>
        <span class="hist__cell" :data-label="i18n.t('marketing.history.colCampaign')">
          {{ row.campaignName }}
        </span>
        <span class="hist__cell" :data-label="i18n.t('marketing.history.colChannel')">
          {{ i18n.t('channels.platform.' + row.channel) }}
        </span>
        <span class="hist__cell" :data-label="i18n.t('marketing.history.colStatus')">
          <span class="hist__status" :data-status="row.status">
            {{ i18n.t('marketing.history.status.' + row.status) }}
          </span>
          <span v-if="row.failureReason" class="hist__reason">
            {{ i18n.t('marketing.progress.failureReason') }}: {{ row.failureReason }}
          </span>
        </span>
        <span class="hist__cell hist__cell--time" :data-label="i18n.t('marketing.history.colTime')">
          <span class="hist__when">{{ when(row.sentAt) }}</span>
          <span class="hist__flags">
            <i class="hist__flag" :class="{ 'is-on': row.opened }">
              {{ i18n.t('marketing.detail.opened') }}
            </i>
            <i class="hist__flag" :class="{ 'is-on': row.clicked }">
              {{ i18n.t('marketing.detail.clicked') }}
            </i>
            <i class="hist__flag" :class="{ 'is-on': row.replied }">
              {{ i18n.t('marketing.detail.replied') }}
            </i>
          </span>
        </span>
      </article>
    </div>

    <div v-else-if="!loading" class="hist__empty">
      <p class="hist__empty-text">{{ i18n.t('marketing.history.empty') }}</p>
      <button class="hist__btn" type="button" @click="reset">
        {{ i18n.t('marketing.history.reset') }}
      </button>
    </div>

    <div v-if="historyHasMore" class="hist__more">
      <button class="hist__btn" type="button" :disabled="loading" @click="loadMoreHistory">
        {{ i18n.t('marketing.loadMore') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.hist {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  box-sizing: border-box;
}
.hist__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.hist__back {
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
.hist__back:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.hist__heading {
  flex: 1 1 260px;
  min-width: 0;
}
.hist__title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--ks-text-primary);
}
.hist__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-tertiary);
}
.hist__count {
  align-self: center;
  padding: 6px 12px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.hist__filters {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.hist__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 150px;
}
.hist__field--grow {
  flex: 1 1 220px;
}
.hist__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-tertiary);
}
.hist__input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
}
.hist__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.hist__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}
.hist__btn {
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
.hist__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.hist__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hist__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.hist__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.hist__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.hist__table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hist__head,
.hist__row {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) minmax(120px, 1.2fr) 100px minmax(140px, 1fr) minmax(150px, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px 14px;
}
.hist__head {
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-text-tertiary);
}
.hist__row {
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  font-size: 13px;
  color: var(--ks-text-primary);
  transition: border-color var(--ks-motion-fast) var(--ks-ease);
}
.hist__row:hover {
  border-color: var(--ks-border-strong);
}
.hist__cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
}
.hist__cell--name {
  font-weight: 700;
}
.hist__status {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 700;
  font-style: normal;
}
.hist__status[data-status='sent'] {
  background: rgba(21, 128, 61, 0.12);
  color: var(--ks-success);
}
.hist__status[data-status='failed'] {
  background: rgba(220, 38, 38, 0.12);
  color: var(--ks-error);
}
.hist__status[data-status='pending'] {
  background: rgba(180, 83, 9, 0.12);
  color: var(--ks-warning);
}
.hist__reason {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.hist__when {
  color: var(--ks-text-secondary);
}
.hist__flags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.hist__flag {
  padding: 2px 8px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-style: normal;
  opacity: 0.6;
}
.hist__flag.is-on {
  border-color: var(--ks-primary);
  background: rgba(244, 99, 58, 0.12);
  color: var(--ks-primary-text);
  opacity: 1;
}
.hist__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
}
.hist__empty-text {
  margin: 0;
  font-size: 14px;
  color: var(--ks-text-tertiary);
}
.hist__more {
  display: flex;
  justify-content: center;
}
@media (max-width: 767px) {
  .hist {
    padding: 16px 12px 40px;
  }
  .hist__head {
    display: none;
  }
  .hist__row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .hist__cell::before {
    content: attr(data-label);
    font-size: 11px;
    font-weight: 700;
    color: var(--ks-text-tertiary);
  }
  .hist__actions {
    margin-left: 0;
    width: 100%;
  }
  .hist__actions .hist__btn {
    flex: 1 1 auto;
  }
}
</style>
