<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import ChannelPieChart from '../../../components/analytics/ChannelPieChart.vue';
import DateRangePicker from '../../../components/analytics/DateRangePicker.vue';
import ResponseTimeGauge from '../../../components/analytics/ResponseTimeGauge.vue';
import StatCard from '../../../components/analytics/StatCard.vue';
import TopCustomersTable from '../../../components/analytics/TopCustomersTable.vue';
import TrendChart from '../../../components/analytics/TrendChart.vue';
import type { TrendSeriesSpec } from '../../../composables/useChart';
import { useDashboard } from '../../../composables/useDashboard';
import { useDateRange } from '../../../composables/useDateRange';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { formatDuration, formatNumber } from '../../../lib/metrics';
import { useAnalyticsStore } from '../../../stores/analytics';
import type { DateRangePreset, TrendGranularity } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const store = useAnalyticsStore();
const dashboard = useDashboard();

usePageMeta(i18n.t('analytics.metaTitle'), i18n.t('analytics.metaDescription'));

/* Destructured so the template auto-unwraps each slice. */
const {
  overviewStats,
  conversationTrend,
  messageTrend,
  channelDistribution,
  responseTimeStats,
  topCustomers,
  loading,
  error,
  hasDemoData
} = dashboard;

const { range, preset, customError, setPreset, applyCustom } = useDateRange();

/* Sample-data disclosure, mirroring the inbox and the customer directory. */
const DEMO_HIDDEN_KEY = 'ks-analytics-demo-hidden';
const demoHidden = ref(false);
const showDemoBar = computed(() => hasDemoData.value && !demoHidden.value);

const conversationSeries = computed<TrendSeriesSpec[]>(() => [
  { key: 'count', label: i18n.t('analytics.seriesConversations') }
]);

const messageSeries = computed<TrendSeriesSpec[]>(() => [
  { key: 'inbound', label: i18n.t('analytics.seriesInbound') },
  { key: 'outbound', label: i18n.t('analytics.seriesOutbound') }
]);

const kpi = computed(() => {
  const stats = overviewStats.value;
  return {
    customers: formatNumber(store.totalCustomers, i18n.locale),
    customersChange: stats ? stats.customersChange : undefined,
    conversations: formatNumber(store.totalConversations, i18n.locale),
    conversationsChange: stats ? stats.conversationsChange : undefined,
    messages: formatNumber(store.totalMessages, i18n.locale),
    messagesChange: stats ? stats.messagesChange : undefined,
    response: formatDuration(store.averageResponseTime),
    /* The service target ships with the response-time slice, not the overview. */
    responseHint: responseTimeStats.value
      ? i18n.t('analytics.responseTargetHint', {
          value: formatDuration(responseTimeStats.value.targetMinutes * 60_000)
        })
      : ''
  };
});

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

function onPreset(next: DateRangePreset): void {
  setPreset(next);
  // 'custom' only reveals the date inputs; that window applies on form submit.
  if (next !== 'custom') dashboard.applyRange(range.value);
}

function onCustom(from: string, to: string): void {
  if (applyCustom(from, to)) dashboard.applyRange(range.value);
}

function onRefresh(): void {
  void dashboard.refreshAll(true);
}

/** Granularity is part of the store cache key, so this refetches only that slice. */
async function onConversationGranularity(next: TrendGranularity): Promise<void> {
  store.setConversationGranularity(next);
  await dashboard.loadConversationTrend();
}

async function onMessageGranularity(next: TrendGranularity): Promise<void> {
  store.setMessageGranularity(next);
  await dashboard.loadMessageTrend();
}

function openCustomer(id: string): void {
  void router.push(`/dashboard/customers/${id}`);
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(() => {
  try {
    demoHidden.value = localStorage.getItem(DEMO_HIDDEN_KEY) === '1';
  } catch {
    /* private mode */
  }
  // Align the store window with the picker before the first load.
  dashboard.setRange(range.value);
  void dashboard.refreshAll();
});
</script>

<template>
  <section class="analytics">
    <header class="analytics__top">
      <button
        class="analytics__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <h1 class="analytics__title">{{ i18n.t('analytics.title') }}</h1>
      <span v-if="loading" class="analytics__badge" role="status">{{ i18n.t('analytics.loading') }}</span>
      <span v-else-if="store.unreadCount > 0" class="analytics__badge analytics__badge--unread">
        {{ i18n.t('analytics.unreadHint', { n: store.unreadCount }) }}
      </span>
    </header>

    <div v-if="showDemoBar" class="analytics__demo">
      <span>{{ i18n.t('analytics.demoNotice') }}</span>
      <button type="button" :aria-label="i18n.t('analytics.demoHide')" @click="hideDemo">&times;</button>
    </div>

    <div class="analytics__toolbar">
      <DateRangePicker
        :preset="preset"
        :from="range.from"
        :to="range.to"
        :error="customError"
        @preset="onPreset"
        @custom="onCustom"
      />
      <button class="analytics__refresh" type="button" :disabled="loading" @click="onRefresh">
        <span class="analytics__refresh-icon" aria-hidden="true">&#8635;</span>
        {{ i18n.t('analytics.refresh') }}
      </button>
    </div>

    <div class="analytics__kpis">
      <StatCard
        :label="i18n.t('analytics.kpiCustomers')"
        :value="kpi.customers"
        :change="kpi.customersChange"
        :loading="loading"
      />
      <StatCard
        :label="i18n.t('analytics.kpiConversations')"
        :value="kpi.conversations"
        :change="kpi.conversationsChange"
        :loading="loading"
      />
      <StatCard
        :label="i18n.t('analytics.kpiMessages')"
        :value="kpi.messages"
        :change="kpi.messagesChange"
        :loading="loading"
      />
      <StatCard
        :label="i18n.t('analytics.kpiResponse')"
        :value="kpi.response"
        :hint="kpi.responseHint"
        :loading="loading"
      />
    </div>

    <div class="analytics__grid">
      <TrendChart
        :title="i18n.t('analytics.trendConversationsTitle')"
        :points="conversationTrend"
        :granularity="store.conversationGranularity"
        :series="conversationSeries"
        :loading="loading"
        :error="error"
        @update:granularity="onConversationGranularity"
        @retry="onRefresh"
      />
      <TrendChart
        :title="i18n.t('analytics.trendMessagesTitle')"
        :points="messageTrend"
        :granularity="store.messageGranularity"
        :series="messageSeries"
        :loading="loading"
        :error="error"
        @update:granularity="onMessageGranularity"
        @retry="onRefresh"
      />
    </div>

    <div class="analytics__grid">
      <ChannelPieChart
        :slices="channelDistribution"
        :loading="loading"
        :error="error"
        @retry="onRefresh"
      />
      <ResponseTimeGauge
        :stats="responseTimeStats"
        :loading="loading"
        :error="error"
        @retry="onRefresh"
      />
    </div>

    <TopCustomersTable
      :rows="topCustomers"
      :loading="loading"
      :error="error"
      @retry="onRefresh"
      @select="openCustomer"
    />
  </section>
</template>

<style scoped>
.analytics {
  flex: 1;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.analytics__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.analytics__home {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.analytics__home:hover {
  background: var(--ks-bg-muted);
}
.analytics__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.analytics__badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 2px 10px;
}
.analytics__badge--unread {
  color: var(--ks-primary-text);
  background: var(--ks-grad-soft);
}
.analytics__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid rgba(180, 83, 9, 0.2);
  border-radius: var(--ks-radius-card);
}
.analytics__demo button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ks-warning);
  font-size: 14px;
  cursor: pointer;
}
.analytics__demo button:hover {
  background: rgba(180, 83, 9, 0.15);
}
.analytics__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.analytics__refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  flex-shrink: 0;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.analytics__refresh:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.analytics__refresh:disabled {
  opacity: 0.55;
  cursor: default;
}
.analytics__refresh-icon {
  font-size: 15px;
  line-height: 1;
  color: var(--ks-primary-text);
}
.analytics__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.analytics__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 1023px) {
  .analytics__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .analytics__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .analytics {
    padding: 14px 14px 40px;
    gap: 12px;
  }
  .analytics__title {
    font-size: 19px;
    line-height: 26px;
  }
  .analytics__toolbar {
    padding: 12px;
  }
  .analytics__refresh {
    width: 100%;
    justify-content: center;
  }
}
</style>