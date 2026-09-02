import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubscriptionStore } from '../stores/subscription';

describe('subscription store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads plans and the current subscription from the demo directory', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const store = useSubscriptionStore();

    await Promise.all([store.fetchPlans(), store.fetchMySubscription()]);

    expect(store.plans).toHaveLength(3);
    expect(store.isFreePlan).toBe(true);
    expect(store.isPaidPlan).toBe(false);
    expect(store.currentPlanName).toBe('Free');
    expect(store.subscriptionStatus).toBe('active');
    expect(store.compareTiers('pro')).toBe(2);
    expect(store.compareTiers('free')).toBe(0);
  });

  it('returns the demo checkout url when subscribing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const store = useSubscriptionStore();
    await store.fetchMySubscription();

    await expect(store.subscribe('pro')).resolves.toBe('/checkout/demo');
    expect(store.error).toBeNull();
  });

  it('changes, cancels and resumes the subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const store = useSubscriptionStore();

    expect(await store.changePlan('basic')).toBe(false);

    await store.fetchMySubscription();
    expect(await store.changePlan('basic')).toBe(true);
    expect(store.isPaidPlan).toBe(true);

    expect(await store.cancel()).toBe(true);
    expect(store.subscriptionStatus).toBe('canceled');

    expect(await store.resume()).toBe(true);
    expect(store.subscriptionStatus).toBe('active');
  });

  it('maps hard server errors to an i18n key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ success: false, message: 'boom', data: null })
    }));
    const store = useSubscriptionStore();

    await store.fetchPlans();

    expect(store.error).toBe('api.500');
    expect(store.plans).toHaveLength(0);
  });
});