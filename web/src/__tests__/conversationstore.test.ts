import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as conversationApi from '../api/conversation';
import { ApiError } from '../api/http';
import { SOCKET_CONVERSATION_UPDATED, SOCKET_NEW_MESSAGE, socketBus } from '../events/socket';
import { useConversationStore } from '../stores/conversation';
import type { Conversation, Message } from '../types';

vi.mock('../api/conversation', () => ({
  getConversations: vi.fn(),
  getConversationById: vi.fn(),
  markAsRead: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  assignConversation: vi.fn()
}));

const mocked = vi.mocked(conversationApi);

function conversation(overrides: Partial<Conversation>): Conversation {
  return {
    id: 'c-1',
    contactName: 'Amani Juma',
    contactPhone: '+255 712 345 678',
    lastMessage: 'hello',
    lastMessageTime: 1000,
    unreadCount: 0,
    ...overrides
  };
}

function socketMessage(overrides: Partial<Message>): Message {
  return {
    id: 'm-1',
    conversationId: 'c-1',
    content: 'new line',
    type: 'text',
    sender: 'contact',
    timestamp: 2000,
    status: 'sent',
    ...overrides
  };
}

function seedStore(list: Conversation[]) {
  const store = useConversationStore();
  store.conversations = [...list];
  return store;
}

beforeEach(() => {
  socketBus.clear();
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mocked.markAsRead.mockResolvedValue(undefined);
});

describe('conversation store loading', () => {
  it('fetches and stores the conversation list', async () => {
    mocked.getConversations.mockResolvedValue([conversation({ id: 'c-1' }), conversation({ id: 'c-2' })]);
    const store = useConversationStore();

    await store.fetchConversations();

    expect(store.conversations).toHaveLength(2);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('maps API failures to an i18n error key', async () => {
    mocked.getConversations.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useConversationStore();

    await store.fetchConversations();

    expect(store.error).toBe('api.500');
    expect(store.conversations).toHaveLength(0);
  });
});

describe('conversation store filters', () => {
  const list = [
    conversation({ id: 'c-1', contactName: 'Amani Juma', contactPhone: '+255 712 000', unreadCount: 2, platform: 'whatsapp', lastMessageTime: 300 }),
    conversation({ id: 'c-2', contactName: 'Grace Adeyemi', contactPhone: '+234 803 111', unreadCount: 0, platform: 'facebook', lastMessageTime: 200 }),
    conversation({ id: 'c-3', contactName: 'Baraka Okonkwo', contactPhone: '+256 701 222', unreadCount: 1, platform: 'whatsapp', archived: true, lastMessageTime: 100 })
  ];

  it('filters by name or phone query', () => {
    const store = seedStore(list);

    store.setFilters({ query: 'amani' });
    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-1']);

    store.setFilters({ query: '234' });
    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-2']);

    store.setFilters({ query: 'nobody' });
    expect(store.filteredConversations).toHaveLength(0);
  });

  it('filters unread and archived states', () => {
    const store = seedStore(list);

    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-1', 'c-2']);

    store.setFilters({ status: 'unread' });
    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-1']);

    store.setFilters({ status: 'archived', query: '' });
    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-3']);
  });

  it('filters by platform and resets filters', () => {
    const store = seedStore(list);

    store.setFilters({ platform: 'facebook' });
    expect(store.filteredConversations.map((c) => c.id)).toEqual(['c-2']);

    store.resetFilters();
    expect(store.filters).toEqual({ query: '', status: 'all', platform: 'all' });
  });

  it('counts unread messages excluding archived threads', () => {
    const store = seedStore(list);
    expect(store.totalUnread).toBe(2);
  });
});

describe('conversation store actions', () => {
  it('archives and unarchives conversations', async () => {
    mocked.archiveConversation.mockResolvedValue(undefined);
    mocked.unarchiveConversation.mockResolvedValue(undefined);
    const store = seedStore([conversation({ id: 'c-1' })]);

    expect(await store.archive('c-1')).toBe(true);
    expect(store.conversations[0].archived).toBe(true);

    expect(await store.unarchive('c-1')).toBe(true);
    expect(store.conversations[0].archived).toBe(false);
  });

  it('reports archive failures through the error key', async () => {
    mocked.archiveConversation.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = seedStore([conversation({ id: 'c-1' })]);

    expect(await store.archive('c-1')).toBe(false);
    expect(store.error).toBe('api.500');
  });

  it('marks a conversation as read locally and remotely', async () => {
    const store = seedStore([conversation({ id: 'c-1', unreadCount: 4 })]);

    await store.markAsRead('c-1');

    expect(store.conversations[0].unreadCount).toBe(0);
    expect(mocked.markAsRead).toHaveBeenCalledWith('c-1');
  });

  it('selects a conversation and marks it read', async () => {
    const store = seedStore([conversation({ id: 'c-1', unreadCount: 2 })]);

    await store.selectConversation('c-1');

    expect(store.currentConversationId).toBe('c-1');
    expect(store.currentConversation?.id).toBe('c-1');
    expect(store.conversations[0].unreadCount).toBe(0);
  });
});

describe('conversation store socket observer', () => {
  it('applies incoming messages: preview, unread badge, move to top', () => {
    const store = seedStore([
      conversation({ id: 'c-1', lastMessageTime: 100 }),
      conversation({ id: 'c-2', lastMessageTime: 300 })
    ]);

    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: socketMessage({ conversationId: 'c-1', content: 'sasa', timestamp: 900 }) });

    const updated = store.conversations[0];
    expect(updated.id).toBe('c-1');
    expect(updated.lastMessage).toBe('sasa');
    expect(updated.lastMessageTime).toBe(900);
    expect(updated.unreadCount).toBe(1);
  });

  it('does not raise unread for outgoing or currently open threads', () => {
    const store = seedStore([conversation({ id: 'c-1', unreadCount: 0 })]);
    store.currentConversationId = 'c-1';

    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: socketMessage({ sender: 'contact' }) });
    expect(store.conversations[0].unreadCount).toBe(0);

    store.currentConversationId = null;
    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: socketMessage({ id: 'm-2', sender: 'user' }) });
    expect(store.conversations[0].unreadCount).toBe(0);
  });

  it('ignores messages for unknown conversations', () => {
    const store = seedStore([conversation({ id: 'c-1' })]);

    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: socketMessage({ conversationId: 'ghost' }) });

    expect(store.conversations).toHaveLength(1);
    expect(store.conversations[0].lastMessage).toBe('hello');
  });

  it('applies conversation patches from the socket', () => {
    const store = seedStore([conversation({ id: 'c-1' })]);

    socketBus.emit({ type: SOCKET_CONVERSATION_UPDATED, conversationId: 'c-1', patch: { archived: true, contactName: 'Zuri' } });

    expect(store.conversations[0].archived).toBe(true);
    expect(store.conversations[0].contactName).toBe('Zuri');
  });
});