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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mountPricing(query = '') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pricing', component: LandingPricing },
      { path: '/register', component: { template: '<div />' } },
      { path: '/dashboard/subscription/upgrade', component: { template: '<div />' } }
    ]
  });
  await router.push('/pricing' + query);
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

  it('points anonymous visitors to registration and carries the chosen plan', async () => {
    const { wrapper } = await mountPricing();

    const ctas = wrapper.findAll('a.plan__cta');
    expect(ctas).toHaveLength(3);
    expect(ctas.map((c) => c.attributes('href'))).toEqual([
      '/register?plan=free',
      '/register?plan=basic',
      '/register?plan=pro'
    ]);
  });

  it('makes the whole anonymous plan card clickable and keyboard reachable', async () => {
    const { wrapper, router } = await mountPricing();

    const card = wrapper.findAll('.plan')[2];
    expect(card.classes()).toContain('plan--interactive');
    expect(card.attributes('role')).toBe('button');
    expect(card.attributes('tabindex')).toBe('0');

    await card.trigger('keydown', { key: 'Enter' });
    await tick();

    expect(router.currentRoute.value.path).toBe('/register');
    expect(router.currentRoute.value.query.plan).toBe('pro');
  });

  it('marks the current plan and routes signed-in visitors to the upgrade flow with the plan preselected', async () => {
    await useAuthStore().login(DEMO_CREDENTIALS);
    const { wrapper, router } = await mountPricing();

    expect(wrapper.find('.plan--current').exists()).toBe(true);
    expect(wrapper.find('.plan__badge').text()).toBe('Current plan');

    const cards = wrapper.findAll('.plan');
    const currentCard = cards.find((c) => c.classes().includes('plan--current'));
    const target = cards.find((c) => !c.classes().includes('plan--current'));
    expect(currentCard).toBeDefined();
    expect(target).toBeDefined();

    await target!.trigger('click');
    await tick();

    expect(router.currentRoute.value.path).toBe('/dashboard/subscription/upgrade');
    expect(router.currentRoute.value.query.plan).toBe(target!.attributes('data-plan'));

    const buttons = wrapper.findAll('button.plan__cta');
    const current = buttons.find((b) => b.text().includes('Current plan'));
    expect((current!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the current plan card inert for signed-in visitors', async () => {
    await useAuthStore().login(DEMO_CREDENTIALS);
    const { wrapper, router } = await mountPricing();

    const currentCard = wrapper.findAll('.plan').find((c) => c.classes().includes('plan--current'));
    expect(currentCard!.classes()).not.toContain('plan--interactive');
    expect(currentCard!.attributes('role')).toBeUndefined();
    expect(currentCard!.attributes('aria-disabled')).toBe('true');

    await currentCard!.trigger('click');
    await tick();

    expect(router.currentRoute.value.path).toBe('/pricing');
  });

  it('highlights the plan requested through the query string', async () => {
    const { wrapper } = await mountPricing('?plan=pro');

    const highlighted = wrapper.find('.plan--highlight');
    expect(highlighted.exists()).toBe(true);
    expect(highlighted.attributes('data-plan')).toBe('pro');
  });

  it('ignores an unknown plan query value', async () => {
    const { wrapper } = await mountPricing('?plan=enterprise');

    expect(wrapper.find('.plan--highlight').exists()).toBe(false);
  });

  it('activates the plan card with the space key', async () => {
    const { wrapper, router } = await mountPricing();

    await wrapper.findAll('.plan')[1].trigger('keydown', { key: ' ' });
    await tick();

    expect(router.currentRoute.value.path).toBe('/register');
    expect(router.currentRoute.value.query.plan).toBe('basic');
  });

  it('ignores non-activation keys on the plan card', async () => {
    const { wrapper, router } = await mountPricing();

    await wrapper.findAll('.plan')[0].trigger('keydown', { key: 'a' });
    await tick();

    expect(router.currentRoute.value.path).toBe('/pricing');
  });
});
