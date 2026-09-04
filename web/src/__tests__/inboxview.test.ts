import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import { createMemoryHistory, createRouter } from 'vue-router';
import { resetWebSocketForTests } from '../composables/useWebSocket';
import { socketBus } from '../events/socket';
import InboxView from '../views/dashboard/conversations/index.vue';

async function mountInbox() {
  localStorage.clear();
  socketBus.clear();
  resetWebSocketForTests();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal('WebSocket', undefined);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } },
      { path: '/dashboard/channels', component: { template: '<div />' } },
      { path: '/dashboard/conversations', component: InboxView }
    ]
  });
  await router.push('/dashboard/conversations');
  await router.isReady();
  const wrapper = mount(InboxView, { global: { plugins: [createPinia(), router, Vant] } });
  await flushPromises();
  return { wrapper, router };
}

afterEach(() => {
  vi.unstubAllGlobals();
  socketBus.clear();
  resetWebSocketForTests();
});

describe('InboxView sample data disclosure', () => {
  it('lists demo conversations with a dismissible notice and offline bar', async () => {
    const { wrapper } = await mountInbox();

    expect(wrapper.findAll('.conv-item').length).toBeGreaterThanOrEqual(5);
    expect(wrapper.find('.inbox__demo').text()).toContain('Sample data shown below');
    expect(wrapper.find('.ws-bar').exists()).toBe(true);
    expect(wrapper.find('.inbox__unread').text()).toBe('3');
  });

  it('collapses to the empty state once sample data is dismissed', async () => {
    const { wrapper, router } = await mountInbox();

    await wrapper.find('.inbox__demo button').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.conv-item')).toHaveLength(0);
    expect(wrapper.text()).toContain('No conversation data yet');
    expect(localStorage.getItem('ks-chat-demo-hidden')).toBe('1');

    await wrapper.find('.inbox__empty-cta').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
  });
});

describe('InboxView filters', () => {
  it('filters by unread, archived and platform', async () => {
    const { wrapper } = await mountInbox();
    const tabs = wrapper.findAll('.inbox__tab');

    await tabs[1].trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.conv-item__name').map((n) => n.text())).toEqual(['Amani Juma', 'Grace Adeyemi']);

    await tabs[2].trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.conv-item__name').map((n) => n.text())).toEqual(['Baraka Okonkwo']);

    await tabs[0].trigger('click');
    const chips = wrapper.findAll('.inbox__chip');
    const whatsapp = chips.find((c) => c.text() === 'WhatsApp');
    await whatsapp!.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.conv-item__name').map((n) => n.text())).toEqual(['Amani Juma', 'Neema Wanjiru']);
  });

  it('filters by search text', async () => {
    const { wrapper } = await mountInbox();
    const search = wrapper.find('.inbox__search');

    await search.setValue('grace');
    await search.trigger('input');
    await flushPromises();

    expect(wrapper.findAll('.conv-item__name').map((n) => n.text())).toEqual(['Grace Adeyemi']);
  });
});

describe('InboxView messaging', () => {
  it('loads the thread after selecting a conversation', async () => {
    const { wrapper } = await mountInbox();

    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    expect(wrapper.find('.inbox__contact').text()).toBe('Amani Juma');
    expect(wrapper.find('.inbox__platform-tag').text()).toBe('WhatsApp');
    expect(wrapper.findAll('.msg').length).toBeGreaterThan(10);
    expect(wrapper.findAll('.msg-list__day').length).toBeGreaterThanOrEqual(2);
    expect(wrapper.find('.msg-list__more').exists()).toBe(true);
  });

  it('sends a text message through the composer', async () => {
    const { wrapper } = await mountInbox();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    const before = wrapper.findAll('.msg').length;
    const textarea = wrapper.find('.composer__input');
    await textarea.setValue('Habari sana!');
    await textarea.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(wrapper.findAll('.msg').length).toBe(before + 1);
    expect(wrapper.text()).toContain('Habari sana!');
  });

  it('archives and restores the selected conversation', async () => {
    const { wrapper } = await mountInbox();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    const headBtn = () => wrapper.find('.inbox__head-btn');
    expect(headBtn().text()).toBe('Archive');

    await headBtn().trigger('click');
    await flushPromises();
    expect(headBtn().text()).toBe('Unarchive');

    await headBtn().trigger('click');
    await flushPromises();
    expect(headBtn().text()).toBe('Archive');
  });

  it('loads older history on demand', async () => {
    const { wrapper } = await mountInbox();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    const before = wrapper.findAll('.msg').length;
    await wrapper.find('.msg-list__more').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.msg').length).toBeGreaterThan(before);
    expect(wrapper.find('.msg-list__more').exists()).toBe(false);
  });
});

describe('InboxView AI assistance', () => {
  it('generates an AI reply and adopts it into the composer', async () => {
    const { wrapper } = await mountInbox();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    await wrapper.find('button[aria-label="AI reply"]').trigger('click');
    await flushPromises();

    const card = wrapper.find('.ai-card');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain('Asante kwa ujumbe');

    await card.find('.ai-card__btn--primary').trigger('click');
    await flushPromises();
    const textarea = wrapper.find('.composer__input').element as HTMLTextAreaElement;
    expect(textarea.value).toContain('Asante kwa ujumbe');
    expect(wrapper.find('.ai-card').exists()).toBe(false);
  });

  it('fills the composer from a quick reply template', async () => {
    const { wrapper } = await mountInbox();
    await wrapper.findAll('.conv-item')[0].trigger('click');
    await flushPromises();

    await wrapper.find('button[aria-label="Quick replies"]').trigger('click');
    await flushPromises();

    const items = wrapper.findAll('.quick-popup__item');
    expect(items.length).toBe(4);

    await items[0].trigger('click');
    await flushPromises();
    const textarea = wrapper.find('.composer__input').element as HTMLTextAreaElement;
    expect(textarea.value).toContain('Karibu');
  });

  it('shows the placeholder when nothing is selected', async () => {
    const { wrapper } = await mountInbox();
    expect(wrapper.find('.inbox__placeholder').text()).toContain('Select a conversation to start chatting');
  });
});