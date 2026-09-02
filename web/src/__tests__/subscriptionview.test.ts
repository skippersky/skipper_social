import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant, { showConfirmDialog } from 'vant';
import SubscriptionView from '../views/dashboard/subscription/index.vue';
import { useSubscriptionStore } from '../stores/subscription';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn(), showConfirmDialog: vi.fn().mockResolvedValue('confirm') };
});

async function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard/subscription', component: SubscriptionView },
      { path: '/dashboard/subscription/upgrade', component: { template: '<div />' } },
      { path: '/dashboard/subscription/usage', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } }
    ]
  });
  await router.push('/dashboard/subscription');
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(SubscriptionView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
describe('Subscription management page', () => {
  it('shows the current plan, status and usage bars', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Manage subscription');
    expect(wrapper.find('.status-badge').text()).toBe('Active');
    expect(wrapper.findAll('.usage-bar')).toHaveLength(3);
    expect(wrapper.find('.usage-bar--warn').exists()).toBe(true);
  });

  it('routes to the upgrade page with the selected plan', async () => {
    const { wrapper, router } = await mountView();

    await wrapper.findAll('.plan-card__cta').at(1)!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/dashboard/subscription/upgrade');
    expect(router.currentRoute.value.query.plan).toBe('pro');
  });

  it('cancels the paid subscription after confirmation', async () => {
    const { wrapper } = await mountView();
    const store = useSubscriptionStore();
    await store.changePlan('basic');
    await wrapper.vm.$nextTick();

    await wrapper.find('.btn-danger').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(store.subscriptionStatus).toBe('canceled');
    expect(wrapper.find('.btn-primary').text()).toBe('Resume subscription');
  });

  it('keeps the subscription when the confirmation dialog is dismissed', async () => {
    vi.mocked(showConfirmDialog).mockRejectedValueOnce(new Error('dismissed'));
    const { wrapper } = await mountView();
    const store = useSubscriptionStore();
    await store.changePlan('basic');
    await wrapper.vm.$nextTick();

    await wrapper.find('.btn-danger').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.subscriptionStatus).toBe('active');
  });
});