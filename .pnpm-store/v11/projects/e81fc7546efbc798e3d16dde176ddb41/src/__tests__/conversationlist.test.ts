import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ConversationList from '../components/ConversationList.vue';
import type { Conversation } from '../types';

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-1',
    contactName: 'Amani Juma',
    contactPhone: '+255 712 000 000',
    lastMessage: 'short message',
    lastMessageTime: Date.now(),
    unreadCount: 0,
    ...overrides
  };
}

describe('ConversationList', () => {
  it('renders name, preview and relative time', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations: [conversation()] }
    });

    expect(wrapper.text()).toContain('Amani Juma');
    expect(wrapper.text()).toContain('short message');
    expect(wrapper.text()).toContain('刚刚');
  });

  it('truncates previews longer than 30 chars', () => {
    const long = 'x'.repeat(50);
    const wrapper = mount(ConversationList, {
      props: { conversations: [conversation({ lastMessage: long })] }
    });

    expect(wrapper.text()).toContain(`${'x'.repeat(30)}…`);
    expect(wrapper.text()).not.toContain('x'.repeat(31));
  });

  it('shows unread badge with 99+ cap', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations: [conversation({ unreadCount: 150 })] }
    });

    expect(wrapper.find('.conv-item__badge').text()).toBe('99+');
  });

  it('hides badge when unread is zero', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations: [conversation({ unreadCount: 0 })] }
    });

    expect(wrapper.find('.conv-item__badge').exists()).toBe(false);
  });

  it('emits select on click and marks selection', async () => {
    const target = conversation();
    const wrapper = mount(ConversationList, {
      props: { conversations: [target], selectedId: null }
    });

    await wrapper.find('.conv-item').trigger('click');
    expect(wrapper.emitted<[[Conversation]]>('select')?.[0][0]).toEqual(target);

    await wrapper.setProps({ selectedId: 'c-1' });
    expect(wrapper.find('.conv-item--selected').exists()).toBe(true);
  });

  it('sorts conversations by newest message first', () => {
    const older = conversation({ id: 'old', lastMessageTime: Date.now() - 10_000, contactName: 'Old One' });
    const newer = conversation({ id: 'new', lastMessageTime: Date.now(), contactName: 'New One' });
    const wrapper = mount(ConversationList, {
      props: { conversations: [older, newer] }
    });

    const names = wrapper.findAll('.conv-item__name').map((n) => n.text());
    expect(names).toEqual(['New One', 'Old One']);
  });
});