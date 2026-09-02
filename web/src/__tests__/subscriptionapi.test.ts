import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelSubscription,
  completeDemoCheckout,
  createSubscription,
  getMySubscription,
  resumeSubscription,
  updateSubscription
} from '../api/subscription';

describe('subscription api demo fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('serves a free active subscription by default', async () => {
    const sub = await getMySubscription();

    expect(sub.planId).toBe('free');
    expect(sub.status).toBe('active');
    expect(sub.demo).toBe(true);
  });

  it('creates a demo checkout session pointing at the in-app cashier', async () => {
    const session = await createSubscription('pro');

    expect(session.checkoutUrl).toBe('/checkout/demo');
    expect(session.demo).toBe(true);
    expect(localStorage.getItem('ks-demo-pending-plan')).toBe('pro');
  });

  it('completes the demo checkout and activates the pending plan', async () => {
    await createSubscription('basic');

    const sub = await completeDemoCheckout();

    expect(sub.planId).toBe('basic');
    expect(sub.status).toBe('active');
    expect(localStorage.getItem('ks-demo-pending-plan')).toBeNull();
  });

  it('supports update, cancel and resume round-trips', async () => {
    const updated = await updateSubscription('demo-sub', 'pro');
    expect(updated.planId).toBe('pro');

    const canceled = await cancelSubscription('demo-sub');
    expect(canceled.status).toBe('canceled');
    expect(canceled.cancelAtPeriodEnd).toBe(true);

    const resumed = await resumeSubscription('demo-sub');
    expect(resumed.status).toBe('active');
  });
});