import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import type { Component } from 'vue';
import { readDemoSubscription } from '../api/demo';
import { createSubscription } from '../api/subscription';
import CheckoutCancelView from '../views/checkout/cancel.vue';
import CheckoutDemoView from '../views/checkout/demo.vue';
import CheckoutSuccessView from '../views/checkout/success.vue';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

async function mountAt(path: string, component: Component) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/checkout/success', component: CheckoutSuccessView },
      { path: '/checkout/cancel', component: CheckoutCancelView },
      { path: '/checkout/demo', component: CheckoutDemoView },
      { path: '/dashboard/subscription', component: { template: '<div />' } },
      { path: '/dashboard/subscription/upgrade', component: { template: '<div />' } }
    ]
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper, router };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => vi.unstubAllGlobals());
describe('Checkout result pages', () => {
  it('shows the subscription summary on success', async () => {
    const { wrapper } = await mountAt('/checkout/success', CheckoutSuccessView);

    expect(wrapper.text()).toContain('Payment successful');
    expect(wrapper.find('.checkout-result__summary').text()).toContain('Free');
    expect(wrapper.find('.checkout-result__cta').attributes('href')).toBe('/dashboard/subscription');
  });

  it('offers a way back to plan selection on cancel', async () => {
    const { wrapper } = await mountAt('/checkout/cancel', CheckoutCancelView);

    expect(wrapper.text()).toContain('Payment canceled');
    expect(wrapper.find('.checkout-result__cta').attributes('href')).toBe('/dashboard/subscription/upgrade');
  });

  it('completes the demo payment for the pending plan', async () => {
    await createSubscription('pro');
    const { wrapper, router } = await mountAt('/checkout/demo', CheckoutDemoView);

    expect(wrapper.text()).toContain('Pro');
    await wrapper.find('.demo-checkout__pay').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/checkout/success');
    expect(readDemoSubscription().planId).toBe('pro');
  });

  it('cancels the demo payment without changing the plan', async () => {
    await createSubscription('pro');
    const { wrapper, router } = await mountAt('/checkout/demo', CheckoutDemoView);

    await wrapper.find('.demo-checkout__cancel').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/checkout/cancel');
    expect(readDemoSubscription().planId).toBe('free');
  });
});