<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import PlanCard from '../../../components/subscription/PlanCard.vue';
import SubscriptionStatusBadge from '../../../components/subscription/SubscriptionStatusBadge.vue';
import UsageBar from '../../../components/subscription/UsageBar.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { useSubscriptionStore } from '../../../stores/subscription';
import { useUsageStore } from '../../../stores/usage';

const router = useRouter();
const i18n = useI18nStore();
const sub = useSubscriptionStore();
const usage = useUsageStore();

usePageMeta(i18n.t('sub.metaTitle'), i18n.t('sub.metaDescription'));

onMounted(async () => {
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  await usage.fetchUsage();
});

function formatDate(ms: number): string {
  const locale = i18n.locale === 'zh' ? 'zh-CN' : i18n.locale === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(ms).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function goToUpgrade(planId?: string): void {
  void router.push(
    planId
      ? { path: '/dashboard/subscription/upgrade', query: { plan: planId } }
      : '/dashboard/subscription/upgrade'
  );
}

async function onCancel(): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('sub.cancelConfirmTitle'),
      message: i18n.t('sub.cancelConfirmBody')
    });
  } catch {
    return;
  }
  if (await sub.cancel()) showToast(i18n.t('sub.cancelledToast'));
  else if (sub.error) showToast(i18n.t(sub.error));
}

async function onResume(): Promise<void> {
  if (await sub.resume()) await usage.fetchUsage();
  else if (sub.error) showToast(i18n.t(sub.error));
}
</script>
<template>
  <section class="sub-page">
    <header class="sub-page__top">
      <button
        class="page__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >←</button>
      <div class="sub-page__headings">
        <h1 class="sub-page__title">{{ i18n.t('sub.title') }}</h1>
        <p v-if="sub.currentSubscription?.demo" class="sub-page__demo">{{ i18n.t('sub.demoBadge') }}</p>
      </div>
    </header>

    <article v-if="sub.currentSubscription" class="sub-current">
      <div class="sub-current__main">
        <p class="sub-current__label">{{ i18n.t('sub.currentPlan') }}</p>
        <div class="sub-current__line">
          <h2 class="sub-current__name">{{ sub.currentPlanName }}</h2>
          <SubscriptionStatusBadge :status="sub.subscriptionStatus" />
        </div>
        <p class="sub-current__price">
          ${{ sub.currentPlan?.priceUsd ?? 0 }}<span>{{ i18n.t('pricing.month') }}</span>
        </p>
        <p class="sub-current__billing">
          {{ i18n.t('sub.nextBilling') }}: {{ formatDate(sub.currentSubscription.currentPeriodEnd) }}
        </p>
      </div>
      <div class="sub-current__actions">
        <button
          v-if="sub.subscriptionStatus !== 'canceled'"
          type="button"
          class="btn-ghost"
          @click="goToUpgrade()"
        >{{ i18n.t('sub.changePlan') }}</button>
        <button
          v-if="sub.subscriptionStatus === 'canceled'"
          type="button"
          class="btn-primary"
          @click="onResume"
        >{{ i18n.t('sub.resume') }}</button>
        <button
          v-else-if="sub.isPaidPlan"
          type="button"
          class="btn-danger"
          @click="onCancel"
        >{{ i18n.t('sub.cancel') }}</button>
      </div>
    </article>

    <section class="sub-usage">
      <div class="sub-usage__head">
        <h2 class="section-title">{{ i18n.t('sub.usageTitle') }}</h2>
        <router-link to="/dashboard/subscription/usage" class="sub-usage__detail">
          {{ i18n.t('sub.usageDetail') }}
        </router-link>
      </div>
      <div v-if="usage.usage && sub.currentPlan" class="sub-usage__bars">
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
      </div>
    </section>

    <section class="sub-plans">
      <h2 class="section-title">{{ i18n.t('sub.compareTitle') }}</h2>
      <div class="sub-plans__grid">
        <PlanCard
          v-for="plan in sub.plans"
          :key="plan.id"
          :plan="plan"
          :current="plan.id === sub.currentPlanId"
          :cta-text="
            plan.id === sub.currentPlanId
              ? undefined
              : sub.compareTiers(plan.id) > 0
                ? i18n.t('sub.upgrade')
                : i18n.t('sub.downgrade')
          "
          @cta="goToUpgrade(plan.id)"
        />
      </div>
    </section>
  </section>
</template>
<style scoped>
.sub-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.sub-page__top {
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
.sub-page__headings {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.sub-page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 800;
}
.sub-page__demo {
  margin: 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(91, 91, 214, 0.1);
  color: var(--ks-accent);
  font-size: 12px;
  font-weight: 600;
}
.section-title {
  font-size: 17px;
  line-height: 25px;
  font-weight: 700;
}
.sub-current {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.sub-current__label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.sub-current__line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sub-current__name {
  font-size: 26px;
  font-weight: 800;
}
.sub-current__price {
  margin: 10px 0 4px;
  font-family: Sora, sans-serif;
  font-size: 30px;
  font-weight: 800;
}
.sub-current__price span {
  font-size: 13px;
  font-weight: 500;
  color: var(--ks-text-tertiary);
}
.sub-current__billing {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
}
.sub-current__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}.btn-primary,
.btn-ghost,
.btn-danger {
  height: 42px;
  padding: 0 20px;
  border-radius: var(--ks-radius-btn);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.btn-primary:hover {
  filter: brightness(1.05);
}
.btn-ghost {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.btn-ghost:hover {
  background: var(--ks-bg-muted);
}
.btn-danger {
  background: rgba(220, 38, 38, 0.08);
  color: var(--ks-error);
  border: 1px solid rgba(220, 38, 38, 0.25);
}
.btn-danger:hover {
  background: rgba(220, 38, 38, 0.14);
}
.sub-usage {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.sub-usage__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sub-usage__detail {
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.sub-usage__bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}
.sub-plans__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  align-items: start;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .sub-plans__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .sub-usage__bars {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 767px) {
  .sub-page {
    padding: 16px 16px 64px;
  }
  .sub-current {
    flex-direction: column;
  }
  .sub-current__actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .sub-usage__bars,
  .sub-plans__grid {
    grid-template-columns: 1fr;
  }
}
</style>