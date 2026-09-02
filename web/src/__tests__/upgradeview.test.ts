import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import { demoChangePlan } from '../api/demo';
import UpgradeView from '../views/dashboard/subscription/upgrade.vue';
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
      { path: '/dashboard/subscription', component: { template: '<div />' } },
      { path: '/dashboard/subscription/upgrade', component: UpgradeView },
      { path: '/checkout/demo', component: { template: '<div />' } }
    ]
  });
  await router.push('/dashboard/subscription/upgrade');
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(UpgradeView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
describe('Plan upgrade page', () => {
  it('preselects the first paid upgrade for free users', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.find('.plan-card--selected .plan-card__name').text()).toBe('Basic');
    expect(wrapper.find('.upgrade-page__cta').text()).toBe('Subscribe now');
  });

  it('redirects to the demo checkout when upgrading', async () => {
    const { wrapper, router } = await mountView();

    await wrapper.findAll('.plan-card').at(2)!.trigger('click');
    await wrapper.find('.upgrade-page__cta').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/checkout/demo');
  });

  it('downgrades after confirmation', async () => {
    demoChangePlan('pro');
    const { wrapper } = await mountView();

    await wrapper.findAll('.plan-card').at(1)!.trigger('click');
    await wrapper.find('.upgrade-page__cta').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useSubscriptionStore().currentPlanId).toBe('basic');
  });

  it('disables the CTA when the current plan is selected', async () => {
    const { wrapper } = await mountView();

    await wrapper.findAll('.plan-card').at(0)!.trigger('click');
    await wrapper.vm.$nextTick();

    const cta = wrapper.find('.upgrade-page__cta');
    expect(cta.text()).toBe('Current plan');
    expect((cta.element as HTMLButtonElement).disabled).toBe(true);
  });
});