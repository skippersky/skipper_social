import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ChatWindow from '../components/ChatWindow.vue';
import type { Conversation } from '../types';

const conversation: Conversation = {
  id: 'c-1',
  contactName: 'Neema Wanjiru',
  contactPhone: '+254 723 456 789',
  lastMessage: 'hello',
  lastMessageTime: Date.now(),
  unreadCount: 0
};

describe('ChatWindow', () => {
  it('shows empty state without a conversation', () => {
    const wrapper = mount(ChatWindow, {
      props: { conversation: null },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.text()).toContain('Select a conversation to start chatting');
    expect(wrapper.find('.chat-window__header').exists()).toBe(false);
  });

  it('shows contact header and disabled composer when selected', () => {
    const wrapper = mount(ChatWindow, {
      props: { conversation },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.text()).toContain('Neema Wanjiru');
    expect(wrapper.text()).toContain('+254 723 456 789');
    expect(wrapper.find('.chat-window__input').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.chat-window__send').attributes('disabled')).toBeDefined();
  });
});