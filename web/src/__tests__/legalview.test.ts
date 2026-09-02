import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import type { Component } from 'vue';
import LandingPrivacy from '../views/landing/privacy.vue';
import LandingTerms from '../views/landing/terms.vue';

async function mountLegal(component: Component, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component }]
  });
  await router.push(path);
  await router.isReady();
  return mount(component, { global: { plugins: [createPinia(), router, Vant] } });
}

describe('Legal pages', () => {
  it('renders the privacy policy placeholder', async () => {
    const wrapper = await mountLegal(LandingPrivacy, '/privacy');

    expect(wrapper.find('.legal__title').text()).toBe('Privacy Policy');
    expect(wrapper.find('.legal__placeholder').text()).toContain('placeholder text');
    expect(wrapper.findAll('.legal__section')).toHaveLength(4);
    expect(wrapper.text()).toContain('Data we collect');
  });

  it('renders the terms of service placeholder', async () => {
    const wrapper = await mountLegal(LandingTerms, '/terms');

    expect(wrapper.find('.legal__title').text()).toBe('Terms of Service');
    expect(wrapper.find('.legal__placeholder').text()).toContain('placeholder text');
    expect(wrapper.findAll('.legal__section')).toHaveLength(4);
    expect(wrapper.text()).toContain('Acceptance of terms');
  });
});