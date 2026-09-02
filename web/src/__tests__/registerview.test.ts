import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import RegisterView from '../views/RegisterView.vue';

async function mountRegister() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', component: RegisterView },
      { path: '/chat', component: { template: '<div />' } }
    ]
  });
  await router.push('/register');
  await router.isReady();
  const wrapper = mount(RegisterView, { global: { plugins: [createPinia(), router] } });
  return { wrapper, router };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('RegisterView', () => {
  it('validates password strength and confirmation', async () => {
    const { wrapper } = await mountRegister();
    await wrapper.find('#reg-email').setValue('user@x.io');
    await wrapper.find('#reg-nickname').setValue('Neema');
    await wrapper.find('#reg-password').setValue('weakpass');
    await wrapper.find('#reg-confirm').setValue('different');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('At least 8 characters');
    expect(wrapper.text()).toContain('Passwords do not match');
  });

  it('validates the nickname length', async () => {
    const { wrapper } = await mountRegister();
    await wrapper.find('#reg-email').setValue('user@x.io');
    await wrapper.find('#reg-nickname').setValue('A');
    await wrapper.find('#reg-password').setValue('Passw0rd');
    await wrapper.find('#reg-confirm').setValue('Passw0rd');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Nickname must be 2-20 characters');
  });

  it('registers, signs in and navigates to chat', async () => {
    const { wrapper, router } = await mountRegister();
    await wrapper.find('#reg-email').setValue('new@x.io');
    await wrapper.find('#reg-nickname').setValue('Neema');
    await wrapper.find('#reg-password').setValue('Passw0rd');
    await wrapper.find('#reg-confirm').setValue('Passw0rd');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/chat');
  });

  it('reports duplicate emails', async () => {
    const { wrapper } = await mountRegister();
    for (let i = 0; i < 2; i += 1) {
      await wrapper.find('#reg-email').setValue('dup@x.io');
      await wrapper.find('#reg-nickname').setValue('Neema');
      await wrapper.find('#reg-password').setValue('Passw0rd');
      await wrapper.find('#reg-confirm').setValue('Passw0rd');
      await wrapper.find('form').trigger('submit');
      await flushPromises();
    }

    expect(wrapper.text()).toContain('This email is already registered');
  });
});