import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import { DEMO_CREDENTIALS } from '../api/auth';
import LandingHeader from '../components/landing/LandingHeader.vue';
import { useAuthStore } from '../stores/auth';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

async function mountHeader(authenticated: boolean) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } },
      { path: '/pricing', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/register', component: { template: '<div />' } }
    ]
  });
  await router.push('/');
  await router.isReady();
  if (authenticated) {
    await useAuthStore().login(DEMO_CREDENTIALS);
  }
  return mount(LandingHeader, { global: { plugins: [pinia, router, Vant] } });
}
describe('LandingHeader', () => {
  it('offers sign in and registration for anonymous visitors', async () => {
    const wrapper = await mountHeader(false);

    expect(wrapper.find('.lheader__signin').attributes('href')).toBe('/login');
    expect(wrapper.find('.lheader__cta').attributes('href')).toBe('/register');
    expect(wrapper.find('.lheader__dashboard').exists()).toBe(false);
    expect(wrapper.find('.lheader__link[href="/pricing"]').exists()).toBe(true);
  });

  it('offers the dashboard entry for signed-in visitors', async () => {
    const wrapper = await mountHeader(true);

    expect(wrapper.find('.lheader__dashboard').attributes('href')).toBe('/home');
    expect(wrapper.find('.lheader__dashboard').text()).toContain('Dashboard');
    expect(wrapper.find('.lheader__signin').exists()).toBe(false);
    expect(wrapper.find('.lheader__cta').exists()).toBe(false);
  });
});