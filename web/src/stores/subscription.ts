import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TIER_ORDER } from '../api/demo';
import { apiErrorI18nKey } from '../api/http';
import * as planApi from '../api/plan';
import * as subApi from '../api/subscription';
import type { Plan, Subscription, SubscriptionTier } from '../types';

export const useSubscriptionStore = defineStore('subscription', () => {
  const plans = ref<Plan[]>([]);
  const currentSubscription = ref<Subscription | null>(null);
  const loading = ref(false);
  /** i18n key of the last failure, surfaced via Vant toast. */
  const error = ref<string | null>(null);

  const currentPlanId = computed<SubscriptionTier>(() => currentSubscription.value?.planId ?? 'free');
  const currentPlan = computed(() => plans.value.find((p) => p.id === currentPlanId.value) ?? null);
  const isFreePlan = computed(() => currentPlanId.value === 'free');
  const isPaidPlan = computed(() => !isFreePlan.value);
  const currentPlanName = computed(() => currentPlan.value?.name ?? 'Free');
  const subscriptionStatus = computed(() => currentSubscription.value?.status ?? 'active');

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  async function fetchPlans(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      plans.value = await planApi.getPlans();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchMySubscription(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      currentSubscription.value = await subApi.getMySubscription();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  /** Returns the checkout URL (Stripe-hosted, or the in-app demo checkout offline). */
  async function subscribe(planId: SubscriptionTier): Promise<string | null> {
    loading.value = true;
    error.value = null;
    try {
      const session = await subApi.createSubscription(planId);
      return session.checkoutUrl;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function changePlan(planId: SubscriptionTier): Promise<boolean> {
    const sub = currentSubscription.value;
    if (!sub) return false;
    loading.value = true;
    error.value = null;
    try {
      currentSubscription.value = await subApi.updateSubscription(sub.id, planId);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function cancel(): Promise<boolean> {
    const sub = currentSubscription.value;
    if (!sub) return false;
    loading.value = true;
    error.value = null;
    try {
      currentSubscription.value = await subApi.cancelSubscription(sub.id);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function resume(): Promise<boolean> {
    const sub = currentSubscription.value;
    if (!sub) return false;
    loading.value = true;
    error.value = null;
    try {
      currentSubscription.value = await subApi.resumeSubscription(sub.id);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** Positive when the candidate is an upgrade, negative for a downgrade. */
  function compareTiers(candidate: SubscriptionTier): number {
    return TIER_ORDER[candidate] - TIER_ORDER[currentPlanId.value];
  }

  return {
    plans,
    currentSubscription,
    loading,
    error,
    currentPlanId,
    currentPlan,
    isFreePlan,
    isPaidPlan,
    currentPlanName,
    subscriptionStatus,
    fetchPlans,
    fetchMySubscription,
    subscribe,
    changePlan,
    cancel,
    resume,
    compareTiers
  };
});