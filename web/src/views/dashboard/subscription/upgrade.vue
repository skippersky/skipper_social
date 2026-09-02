<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { TIER_ORDER } from '../../../api/demo';
import PlanCard from '../../../components/subscription/PlanCard.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { useSubscriptionStore } from '../../../stores/subscription';
import type { SubscriptionTier } from '../../../types';

const route = useRoute();
const router = useRouter();
const i18n = useI18nStore();
const sub = useSubscriptionStore();

usePageMeta(i18n.t('upgrade.metaTitle'), i18n.t('upgrade.metaDescription'));

const selected = ref<SubscriptionTier>('basic');
let initialized = false;

function isTier(value: unknown): value is SubscriptionTier {
  return value === 'free' || value === 'basic' || value === 'pro';
}

onMounted(async () => {
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  const query = route.query.plan;
  if (isTier(query)) {
    selected.value = query;
  } else {
    const higher = sub.plans.find((p) => TIER_ORDER[p.id] > TIER_ORDER[sub.currentPlanId]);
    selected.value = higher?.id ?? sub.currentPlanId;
  }
  initialized = true;
});

const diff = computed(() => TIER_ORDER[selected.value] - TIER_ORDER[sub.currentPlanId]);

const ctaLabel = computed(() => {
  if (selected.value === sub.currentPlanId) return i18n.t('upgrade.current');
  return diff.value > 0 ? i18n.t('upgrade.subscribe') : i18n.t('sub.downgrade');
});

function onSelect(planId: SubscriptionTier): void {
  selected.value = planId;
}

async function onPrimary(): Promise<void> {
  if (!initialized || selected.value === sub.currentPlanId) return;
  if (diff.value > 0) {
    const url = await sub.subscribe(selected.value);
    if (!url) {
      if (sub.error) showToast(i18n.t(sub.error));
      return;
    }
    if (url.startsWith('/')) {
      await router.push(url);
    } else {
      window.location.assign(url);
    }
    return;
  }
  try {
    await showConfirmDialog({
      title: i18n.t('upgrade.downgradeConfirmTitle'),
      message: i18n.t('upgrade.downgradeConfirmBody')
    });
  } catch {
    return;
  }
  if (await sub.changePlan(selected.value)) {
    showToast(i18n.t('upgrade.downgraded'));
  } else if (sub.error) {
    showToast(i18n.t(sub.error));
  }
}
</script>
<template>
  <section class="upgrade-page">
    <header class="upgrade-page__top">
      <button
        class="page__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/dashboard/subscription')"
      >←</button>
      <h1 class="upgrade-page__title">{{ i18n.t('upgrade.title') }}</h1>
    </header>

    <div class="upgrade-page__grid">
      <PlanCard
        v-for="plan in sub.plans"
        :key="plan.id"
        :plan="plan"
        :current="plan.id === sub.currentPlanId"
        :selected="selected === plan.id"
        @select="onSelect(plan.id)"
      />
    </div>

    <div class="upgrade-page__footer">
      <button
        type="button"
        class="upgrade-page__cta"
        :disabled="!initialized || selected === sub.currentPlanId || sub.loading"
        @click="onPrimary"
      >
        {{ ctaLabel }}
      </button>
      <p v-if="sub.error" class="upgrade-page__error">{{ i18n.t(sub.error) }}</p>
    </div>
  </section>
</template>
<style scoped>
.upgrade-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.upgrade-page__top {
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
.upgrade-page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 800;
}
.upgrade-page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  align-items: start;
}
.upgrade-page__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.upgrade-page__cta {
  min-width: 260px;
  height: 48px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.upgrade-page__cta:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: 0 8px 20px rgba(244, 99, 58, 0.25);
}
.upgrade-page__cta:disabled {
  opacity: 0.55;
  cursor: default;
}
.upgrade-page__error {
  margin: 0;
  color: var(--ks-error);
  font-size: 13px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .upgrade-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 767px) {
  .upgrade-page {
    padding: 16px 16px 64px;
  }
  .upgrade-page__grid {
    grid-template-columns: 1fr;
  }
  .upgrade-page__cta {
    width: 100%;
  }
}
</style>