import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import HomeView from '../views/HomeView.vue';

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/chat', component: { template: '<div />' } },
      { path: '/editor', component: { template: '<div />' } },
      { path: '/drafts', component: { template: '<div />' } }
    ]
  });
  await router.push('/');
  await router.isReady();
  return mount(HomeView, { global: { plugins: [createPinia(), router, Vant] } });
}

describe('HomeView', () => {
  it('renders brand headline and entry points (en default)', async () => {
    const wrapper = await mountHome();

    expect(wrapper.text()).toContain('Turn every customer message into a sale');
    expect(wrapper.text()).toContain('Open conversations');
    expect(wrapper.text()).toContain('AI Copywriting');
    expect(wrapper.text()).toContain('Drafts');
    expect(wrapper.text()).toContain('under review');
  });

  it('links to chat, editor and drafts routes', async () => {
    const wrapper = await mountHome();
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'));

    expect(hrefs).toContain('/chat');
    expect(hrefs).toContain('/editor');
    expect(hrefs).toContain('/drafts');
  });
});