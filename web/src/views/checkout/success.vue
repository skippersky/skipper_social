<script setup lang="ts">
import { onMounted } from 'vue';
import SubscriptionStatusBadge from '../../components/subscription/SubscriptionStatusBadge.vue';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';
import { useSubscriptionStore } from '../../stores/subscription';

const i18n = useI18nStore();
const sub = useSubscriptionStore();

usePageMeta(i18n.t('checkout.successMetaTitle'), i18n.t('checkout.successMetaDescription'));

onMounted(async () => {
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
});
</script>

<template>
  <section class="checkout-result">
    <div class="checkout-result__card">
      <span class="checkout-result__icon checkout-result__icon--success" aria-hidden="true">✓</span>
      <h1 class="checkout-result__title">{{ i18n.t('checkout.successTitle') }}</h1>
      <p class="checkout-result__body">{{ i18n.t('checkout.successBody') }}</p>
      <div v-if="sub.currentSubscription" class="checkout-result__summary">
        <span class="checkout-result__plan">{{ sub.currentPlanName }}</span>
        <SubscriptionStatusBadge :status="sub.subscriptionStatus" />
      </div>
      <router-link to="/dashboard/subscription" class="checkout-result__cta">
        {{ i18n.t('checkout.viewSubscription') }}
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.checkout-result {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
}
.checkout-result__card {
  max-width: 460px;
  width: 100%;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 40px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.checkout-result__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
}
.checkout-result__icon--success {
  background: rgba(21, 128, 61, 0.12);
  color: var(--ks-success);
}
.checkout-result__title {
  font-size: 22px;
  font-weight: 800;
}
.checkout-result__body {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 14px;
  line-height: 22px;
}
.checkout-result__summary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
}
.checkout-result__plan {
  font-weight: 700;
  font-size: 14px;
}
.checkout-result__cta {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 26px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.checkout-result__cta:hover {
  filter: brightness(1.05);
}
</style>