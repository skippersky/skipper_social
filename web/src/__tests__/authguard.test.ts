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