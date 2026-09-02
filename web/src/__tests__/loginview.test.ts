import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { DEMO_CREDENTIALS } from '../api/auth';
import LoginView from '../views/LoginView.vue';

async function mountLogin(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/chat', component: { template: '<div />' } },
      { path: '/target', component: { template: '<div />' } }
    ]
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(LoginView, { global: { plugins: [createPinia(), router] } });
  return { wrapper, router };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('LoginView', () => {
  it('rejects an invalid email before calling any API', async () => {
    const { wrapper } = await mountLogin();
    await wrapper.find('#login-email').setValue('not-an-email');
    await wrapper.find('#login-password').setValue('x');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Enter a valid email address');
  });

  it('signs in with the demo account and navigates to chat', async () => {
    const { wrapper, router } = await mountLogin();
    await wrapper.find('#login-email').setValue(DEMO_CREDENTIALS.email);
    await wrapper.find('#login-password').setValue(DEMO_CREDENTIALS.password);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/chat');
  });

  it('honours the redirect query parameter', async () => {
    const { wrapper, router } = await mountLogin('/login?redirect=/target');
    await wrapper.find('#login-email').setValue(DEMO_CREDENTIALS.email);
    await wrapper.find('#login-password').setValue(DEMO_CREDENTIALS.password);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/target');
  });

  it('shows the bad-credentials message and demo notice on failure', async () => {
    const { wrapper } = await mountLogin();
    await wrapper.find('#login-email').setValue(DEMO_CREDENTIALS.email);
    await wrapper.find('#login-password').setValue('wrong-password');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Incorrect email or password');
    expect(wrapper.text()).toContain('Demo mode');
  });

  it('renders the google sign-in button', async () => {
    const { wrapper } = await mountLogin();

    expect(wrapper.find('.auth-google').text()).toContain('Continue with Google');
  });
});