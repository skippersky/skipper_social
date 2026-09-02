import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlanById, getPlans } from '../api/plan';

function okEnvelope(data: unknown) {
  return { success: true, code: 'OK', message: 'ok', data };
}

describe('plan api', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('parses plans from the backend envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => okEnvelope([
        {
          id: 'basic',
          name: 'Basic',
          priceUsd: 9,
          quotas: { aiGenerations: 500, messages: 5000, channels: 3, scheduledPosts: 60 }
        }
      ])
    }));

    const plans = await getPlans();

    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('basic');
  });

  it('falls back to the demo catalogue when the backend is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const plans = await getPlans();

    expect(plans.map((p) => p.id)).toEqual(['free', 'basic', 'pro']);
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
  });

  it('resolves a demo plan by id and rejects unknown ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(getPlanById('pro')).resolves.toMatchObject({ id: 'pro' });
    await expect(getPlanById('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});