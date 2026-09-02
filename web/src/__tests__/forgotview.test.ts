import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';

async function mountForgot() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forgot-password', component: ForgotPasswordView },
      { path: '/login', component: { template: '<div />' } }
    ]
  });
  await router.push('/forgot-password');
  await router.isReady();
  return mount(ForgotPasswordView, { global: { plugins: [createPinia(), router] } });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('ForgotPasswordView', () => {
  it('confirms after submitting a valid email', async () => {
    const wrapper = await mountForgot();
    await wrapper.find('#forgot-email').setValue('user@x.io');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Reset link sent to your inbox');
    expect(wrapper.text()).toContain('Back to sign in');
  });

  it('rejects an invalid email', async () => {
    const wrapper = await mountForgot();
    await wrapper.find('#forgot-email').setValue('nope');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Enter a valid email address');
  });
});