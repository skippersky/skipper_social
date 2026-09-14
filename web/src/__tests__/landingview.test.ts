import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import LandingIndex from '../views/landing/index.vue';

async function mountLanding() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: LandingIndex },
      { path: '/register', component: { template: '<div />' } },
      { path: '/pricing', component: { template: '<div />' } }
    ]
  });
  await router.push('/');
  await router.isReady();
  return mount(LandingIndex, { global: { plugins: [createPinia(), router, Vant] } });
}

describe('Landing page', () => {
  it('renders the hero with a registration CTA', async () => {
    const wrapper = await mountLanding();

    expect(wrapper.text()).toContain('Turn every customer message into a sale');
    const cta = wrapper.find('.btn--primary');
    expect(cta.text()).toContain('Start for free');
    expect(cta.attributes('href')).toBe('/register');
  });

  it('shows three feature cards and four steps', async () => {
    const wrapper = await mountLanding();

    expect(wrapper.findAll('.feature')).toHaveLength(3);
    expect(wrapper.findAll('.step')).toHaveLength(4);
    expect(wrapper.find('#features').exists()).toBe(true);
  });

  it('previews the three plans with a link to the pricing page', async () => {
    const wrapper = await mountLanding();

    expect(wrapper.findAll('.plan-mini')).toHaveLength(3);
    expect(wrapper.find('.plans-cta a').attributes('href')).toBe('/pricing');
  });

  it('turns each pricing preview card into a link that carries the chosen plan to the pricing page', async () => {
    const wrapper = await mountLanding();

    const minis = wrapper.findAll('a.plan-mini');
    expect(minis).toHaveLength(3);
    expect(minis.map((m) => m.attributes('href'))).toEqual([
      '/pricing?plan=free',
      '/pricing?plan=basic',
      '/pricing?plan=pro'
    ]);
    expect(minis[1].attributes('aria-label')).toBe('View Basic plan');
  });

  it('navigates to the pricing page with the plan query when a preview card is clicked', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: LandingIndex },
        { path: '/register', component: { template: '<div />' } },
        { path: '/pricing', component: { template: '<div />' } }
      ]
    });
    await router.push('/');
    await router.isReady();
    const wrapper = mount(LandingIndex, {
      global: { plugins: [createPinia(), router, Vant] }
    });

    await wrapper.findAll('a.plan-mini')[2].trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/pricing');
    expect(router.currentRoute.value.query.plan).toBe('pro');
  });

  it('lists six FAQs in the collapse', async () => {
    const wrapper = await mountLanding();

    expect(wrapper.find('#faq').exists()).toBe(true);
    expect(wrapper.findAll('.van-collapse-item')).toHaveLength(6);
  });
});