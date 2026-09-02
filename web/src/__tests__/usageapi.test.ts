import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoChangePlan } from '../api/demo';
import { getUsage, getUsageHistory } from '../api/usage';

describe('usage api demo fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('derives usage from the free plan quotas', async () => {
    const usage = await getUsage();

    expect(usage.aiGenerations).toBe(25);
    expect(usage.messages).toBe(132);
    expect(usage.scheduledPosts).toBe(0);
    expect(usage.demo).toBe(true);
  });

  it('tracks the active plan when it changes', async () => {
    demoChangePlan('pro');

    const usage = await getUsage();

    expect(usage.aiGenerations).toBe(4300);
    expect(usage.messages).toBe(33000);
    expect(usage.scheduledPosts).toBe(240);
  });

  it('returns fourteen ascending daily records', async () => {
    const history = await getUsageHistory('14d');

    expect(history).toHaveLength(14);
    expect(history[0].date < history[13].date).toBe(true);
    for (const record of history) {
      expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});