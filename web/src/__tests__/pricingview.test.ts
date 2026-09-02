import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import { DEMO_CREDENTIALS } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import LandingPricing from '../views/landing/pricing.vue';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

async function mountPricing() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pricing', component: LandingPricing },
      { path: '/register', component: { template: '<div />' } },
      { path: '/dashboard/subscription/upgrade', component: { template: '<div />' } }
    ]
  });
  await router.push('/pricing');
  await router.isReady();
  const wrapper = mount(LandingPricing, { global: { plugins: [pinia, router, Vant] } });
  return { wrapper, router };
}
describe('Pricing page', () => {
  it('lists the three plans with monthly prices', async () => {
    const { wrapper } = await mountPricing();

    expect(wrapper.findAll('.plan')).toHaveLength(3);
    expect(wrapper.text()).toContain('$0');
    expect(wrapper.text()).toContain('$9');
    expect(wrapper.text()).toContain('$29');
    expect(wrapper.text()).toContain('AI copy generations / month');
  });

  it('points anonymous visitors to registration', async () => {
    const { wrapper } = await mountPricing();

    const ctas = wrapper.findAll('a.plan__cta');
    expect(ctas).toHaveLength(3);
    for (const cta of ctas) {
      expect(cta.attributes('href')).toBe('/register');
    }
  });

  it('marks the current plan and routes signed-in visitors to the upgrade flow', async () => {
    await useAuthStore().login(DEMO_CREDENTIALS);
    const { wrapper, router } = await mountPricing();

    expect(wrapper.find('.plan--current').exists()).toBe(true);
    expect(wrapper.find('.plan__badge').text()).toBe('Current plan');

    const buttons = wrapper.findAll('button.plan__cta');
    const upgrade = buttons.find((b) => b.text().includes('Upgrade'));
    expect(upgrade).toBeDefined();
    await upgrade!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/dashboard/subscription/upgrade');
    const current = buttons.find((b) => b.text().includes('Current plan'));
    expect((current!.element as HTMLButtonElement).disabled).toBe(true);
  });
});