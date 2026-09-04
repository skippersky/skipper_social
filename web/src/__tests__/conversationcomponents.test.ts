import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import AIReplyCard from '../components/conversation/AIReplyCard.vue';
import ConnectionStatusBar from '../components/conversation/ConnectionStatusBar.vue';
import ConversationItem from '../components/conversation/ConversationItem.vue';
import ConversationList from '../components/conversation/ConversationList.vue';
import MessageBubble from '../components/conversation/MessageBubble.vue';
import MessageInput from '../components/conversation/MessageInput.vue';
import MessageList from '../components/conversation/MessageList.vue';
import QuickReplyPopup from '../components/conversation/QuickReplyPopup.vue';
import TypingIndicator from '../components/conversation/TypingIndicator.vue';
import { groupMessages } from '../composables/messageGrouping';
import type { Conversation, Message, QuickReplyTemplate } from '../types';

const plugins = [createPinia(), Vant];

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: 'c-1',
    contactName: 'Amani Juma',
    contactPhone: '+255 712 345 678',
    lastMessage: 'Habari yako?',
    lastMessageTime: Date.now() - 60_000,
    unreadCount: 0,
    ...overrides
  };
}

function message(overrides: Partial<Message>): Message {
  return {
    id: 'm-1',
    conversationId: 'c-1',
    content: 'hello',
    type: 'text',
    sender: 'contact',
    timestamp: Date.now(),
    status: 'read',
    ...overrides
  };
}

describe('ConversationItem', () => {
  it('shows name, preview, badge and platform dot', () => {
    const wrapper = mount(ConversationItem, {
      props: { conversation: conversation({ unreadCount: 3, platform: 'whatsapp' }), selected: false },
      global: { plugins }
    });

    expect(wrapper.text()).toContain('Amani Juma');
    expect(wrapper.text()).toContain('Habari yako?');
    expect(wrapper.find('.conv-item__badge').text()).toBe('3');
    expect(wrapper.find('.conv-item__platform').exists()).toBe(true);
  });

  it('marks selected and archived states', () => {
    const wrapper = mount(ConversationItem, {
      props: { conversation: conversation({ archived: true }), selected: true },
      global: { plugins }
    });

    expect(wrapper.find('.conv-item').classes()).toContain('is-selected');
    expect(wrapper.find('.conv-item').classes()).toContain('is-archived');
  });

  it('emits select, read and archive', async () => {
    const wrapper = mount(ConversationItem, {
      props: { conversation: conversation({}), selected: false },
      global: { plugins }
    });

    await wrapper.find('.conv-item').trigger('click');
    const swipes = wrapper.findAll('.conv-item__swipe');
    await swipes[0].trigger('click');
    await swipes[1].trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
    expect(wrapper.emitted('read')).toHaveLength(1);
    expect(wrapper.emitted('archive')).toHaveLength(1);
  });
});

describe('ConversationList', () => {
  it('renders items and forwards their events with ids', async () => {
    const wrapper = mount(ConversationList, {
      props: {
        conversations: [conversation({ id: 'c-1' }), conversation({ id: 'c-2', contactName: 'Neema' })],
        selectedId: 'c-2'
      },
      global: { plugins }
    });

    expect(wrapper.findAll('.conv-item')).toHaveLength(2);

    await wrapper.findAll('.conv-item')[0].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['c-1']]);
  });
});

describe('MessageBubble', () => {
  it('styles incoming and outgoing directions differently', () => {
    const incoming = mount(MessageBubble, { props: { message: message({ sender: 'contact' }) }, global: { plugins } });
    const outgoing = mount(MessageBubble, { props: { message: message({ sender: 'user', status: 'sent' }) }, global: { plugins } });

    expect(incoming.find('.msg').classes()).toContain('msg--in');
    expect(outgoing.find('.msg').classes()).toContain('msg--out');
    expect(outgoing.find('.msg__status').text()).toBe('\u2713');
  });

  it('renders optional timestamps', () => {
    const wrapper = mount(MessageBubble, { props: { message: message({}), showTimestamp: true }, global: { plugins } });
    expect(wrapper.find('.msg__time').exists()).toBe(true);
  });

  it('renders images, file chips and audio chips', () => {
    const image = mount(MessageBubble, {
      props: { message: message({ type: 'image', mediaUrl: 'https://cdn/x.png' }) },
      global: { plugins }
    });
    expect(image.find('.msg__image').attributes('src')).toBe('https://cdn/x.png');

    const file = mount(MessageBubble, {
      props: { message: message({ type: 'file', mediaUrl: 'https://cdn/x.pdf' }) },
      global: { plugins }
    });
    expect(file.find('.msg__chip').text()).toBe('File');

    const audio = mount(MessageBubble, {
      props: { message: message({ type: 'audio', mediaUrl: 'https://cdn/x.ogg' }) },
      global: { plugins }
    });
    expect(audio.find('.msg__chip').text()).toBe('Voice message');
  });

  it('offers a retry action for failed messages', async () => {
    const wrapper = mount(MessageBubble, {
      props: { message: message({ sender: 'user', status: 'failed' }) },
      global: { plugins }
    });

    await wrapper.find('.msg__retry').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('MessageList', () => {
  const items = groupMessages([
    message({ id: 'm-1', timestamp: Date.now() - 60_000 }),
    message({ id: 'm-2', sender: 'user', timestamp: Date.now() - 30_000 })
  ]);

  it('renders day separators and bubbles', () => {
    const wrapper = mount(MessageList, {
      props: { items, loading: false, hasMore: false },
      global: { plugins }
    });

    expect(wrapper.findAll('.msg-list__day')).toHaveLength(1);
    expect(wrapper.findAll('.msg')).toHaveLength(2);
  });

  it('offers loading older history', async () => {
    const wrapper = mount(MessageList, {
      props: { items, loading: false, hasMore: true },
      global: { plugins }
    });

    await wrapper.find('.msg-list__more').trigger('click');
    expect(wrapper.emitted('loadMore')).toHaveLength(1);
  });

  it('forwards retry events with the message id', async () => {
    const failedItems = groupMessages([message({ id: 'm-9', sender: 'user', status: 'failed' })]);
    const wrapper = mount(MessageList, {
      props: { items: failedItems, loading: false, hasMore: false },
      global: { plugins }
    });

    await wrapper.find('.msg__retry').trigger('click');
    expect(wrapper.emitted('retry')).toEqual([['m-9']]);
  });

  it('shows the remote typing indicator', () => {
    const wrapper = mount(MessageList, {
      props: { items, loading: false, hasMore: false, remoteTyping: true },
      global: { plugins }
    });

    expect(wrapper.find('.typing').exists()).toBe(true);
  });
});

describe('MessageInput', () => {
  it('sends on Enter and keeps Shift+Enter for newlines', async () => {
    const wrapper = mount(MessageInput, { global: { plugins } });
    const textarea = wrapper.find('.composer__input');

    await textarea.setValue('Habari');
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true });
    expect(wrapper.emitted('send')).toBeUndefined();

    await textarea.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toEqual([['Habari']]);
    expect((textarea.element as HTMLTextAreaElement).value).toBe('');
  });

  it('reports typing state while the text changes', async () => {
    const wrapper = mount(MessageInput, { global: { plugins } });
    const textarea = wrapper.find('.composer__input');

    await textarea.setValue('a');
    await textarea.setValue('');

    expect(wrapper.emitted('typing')).toEqual([[true], [false]]);
  });

  it('exposes setText for AI adoption and quick replies', async () => {
    const wrapper = mount(MessageInput, { global: { plugins } });

    wrapper.vm.setText('Karibu!');
    expect(wrapper.vm.getText()).toBe('Karibu!');
    await wrapper.vm.$nextTick();
    expect((wrapper.find('.composer__input').element as HTMLTextAreaElement).value).toBe('Karibu!');
  });

  it('emits the picked attachment', async () => {
    const wrapper = mount(MessageInput, { global: { plugins } });
    const input = wrapper.find('input[type="file"]');
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(input.element, 'files', { value: [file] });

    await input.trigger('change');

    expect(wrapper.emitted('attach')?.[0]?.[0]).toBe(file);
  });

  it('emits ai and quick actions from the toolbar', async () => {
    const wrapper = mount(MessageInput, { global: { plugins } });
    const buttons = wrapper.findAll('.composer__btn');

    await buttons[1].trigger('click');
    await buttons[2].trigger('click');

    expect(wrapper.emitted('ai')).toHaveLength(1);
    expect(wrapper.emitted('quick')).toHaveLength(1);
  });
});

describe('AIReplyCard', () => {
  it('shows a loading placeholder while generating', () => {
    const wrapper = mount(AIReplyCard, { props: { text: '', loading: true }, global: { plugins } });

    expect(wrapper.text()).toContain('Writing a reply for you');
    expect(wrapper.find('.ai-card__btn--primary').attributes('disabled')).toBeDefined();
  });

  it('emits adopt, regenerate and close', async () => {
    const wrapper = mount(AIReplyCard, { props: { text: 'Asante!', loading: false }, global: { plugins } });
    const buttons = wrapper.findAll('.ai-card__btn');

    expect(wrapper.text()).toContain('Asante!');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');

    expect(wrapper.emitted('adopt')).toHaveLength(1);
    expect(wrapper.emitted('regenerate')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('QuickReplyPopup', () => {
  const templates: QuickReplyTemplate[] = [
    { id: 't-1', title: 'Greeting', text: 'Habari!' },
    { id: 't-2', title: 'Thanks', text: 'Asante!' }
  ];

  it('lists templates and emits the selection', async () => {
    const wrapper = mount(QuickReplyPopup, {
      props: { show: true, templates },
      global: { plugins }
    });

    const items = wrapper.findAll('.quick-popup__item');
    expect(items).toHaveLength(2);

    await items[1].trigger('click');
    expect(wrapper.emitted('select')).toEqual([[templates[1]]]);
  });

  it('renders nothing while hidden', () => {
    const wrapper = mount(QuickReplyPopup, {
      props: { show: false, templates },
      global: { plugins }
    });

    expect(wrapper.findAll('.quick-popup__item')).toHaveLength(0);
  });
});

describe('ConnectionStatusBar', () => {
  it('stays hidden while connected', () => {
    const wrapper = mount(ConnectionStatusBar, { props: { status: 'connected' }, global: { plugins } });
    expect(wrapper.find('.ws-bar').exists()).toBe(false);
  });

  it('describes connecting, reconnecting and offline states', () => {
    for (const [status, text] of [
      ['connecting', 'Connecting to live updates'],
      ['reconnecting', 'reconnecting'],
      ['disconnected', 'Offline, live updates paused']
    ] as const) {
      const wrapper = mount(ConnectionStatusBar, { props: { status }, global: { plugins } });
      expect(wrapper.text()).toContain(text);
    }
  });
});

describe('TypingIndicator', () => {
  it('announces typing with three dots', () => {
    const wrapper = mount(TypingIndicator, { global: { plugins } });
    expect(wrapper.findAll('.typing__dot')).toHaveLength(3);
    expect(wrapper.attributes('aria-label')).toBe('typing');
  });
});