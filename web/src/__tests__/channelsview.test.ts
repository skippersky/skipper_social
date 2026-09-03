import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import { channelBus } from '../events/channel';
import { useChannelStore } from '../stores/channel';
import ChannelsView from '../views/dashboard/channels/index.vue';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

async function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard/channels', component: ChannelsView },
      { path: '/dashboard/channels/connect/:platform', component: { template: '<div />' } },
      { path: '/dashboard/subscription/upgrade', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } }
    ]
  });
  await router.push('/dashboard/channels');
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(ChannelsView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => {
  localStorage.clear();
  channelBus.clear();
});
afterEach(() => {
  channelBus.clear();
  vi.unstubAllGlobals();
});
describe('Channels management page', () => {
  it('lists all four platforms with the free-tier quota', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.findAll('.channel-card')).toHaveLength(4);
    expect(wrapper.text()).toContain('0 of 1 channels connected');
    expect(wrapper.findAll('.channel-status--disconnected')).toHaveLength(4);
  });

  it('navigates to the connect flow for a platform', async () => {
    const { wrapper, router } = await mountView();

    await wrapper.find('.channel-card--whatsapp .channel-card__btn--primary').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/dashboard/channels/connect/whatsapp');
  });

  it('shows the limit warning and disables new connections when full', async () => {
    const { wrapper } = await mountView();
    const store = useChannelStore();
    await store.completeConnect('whatsapp', { code: 'demo' });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.limit-warning').exists()).toBe(true);
    expect(wrapper.text()).toContain('1 of 1 channels connected');
    const connectNew = wrapper.findAll('button').find((b) => b.text().includes('Connect new channel'));
    expect((connectNew!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('disconnects a channel from its card', async () => {
    const { wrapper } = await mountView();
    const store = useChannelStore();
    await store.completeConnect('whatsapp', { code: 'demo' });
    await wrapper.vm.$nextTick();

    await wrapper.find('.channel-card--whatsapp .channel-card__btn--danger').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(store.channels).toHaveLength(0);
  });
});