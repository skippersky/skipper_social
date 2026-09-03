import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DEMO_CREDENTIALS } from '../api/auth';
import { router } from '../router';
import { useAuthStore } from '../stores/auth';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('route guard', () => {
  it('redirects anonymous visitors from protected routes to login', async () => {
    await router.push('/settings/profile');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/settings/profile');
  });

  it('keeps public pages reachable for anonymous visitors', async () => {
    await router.push('/register');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/register');
  });

  it('protects the subscription dashboard for anonymous visitors', async () => {
    await router.push('/dashboard/subscription');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard/subscription');
  });

  it('protects the channel dashboard for anonymous visitors', async () => {
    await router.push('/dashboard/channels');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('keeps oauth callback routes public', async () => {
    await router.push('/auth/callback/whatsapp');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/auth/callback/whatsapp');
  });

  it('keeps checkout result pages public', async () => {
    await router.push('/checkout/success');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/checkout/success');
  });

  it('keeps landing pages public for anonymous visitors', async () => {
    await router.push('/pricing');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/pricing');
  });

  it('sends signed-in visitors away from the login page', async () => {
    await useAuthStore().login(DEMO_CREDENTIALS);

    await router.push('/login');

    expect(router.currentRoute.value.path).toBe('/chat');
  });
});