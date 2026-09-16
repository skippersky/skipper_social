<script setup lang="ts">
/**
 * Marketing hub (Sprint 11).
 *
 * The landing page of the module: this month's numbers on top, the campaign
 * list below, filtered by status and searched by name. Every mutation goes
 * through useMarketing -> store -> api, so the demo fallback and the real
 * backend render through exactly the same template.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import CampaignCard from '../../../components/marketing/CampaignCard.vue';
import { STATUS_FILTERS, useMarketing } from '../../../composables/useMarketing';
import type { StatusFilter } from '../../../composables/useMarketing';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { useMarketingStore } from '../../../stores/marketing';

const i18n = useI18nStore();
const router = useRouter();
const store = useMarketingStore();

usePageMeta(i18n.t('marketing.metaTitle'), i18n.t('marketing.metaDescription'));

/* Destructured so each slice auto-unwraps in the template. */
const {
  campaigns,
  campaignsTotal,
  hasMore,
  loading,
  error,
  overview,
  statusFilter,
  query,
  refresh,
  search,
  filterStatus,
  loadMore,
  transition
} = useMarketing();

/* Sample-data disclosure, mirroring analytics, inbox and the customer list. */
const DEMO_HIDDEN_KEY = 'ks-marketing-demo-hidden';
const demoHidden = ref(false);
const showDemoBar = computed(() => store.hasDemoData && !demoHidden.value);

/** Local mirror so typing does not fire a request per keystroke. */
const searchText = ref('');
const filters = STATUS_FILTERS;

const kpi = computed(() => ({
  sent: formatNumber(overview.value.monthSent, i18n.locale),
  openRate: overview.value.monthOpenRate + '%',
  conversionRate: overview.value.monthConversionRate + '%',
  active: formatNumber(overview.value.activeCampaigns, i18n.locale)
}));

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

function onStatus(next: StatusFilter): void {
  void filterStatus(next);
}

function onSearchSubmit(): void {
  void search(searchText.value);
}

function clearSearch(): void {
  searchText.value = '';
  void search('');
}

function openDetail(id: string): void {
  void router.push('/dashboard/marketing/campaigns/' + id);
}

const TOAST_KEY: Record<'start' | 'pause' | 'cancel', string> = {
  start: 'marketing.startedToast',
  pause: 'marketing.pausedToast',
  cancel: 'marketing.cancelledToast'
};

async function onTransition(id: string, action: 'start' | 'pause' | 'cancel'): Promise<void> {
  const next = await transition(id, action);
  if (next) showToast(i18n.t(TOAST_KEY[action]));
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
  searchText.value = query.value;
  void store.fetchOverview();
  void refresh();
});
</script>

<template>
  <section class="mkt">
    <header class="mkt__top">
      <button
        class="mkt__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <div class="mkt__heading">
        <h1 class="mkt__title">{{ i18n.t('marketing.title') }}</h1>
        <p class="mkt__subtitle">{{ i18n.t('marketing.subtitle') }}</p>
      </div>
      <div class="mkt__top-actions">
        <router-link class="mkt__link" to="/dashboard/marketing/templates">
          {{ i18n.t('marketing.templatesEntry') }}
        </router-link>
        <router-link class="mkt__link" to="/dashboard/marketing/history">
          {{ i18n.t('marketing.historyEntry') }}
        </router-link>
        <button
          class="mkt__btn is-primary"
          type="button"
          @click="router.push('/dashboard/marketing/create')"
        >
          {{ i18n.t('marketing.newCampaign') }}
        </button>
      </div>
    </header>

    <div v-if="showDemoBar" class="mkt__demo">
      <span>{{ i18n.t('marketing.demoNotice') }}</span>
      <button type="button" :aria-label="i18n.t('marketing.demoHide')" @click="hideDemo">&times;</button>
    </div>

    <div class="mkt__kpis">
      <article class="mkt__kpi">
        <span class="mkt__kpi-label">{{ i18n.t('marketing.overview.monthSent') }}</span>
        <strong class="mkt__kpi-value">{{ kpi.sent }}</strong>
      </article>
      <article class="mkt__kpi">
        <span class="mkt__kpi-label">{{ i18n.t('marketing.overview.openRate') }}</span>
        <strong class="mkt__kpi-value">{{ kpi.openRate }}</strong>
      </article>
      <article class="mkt__kpi">
        <span class="mkt__kpi-label">{{ i18n.t('marketing.overview.conversionRate') }}</span>
        <strong class="mkt__kpi-value">{{ kpi.conversionRate }}</strong>
      </article>
      <article class="mkt__kpi">
        <span class="mkt__kpi-label">{{ i18n.t('marketing.overview.activeCampaigns') }}</span>
        <strong class="mkt__kpi-value">{{ kpi.active }}</strong>
      </article>
    </div>

    <div class="mkt__toolbar">
      <form class="mkt__search" @submit.prevent="onSearchSubmit">
        <input
          v-model="searchText"
          class="mkt__input"
          type="search"
          :placeholder="i18n.t('marketing.searchPlaceholder')"
          :aria-label="i18n.t('marketing.searchPlaceholder')"
        />
        <button class="mkt__btn" type="submit" :disabled="loading">
          {{ i18n.t('common.search') }}
        </button>
        <button v-if="searchText" class="mkt__btn is-ghost" type="button" @click="clearSearch">
          {{ i18n.t('common.clear') }}
        </button>
      </form>
      <span class="mkt__count">{{ i18n.t('marketing.totalCampaigns', { n: campaignsTotal }) }}</span>
    </div>

    <div class="mkt__tabs" role="tablist">
      <button
        v-for="item in filters"
        :key="item"
        class="mkt__tab"
        :class="{ 'is-active': statusFilter === item }"
        type="button"
        role="tab"
        :aria-selected="statusFilter === item"
        @click="onStatus(item)"
      >
        {{ i18n.t('marketing.status.' + item) }}
      </button>
    </div>

    <p v-if="error" class="mkt__error">{{ i18n.t(error) }}</p>

    <div v-if="campaigns.length > 0" class="mkt__grid">
      <CampaignCard
        v-for="campaign in campaigns"
        :key="campaign.id"
        :campaign="campaign"
        @open="openDetail"
        @start="(id) => onTransition(id, 'start')"
        @pause="(id) => onTransition(id, 'pause')"
        @cancel="(id) => onTransition(id, 'cancel')"
      />
    </div>

    <div v-else-if="!loading" class="mkt__empty">
      <h2 class="mkt__empty-title">{{ i18n.t('marketing.empty') }}</h2>
      <p class="mkt__empty-hint">{{ i18n.t('marketing.emptyHint') }}</p>
      <button
        class="mkt__btn is-primary"
        type="button"
        @click="router.push('/dashboard/marketing/create')"
      >
        {{ i18n.t('marketing.newCampaign') }}
      </button>
    </div>

    <div v-if="hasMore" class="mkt__more">
      <button class="mkt__btn" type="button" :disabled="loading" @click="loadMore">
        {{ i18n.t('marketing.loadMore') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.mkt {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  box-sizing: border-box;
}
.mkt__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.mkt__home {
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
.mkt__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mkt__heading {
  flex: 1 1 260px;
  min-width: 0;
}
.mkt__title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--ks-text-primary);
}
.mkt__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-tertiary);
}
.mkt__top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mkt__link {
  height: 38px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.mkt__link:hover {
  background: var(--ks-bg-muted);
}
.mkt__btn {
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
.mkt__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.mkt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mkt__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mkt__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.mkt__btn.is-primary:hover:not(:disabled) {
  filter: brightness(1.04);
}
.mkt__btn.is-ghost {
  border-color: transparent;
  color: var(--ks-primary-text);
}
.mkt__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--ks-warning);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-soft);
  font-size: 12px;
  color: var(--ks-text-primary);
}
.mkt__demo button {
  flex: none;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.mkt__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.mkt__kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.mkt__kpi-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.mkt__kpi-value {
  font-size: 24px;
  line-height: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ks-text-primary);
}
.mkt__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mkt__search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 320px;
  min-width: 0;
}
.mkt__input {
  flex: 1;
  min-width: 160px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.mkt__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.mkt__count {
  font-size: 12px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.mkt__tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.mkt__tab {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.mkt__tab:hover {
  color: var(--ks-text-primary);
}
.mkt__tab.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.mkt__tab:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mkt__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.mkt__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}
.mkt__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.mkt__empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.mkt__empty-hint {
  margin: 0;
  max-width: 420px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.mkt__more {
  display: flex;
  justify-content: center;
}

@media (max-width: 1023px) {
  .mkt__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .mkt {
    padding: 16px 12px 40px;
  }
  .mkt__title {
    font-size: 20px;
    line-height: 26px;
  }
  .mkt__top-actions {
    width: 100%;
  }
  .mkt__top-actions .mkt__btn.is-primary {
    flex: 1 1 auto;
  }
  .mkt__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .mkt__search {
    flex: 1 1 100%;
  }
  .mkt__tab {
    flex: 1 1 auto;
  }
}
</style>
