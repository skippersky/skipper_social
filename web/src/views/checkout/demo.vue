<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { demoPendingPlan } from '../../api/demo';
import * as subApi from '../../api/subscription';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';
import { useSubscriptionStore } from '../../stores/subscription';

const router = useRouter();
const i18n = useI18nStore();
const sub = useSubscriptionStore();

usePageMeta(i18n.t('checkout.demoMetaTitle'), i18n.t('checkout.demoMetaDescription'));

const paying = ref(false);
const pendingPlan = ref<string | null>(null);

onMounted(async () => {
  await sub.fetchPlans();
  pendingPlan.value = demoPendingPlan();
});

const plan = computed(() => sub.plans.find((p) => p.id === pendingPlan.value) ?? null);

async function onPay(): Promise<void> {
  paying.value = true;
  try {
    await subApi.completeDemoCheckout();
    await router.replace('/checkout/success');
  } finally {
    paying.value = false;
  }
}

function onCancel(): void {
  void router.push('/checkout/cancel');
}
</script>
<template>
  <section class="demo-checkout">
    <div class="demo-checkout__card">
      <p class="demo-checkout__brand">Stripe</p>
      <h1 class="demo-checkout__title">{{ i18n.t('checkout.demoTitle') }}</h1>
      <div v-if="plan" class="demo-checkout__line">
        <span>{{ i18n.t('checkout.demoPlan') }}</span>
        <strong>{{ plan.name }} · ${{ plan.priceUsd }}</strong>
      </div>
      <label class="demo-checkout__field">
        <span>{{ i18n.t('checkout.demoCard') }}</span>
        <input value="4242 4242 4242 4242" readonly aria-readonly="true" />
      </label>
      <p class="demo-checkout__hint">{{ i18n.t('checkout.demoHint') }}</p>
      <button type="button" class="demo-checkout__pay" :disabled="paying || !plan" @click="onPay">
        {{ i18n.t('checkout.demoPay') }}
      </button>
      <button type="button" class="demo-checkout__cancel" @click="onCancel">
        {{ i18n.t('checkout.demoCancel') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.demo-checkout {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  background: var(--ks-bg-base);
}
.demo-checkout__card {
  max-width: 420px;
  width: 100%;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.demo-checkout__brand {
  margin: 0;
  font-family: Sora, sans-serif;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--ks-accent);
}
.demo-checkout__title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
}
.demo-checkout__line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--ks-bg-muted);
  font-size: 14px;
}
.demo-checkout__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.demo-checkout__field input {
  height: 42px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
}
.demo-checkout__hint {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.demo-checkout__pay {
  height: 46px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.demo-checkout__pay:disabled {
  opacity: 0.6;
  cursor: default;
}
.demo-checkout__cancel {
  height: 40px;
  border: none;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.demo-checkout__cancel:hover {
  color: var(--ks-text-primary);
}
</style>