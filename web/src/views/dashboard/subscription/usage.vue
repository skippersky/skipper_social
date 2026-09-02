<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import UsageBar from '../../../components/subscription/UsageBar.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { useSubscriptionStore } from '../../../stores/subscription';
import { useUsageStore } from '../../../stores/usage';

const router = useRouter();
const i18n = useI18nStore();
const sub = useSubscriptionStore();
const usage = useUsageStore();

usePageMeta(i18n.t('usage.metaTitle'), i18n.t('usage.metaDescription'));

const ALERTS_KEY = 'ks-usage-alerts';
const alerts = ref(false);
try {
  alerts.value = localStorage.getItem(ALERTS_KEY) === '1';
} catch {
  /* private mode */
}

function onAlertsChange(value: boolean): void {
  alerts.value = value;
  try {
    localStorage.setItem(ALERTS_KEY, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

onMounted(async () => {
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  await Promise.all([usage.fetchUsage(), usage.fetchUsageHistory('14d')]);
});

const maxDaily = computed(() => Math.max(1, ...usage.history.map((r) => r.aiGenerations)));
</script>
<template>
  <section class="usage-page">
    <header class="usage-page__top">
      <button
        class="page__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/dashboard/subscription')"
      >←</button>
      <h1 class="usage-page__title">{{ i18n.t('usage.title') }}</h1>
    </header>

    <section v-if="usage.usage && sub.currentPlan" class="usage-page__overview">
      <UsageBar
        :label="i18n.t('usage.ai')"
        :used="usage.usage.aiGenerations"
        :limit="sub.currentPlan.quotas.aiGenerations"
      />
      <UsageBar
        :label="i18n.t('usage.messages')"
        :used="usage.usage.messages"
        :limit="sub.currentPlan.quotas.messages"
      />
      <UsageBar
        :label="i18n.t('usage.publish')"
        :used="usage.usage.scheduledPosts"
        :limit="sub.currentPlan.quotas.scheduledPosts"
      />
    </section>

    <section class="usage-page__panel">
      <h2 class="section-title">{{ i18n.t('usage.trendTitle') }}</h2>
      <div v-if="usage.history.length" class="trend" role="img" :aria-label="i18n.t('usage.trendTitle')">
        <div
          v-for="record in usage.history"
          :key="record.date"
          class="trend__bar"
          :style="{ height: Math.max(6, Math.round((record.aiGenerations / maxDaily) * 100)) + '%' }"
          :title="`${record.date}: ${record.aiGenerations}`"
        ></div>
      </div>
      <p v-else class="usage-page__empty">{{ i18n.t('usage.empty') }}</p>
    </section>

    <section class="usage-page__panel">
      <h2 class="section-title">{{ i18n.t('usage.historyTitle') }}</h2>
      <ul v-if="usage.history.length" class="history">
        <li v-for="record in usage.history" :key="record.date" class="history__row">
          <span class="history__date">{{ record.date }}</span>
          <span class="history__cell">{{ i18n.t('usage.ai') }}: {{ record.aiGenerations }}</span>
          <span class="history__cell">{{ i18n.t('usage.messages') }}: {{ record.messages }}</span>
          <span class="history__cell">{{ i18n.t('usage.publish') }}: {{ record.scheduledPosts }}</span>
        </li>
      </ul>
      <p v-else class="usage-page__empty">{{ i18n.t('usage.empty') }}</p>
    </section>

    <section class="usage-page__panel usage-page__alerts">
      <div>
        <h2 class="section-title">{{ i18n.t('usage.reminders') }}</h2>
        <p class="usage-page__hint">{{ i18n.t('usage.remindersHint') }}</p>
      </div>
      <van-switch :model-value="alerts" size="22" @update:model-value="onAlertsChange" />
    </section>
  </section>
</template>
<style scoped>
.usage-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.usage-page__top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.page__home {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 16px;
  cursor: pointer;
}
.page__home:hover {
  background: var(--ks-bg-muted);
}
.usage-page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 800;
}
.section-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  margin: 0 0 14px;
}
.usage-page__overview {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}
.usage-page__panel {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
}
.trend {
  height: 120px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.trend__bar {
  flex: 1;
  min-height: 6px;
  border-radius: 4px 4px 0 0;
  background: var(--ks-grad-brand);
}
.history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.history__row {
  display: flex;
  gap: 18px;
  padding: 9px 0;
  border-bottom: 1px solid var(--ks-border-default);
  font-size: 13px;
  color: var(--ks-text-secondary);
  flex-wrap: wrap;
}
.history__row:last-child {
  border-bottom: none;
}
.history__date {
  min-width: 96px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.usage-page__empty {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 13px;
}
.usage-page__alerts {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}
.usage-page__alerts .section-title {
  margin-bottom: 4px;
}
.usage-page__hint {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 13px;
}
@media (max-width: 767px) {
  .usage-page {
    padding: 16px 16px 64px;
  }
  .usage-page__overview {
    grid-template-columns: 1fr;
  }
}
</style>