import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEMO_CREDENTIALS } from '../api/auth';
import UserMenu from '../components/UserMenu.vue';
import { useAuthStore } from '../stores/auth';

async function mountMenu(authenticated: boolean) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div />' } },
      { path: '/settings/profile', component: { template: '<div />' } },
      { path: '/settings/security', component: { template: '<div />' } }
    ]
  });
  await router.push('/login');
  await router.isReady();
  if (authenticated) {
    await useAuthStore(pinia).login(DEMO_CREDENTIALS);
  }
  const wrapper = mount(UserMenu, { global: { plugins: [pinia, router] } });
  return { wrapper, router, auth: useAuthStore(pinia) };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('UserMenu', () => {
  it('shows a sign-in link for anonymous visitors', async () => {
    const { wrapper } = await mountMenu(false);

    expect(wrapper.find('.user-menu__signin').exists()).toBe(true);
  });

  it('opens the menu and navigates to the profile page', async () => {
    const { wrapper, router } = await mountMenu(true);

    await wrapper.find('.user-menu__trigger').trigger('click');
    expect(wrapper.find('.user-menu__panel').exists()).toBe(true);

    await wrapper.findAll('.user-menu__panel button')[0].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/settings/profile');
  });

  it('logs out and returns to the login page', async () => {
    const { wrapper, router, auth } = await mountMenu(true);

    await wrapper.find('.user-menu__trigger').trigger('click');
    await wrapper.find('.user-menu__logout').trigger('click');
    await flushPromises();

    expect(auth.isAuthenticated).toBe(false);
    expect(router.currentRoute.value.path).toBe('/login');
  });
});