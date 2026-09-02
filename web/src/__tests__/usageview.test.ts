import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import UsageView from '../views/dashboard/subscription/usage.vue';

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
      { path: '/dashboard/subscription', component: { template: '<div />' } },
      { path: '/dashboard/subscription/usage', component: UsageView }
    ]
  });
  await router.push('/dashboard/subscription/usage');
  await router.isReady();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const wrapper = mount(UsageView, { global: { plugins: [pinia, router, Vant] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Usage detail page', () => {
  it('shows the quota bars with demo values', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.findAll('.usage-bar')).toHaveLength(3);
    expect(wrapper.text()).toContain('25 / 30');
    expect(wrapper.text()).toContain('132 / 200');
  });

  it('renders a trend chart and fourteen history rows', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.findAll('.trend__bar')).toHaveLength(14);
    expect(wrapper.findAll('.history__row')).toHaveLength(14);
  });

  it('persists the usage alert preference', async () => {
    const { wrapper } = await mountView();

    await wrapper.find('.van-switch').trigger('click');
    await wrapper.vm.$nextTick();

    expect(localStorage.getItem('ks-usage-alerts')).toBe('1');
  });
});