import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import ChannelConnectView from '../views/dashboard/channels/connect.vue';

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
      { path: '/dashboard/channels', component: { template: '<div />' } },
      { path: '/dashboard/channels/connect/:platform', component: ChannelConnectView },
      { path: '/auth/callback/:platform', component: { template: '<div />' } }
    ]
  });
  await router.push(path);
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(ChannelConnectView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Channel connect page', () => {
  it('redirects to the demo oauth callback for a valid platform', async () => {
    const { router } = await mountAt('/dashboard/channels/connect/whatsapp');

    expect(router.currentRoute.value.path).toBe('/auth/callback/whatsapp');
    expect(router.currentRoute.value.query.code).toBe('demo-code');
  });

  it('sends unknown platforms back to the channel list', async () => {
    const { router } = await mountAt('/dashboard/channels/connect/myspace');

    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
  });
});