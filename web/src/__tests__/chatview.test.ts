import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import ChatView from '../views/ChatView.vue';

async function mountChat() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chat', component: ChatView }
    ]
  });
  await router.push('/chat');
  await router.isReady();
  const wrapper = mount(ChatView, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  return wrapper;
}

describe('ChatView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads mock conversations and shows the empty chat state', async () => {
    const wrapper = await mountChat();

    expect(wrapper.findAll('.conv-item').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.text()).toContain('Select a conversation to start chatting');
  });

  it('selecting a conversation opens the chat window', async () => {
    const wrapper = await mountChat();
    await wrapper.findAll('.conv-item')[0].trigger('click');

    expect(wrapper.find('.chat-window__header').exists()).toBe(true);
    expect(wrapper.text()).toContain('Amani Juma');
  });

  it('sorts the list newest first', async () => {
    const wrapper = await mountChat();
    const names = wrapper.findAll('.conv-item__name').map((n) => n.text());

    expect(names[0]).toBe('Amani Juma');
  });
});