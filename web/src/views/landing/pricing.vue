<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';
import { useAuthStore } from '../../stores/auth';

const i18n = useI18nStore();
const auth = useAuthStore();

usePageMeta(i18n.t('pricing.metaTitle'), i18n.t('pricing.metaDescription'));

const plans = computed(() => [
  { key: 'free', name: 'Free', price: '$0', desc: i18n.t('pricing.freeDesc'), featured: false },
  { key: 'basic', name: 'Basic', price: '$9', desc: i18n.t('pricing.basicDesc'), featured: true },
  { key: 'pro', name: 'Pro', price: '$29', desc: i18n.t('pricing.proDesc'), featured: false }
]);

const rows = computed(() => [
  { label: i18n.t('pricing.rowAi'), cells: ['30', '500', '5,000'] },
  { label: i18n.t('pricing.rowMessages'), cells: ['200', '5,000', '50,000'] },
  { label: i18n.t('pricing.rowChannels'), cells: ['1', '3', i18n.t('pricing.allChannels')] },
  { label: i18n.t('pricing.rowPublish'), cells: ['—', '60', '600'] },
  {
    label: i18n.t('pricing.rowSupport'),
    cells: [i18n.t('pricing.supportFree'), i18n.t('pricing.supportBasic'), i18n.t('pricing.supportPro')]
  }
]);

const currentTier = computed(() => auth.user?.subscriptionTier ?? null);
const router = useRouter();

function onChoose(): void {
  void router.push('/dashboard/subscription/upgrade');
}
</script>

<template>
  <div class="pricing-page">
    <header class="pricing-head">
      <h1 class="pricing-head__title">{{ i18n.t('pricing.title') }}</h1>
      <p class="pricing-head__subtitle">{{ i18n.t('pricing.subtitle') }}</p>
    </header>
    <div class="pricing-grid">
      <article
        v-for="(plan, planIdx) in plans"
        :key="plan.key"
        class="plan"
        :class="{ 'plan--featured': plan.featured, 'plan--current': currentTier === plan.key }"
      >
        <p v-if="currentTier === plan.key" class="plan__badge">{{ i18n.t('pricing.current') }}</p>
        <h2 class="plan__name">{{ plan.name }}</h2>
        <p class="plan__price">{{ plan.price }}<span>{{ i18n.t('pricing.month') }}</span></p>
        <p class="plan__desc">{{ plan.desc }}</p>
        <ul class="plan__rows">
          <li v-for="row in rows" :key="row.label" class="plan__row">
            <span class="plan__row-label">{{ row.label }}</span>
            <span class="plan__row-value">{{ row.cells[planIdx] }}</span>
          </li>
        </ul>
        <router-link v-if="!auth.isAuthenticated" to="/register" class="plan__cta">
          {{ i18n.t('pricing.choose') }}
        </router-link>
        <button
          v-else
          type="button"
          class="plan__cta"
          :disabled="currentTier === plan.key"
          @click="onChoose"
        >
          {{ currentTier === plan.key ? i18n.t('pricing.current') : i18n.t('pricing.upgrade') }}
        </button>
      </article>
    </div>
  </div>
</template>
<style scoped>
.pricing-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 20px 80px;
}
.pricing-head {
  text-align: center;
  margin-bottom: 40px;
}
.pricing-head__title {
  font-size: 34px;
  line-height: 44px;
  font-weight: 800;
  margin: 0 0 10px;
}
.pricing-head__subtitle {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 16px;
}
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
}
.plan {
  position: relative;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 28px 26px;
  display: flex;
  flex-direction: column;
}
.plan--featured {
  border: 2px solid var(--ks-primary);
  box-shadow: var(--ks-shadow-float);
}
.plan--current {
  outline: 2px solid var(--ks-accent);
  outline-offset: 2px;
}
.plan__badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--ks-accent);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.plan__name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-secondary);
}
.plan__price {
  margin: 12px 0 6px;
  font-family: Sora, sans-serif;
  font-size: 40px;
  font-weight: 800;
}
.plan__price span {
  font-size: 14px;
  font-weight: 500;
  color: var(--ks-text-tertiary);
}
.plan__desc {
  margin: 0 0 18px;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 20px;
  min-height: 40px;
}
.plan__rows {
  list-style: none;
  margin: 0 0 22px;
  padding: 18px 0 0;
  border-top: 1px solid var(--ks-border-default);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.plan__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.plan__row-label {
  color: var(--ks-text-secondary);
}
.plan__row-value {
  font-weight: 600;
  color: var(--ks-text-primary);
}
.plan__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.plan__cta:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: 0 8px 20px rgba(244, 99, 58, 0.25);
}
.plan__cta:disabled {
  opacity: 0.55;
  cursor: default;
}
.pricing-soon {
  margin: 28px auto 0;
  max-width: 640px;
  text-align: center;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(91, 91, 214, 0.08);
  color: var(--ks-accent);
  font-size: 13px;
  line-height: 20px;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .pricing-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 767px) {
  .pricing-page {
    padding: 40px 20px 64px;
  }
  .pricing-grid {
    grid-template-columns: 1fr;
  }
  .plan__cta {
    width: 100%;
  }
}
</style>