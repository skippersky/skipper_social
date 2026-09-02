import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubscriptionStore } from '../stores/subscription';
import { useUsageStore } from '../stores/usage';

async function bootstrap() {
  const sub = useSubscriptionStore();
  const usage = useUsageStore();
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  await usage.fetchUsage();
  return { sub, usage };
}

describe('usage store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('computes percentages against the active plan quotas', async () => {
    const { usage } = await bootstrap();

    expect(usage.aiUsagePercent).toBe(83);
    expect(usage.messageUsagePercent).toBe(66);
    expect(usage.distributeUsagePercent).toBe(0);
  });

  it('flags near-limit usage at 80% and above', async () => {
    const { usage } = await bootstrap();

    expect(usage.isNearLimit).toBe(true);
    expect(usage.isOverLimit).toBe(false);
  });

  it('reports over-limit usage when a quota is exhausted', async () => {
    const { usage } = await bootstrap();
    usage.usage = { ...usage.usage!, aiGenerations: 30 };

    expect(usage.aiUsagePercent).toBe(100);
    expect(usage.isOverLimit).toBe(true);
  });

  it('loads the usage history', async () => {
    const { usage } = await bootstrap();

    await usage.fetchUsageHistory('14d');

    expect(usage.history).toHaveLength(14);
  });
});