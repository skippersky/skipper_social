import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import { useChannelStore } from '../stores/channel';
import AuthCallbackView from '../views/auth/callback.vue';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

async function mountAt(path: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/callback/:platform', component: AuthCallbackView },
      { path: '/dashboard/channels', component: { template: '<div />' } }
    ]
  });
  await router.push(path);
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(AuthCallbackView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('OAuth callback page', () => {
  it('finalizes the authorization and returns to the channel list', async () => {
    const { router } = await mountAt('/auth/callback/whatsapp?code=demo-code&state=demo-state');

    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
    const store = useChannelStore();
    expect(store.channels).toHaveLength(1);
    expect(store.channels[0]).toMatchObject({ platform: 'whatsapp', status: 'connected' });
  });

  it('surfaces a retry state when the platform denies access', async () => {
    const { wrapper, router } = await mountAt('/auth/callback/whatsapp?error=access_denied');

    expect(router.currentRoute.value.path).toBe('/auth/callback/whatsapp');
    expect(wrapper.text()).toContain('Authorization failed');
    expect(wrapper.find('.btn-primary').text()).toBe('Retry');
  });
});