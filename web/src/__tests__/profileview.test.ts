import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEMO_CREDENTIALS } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import SettingsProfileView from '../views/SettingsProfileView.vue';
vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

async function mountProfile() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings/profile', component: SettingsProfileView },
      { path: '/settings/security', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } }
    ]
  });
  await router.push('/settings/profile');
  await router.isReady();
  const auth = useAuthStore(pinia);
  await auth.login(DEMO_CREDENTIALS);
  const wrapper = mount(SettingsProfileView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, auth, router };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('SettingsProfileView', () => {
  it('shows the signed-in user and settings navigation', async () => {
    const { wrapper } = await mountProfile();

    expect(wrapper.text()).toContain(DEMO_CREDENTIALS.email);
    expect(wrapper.text()).toContain('Demo Merchant');
    expect(wrapper.findAll('.settings__link')).toHaveLength(2);
  });

  it('saves profile edits into the session', async () => {
    const { wrapper, auth } = await mountProfile();
    await wrapper.find('#pf-nickname').setValue('Zuri Updated');
    await wrapper.find('#pf-company').setValue('ACME');

    await wrapper.find('.profile-card__form').trigger('submit');
    await flushPromises();

    expect(auth.user?.nickname).toBe('Zuri Updated');
    expect(auth.user?.company).toBe('ACME');
  });

  it('rejects invalid nicknames', async () => {
    const { wrapper, auth } = await mountProfile();
    await wrapper.find('#pf-nickname').setValue('A');

    await wrapper.find('.profile-card__form').trigger('submit');
    await flushPromises();

    expect(auth.user?.nickname).toBe('Demo Merchant');
  });

  it('logs out back to the login page', async () => {
    const { wrapper, auth, router } = await mountProfile();

    await wrapper.find('.settings__logout').trigger('click');
    await flushPromises();

    expect(auth.isAuthenticated).toBe(false);
    expect(router.currentRoute.value.path).toBe('/login');
  });
});