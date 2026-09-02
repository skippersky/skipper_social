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

  it('lists six FAQs in the collapse', async () => {
    const wrapper = await mountLanding();

    expect(wrapper.find('#faq').exists()).toBe(true);
    expect(wrapper.findAll('.van-collapse-item')).toHaveLength(6);
  });
});