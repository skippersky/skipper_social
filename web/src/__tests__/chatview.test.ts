import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import { createMemoryHistory, createRouter } from 'vue-router';
import ChatView from '../views/ChatView.vue';

async function mountChat() {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  // Keep the socket layer deterministic: no real WebSocket in jsdom tests.
  vi.stubGlobal('WebSocket', undefined);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chat', component: ChatView }
    ]
  });
  await router.push('/chat');
  await router.isReady();
  const wrapper = mount(ChatView, { global: { plugins: [createPinia(), router, Vant] } });
  await flushPromises();
  return wrapper;
}

describe('ChatView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('degrades to sample data when the API is unreachable', async () => {
    const wrapper = await mountChat();

    expect(wrapper.findAll('.conv-item').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.text()).toContain('Sample data shown below');
    expect(wrapper.find('.chat-page__demo-close').exists()).toBe(true);
    expect(wrapper.text()).toContain('Select a conversation to start chatting');
    expect(wrapper.text()).toContain('Offline');
  });

  it('selecting a conversation loads its messages', async () => {
    const wrapper = await mountChat();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('.chat-window__header').exists()).toBe(true);
    expect(wrapper.text()).toContain('Amani Juma');
    expect(wrapper.findAll('.msg').length).toBeGreaterThan(0);
  });

  it('sorts the list newest first', async () => {
    const wrapper = await mountChat();
    const names = wrapper.findAll('.conv-item__name').map((n) => n.text());

    expect(names[0]).toBe('Amani Juma');
  });

  it('hides sample data behind the empty state once dismissed', async () => {
    const wrapper = await mountChat();
    await wrapper.find('.chat-page__demo-close').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.conv-item')).toHaveLength(0);
    expect(wrapper.text()).toContain('No conversation data yet');
    expect(wrapper.text()).toContain('Connect a channel');
    expect(localStorage.getItem('ks-chat-demo-hidden')).toBe('1');
  });
});