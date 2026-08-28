import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import App from '../App.vue';

describe('App', () => {
  it('renders the tabbar', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    });
    const wrapper = mount(App, { global: { plugins: [createPinia(), router, Vant] } });

    expect(wrapper.text()).toContain('草稿箱');
  });
});
