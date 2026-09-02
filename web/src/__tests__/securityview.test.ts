import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEMO_CREDENTIALS, login as apiLogin } from '../api/auth';
import SettingsSecurityView from '../views/SettingsSecurityView.vue';
vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

async function mountSecurity() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings/security', component: SettingsSecurityView },
      { path: '/settings/profile', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } }
    ]
  });
  await router.push('/settings/security');
  await router.isReady();
  await apiLogin(DEMO_CREDENTIALS);
  const wrapper = mount(SettingsSecurityView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('SettingsSecurityView', () => {
  it('rejects a new password equal to the current one', async () => {
    const wrapper = await mountSecurity();
    await wrapper.find('#sec-current').setValue(DEMO_CREDENTIALS.password);
    await wrapper.find('#sec-next').setValue(DEMO_CREDENTIALS.password);
    await wrapper.find('#sec-confirm').setValue(DEMO_CREDENTIALS.password);

    await wrapper.find('.security-card__form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('New password must differ from the current one');
  });

  it('flags a wrong current password', async () => {
    const wrapper = await mountSecurity();
    await wrapper.find('#sec-current').setValue('WrongPass1');
    await wrapper.find('#sec-next').setValue('NewPass123');
    await wrapper.find('#sec-confirm').setValue('NewPass123');

    await wrapper.find('.security-card__form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Current password is incorrect');
  });

  it('changes the password and confirms other devices were cleared', async () => {
    const wrapper = await mountSecurity();
    await wrapper.find('#sec-current').setValue(DEMO_CREDENTIALS.password);
    await wrapper.find('#sec-next').setValue('NewPass123');
    await wrapper.find('#sec-confirm').setValue('NewPass123');

    await wrapper.find('.security-card__form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Password changed');
    expect(wrapper.text()).toContain('Other devices were signed out');
  });
});