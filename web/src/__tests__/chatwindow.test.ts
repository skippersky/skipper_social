import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ChatWindow from '../components/ChatWindow.vue';
import type { Conversation, Message } from '../types';

const conversation: Conversation = {
  id: 'c-1',
  contactName: 'Neema Wanjiru',
  contactPhone: '+254 723 456 789',
  lastMessage: 'hello',
  lastMessageTime: Date.now(),
  unreadCount: 0
};

const now = Date.now();

const thread: Message[] = [
  {
    id: 'm-1',
    conversationId: 'c-1',
    content: 'Habari!',
    type: 'text',
    sender: 'contact',
    timestamp: now - 60_000,
    status: 'read'
  },
  {
    id: 'm-2',
    conversationId: 'c-1',
    content: 'photo.jpg',
    type: 'image',
    sender: 'user',
    timestamp: now - 30_000,
    status: 'sent',
    mediaUrl: 'https://cdn.example.test/photo.jpg'
  },
  {
    id: 'm-3',
    conversationId: 'c-1',
    content: 'Kariakoo Market',
    type: 'location',
    sender: 'contact',
    timestamp: now - 10_000,
    status: 'read',
    mediaUrl: 'https://example.com/map'
  }
];

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  degraded: boolean;
}

function mountWindow(props: Partial<ChatWindowProps> = {}) {
  const merged: ChatWindowProps = {
    conversation,
    messages: [],
    loading: false,
    degraded: false,
    ...props
  };
  return mount(ChatWindow, {
    props: merged,
    global: { plugins: [createPinia()] }
  });
}
describe('ChatWindow', () => {
  it('shows empty state without a conversation', () => {
    const wrapper = mountWindow({ conversation: null });

    expect(wrapper.text()).toContain('Select a conversation to start chatting');
    expect(wrapper.find('.chat-window__header').exists()).toBe(false);
  });

  it('shows contact header and disabled composer when selected', () => {
    const wrapper = mountWindow();

    expect(wrapper.text()).toContain('Neema Wanjiru');
    expect(wrapper.text()).toContain('+254 723 456 789');
    expect(wrapper.find('.chat-window__input').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.chat-window__send').attributes('disabled')).toBeDefined();
  });
  it('renders a skeleton while messages load', () => {
    const wrapper = mountWindow({ loading: true, messages: thread });

    expect(wrapper.find('van-skeleton').exists()).toBe(true);
    expect(wrapper.findAll('.msg')).toHaveLength(0);
  });

  it('renders text, image and location bubbles', () => {
    const wrapper = mountWindow({ messages: thread });

    expect(wrapper.findAll('.msg')).toHaveLength(3);
    expect(wrapper.text()).toContain('Habari!');
    const image = wrapper.find('.msg__image');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toContain('photo.jpg');
    const location = wrapper.find('.msg__location');
    expect(location.exists()).toBe(true);
    expect(location.attributes('href')).toBe('https://example.com/map');
    expect(location.text()).toContain('Location');
    expect(location.text()).toContain('Kariakoo Market');
  });
  it('shows a hint when the thread is empty', () => {
    const wrapper = mountWindow({ messages: [] });

    expect(wrapper.text()).toContain('No messages yet');
  });

  it('shows the degraded notice with retry when offline', async () => {
    const wrapper = mountWindow({ degraded: true, messages: thread });

    expect(wrapper.text()).toContain('Network error, showing sample data');
    await wrapper.find('.chat-window__notice button').trigger('click');
    expect(wrapper.emitted('retry')).toBeTruthy();
  });

  it('hides the degraded notice when the backend responded', () => {
    const wrapper = mountWindow({ messages: thread });

    expect(wrapper.find('.chat-window__notice').exists()).toBe(false);
  });
});