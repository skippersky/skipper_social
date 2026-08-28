import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
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
  return mount(HomeView, { global: { plugins: [router, Vant] } });
}

describe('HomeView', () => {
  it('renders brand headline and entry points', async () => {
    const wrapper = await mountHome();

    expect(wrapper.text()).toContain('把每条客户消息');
    expect(wrapper.text()).toContain('进入会话');
    expect(wrapper.text()).toContain('AI 文案工作台');
    expect(wrapper.text()).toContain('草稿箱');
    expect(wrapper.text()).toContain('审核中');
  });

  it('links to chat, editor and drafts routes', async () => {
    const wrapper = await mountHome();
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'));

    expect(hrefs).toContain('/chat');
    expect(hrefs).toContain('/editor');
    expect(hrefs).toContain('/drafts');
  });
});