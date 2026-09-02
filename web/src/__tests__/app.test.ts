import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import App from '../App.vue';

const stub = { template: '<div />' };

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/editor', component: stub },
      { path: '/drafts', component: stub },
      { path: '/chat', component: stub },
      { path: '/login', component: stub },
      { path: '/settings/profile', component: stub },
      { path: '/settings/security', component: stub }
    ]
  });
  await router.push(path);
  await router.isReady();
  return mount(App, { global: { plugins: [createPinia(), router, Vant] } });
}

describe('App', () => {
  it('shows the global header with brand and language switcher on workspace pages', async () => {
    const wrapper = await mountAt('/home');

    expect(wrapper.text()).toContain('KiliSocial');
    expect(wrapper.findAll('.lang-switch__option').length).toBe(3);
  });

  it('hides the global header on landing pages', async () => {
    const wrapper = await mountAt('/');

    expect(wrapper.find('.app-header').exists()).toBe(false);
  });

  it('shows the tabbar on editor and drafts', async () => {
    for (const path of ['/editor', '/drafts']) {
      const wrapper = await mountAt(path);
      expect(wrapper.text()).toContain('Drafts');
    }
  });

  it('hides the tabbar on home and chat', async () => {
    for (const path of ['/home', '/chat']) {
      const wrapper = await mountAt(path);
      expect(wrapper.find('.van-tabbar').exists()).toBe(false);
    }
  });
});