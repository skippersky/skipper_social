import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '../api/http';
import * as messageApi from '../api/message';
import { SOCKET_MESSAGE_READ, SOCKET_NEW_MESSAGE, socketBus } from '../events/socket';
import { useMessageStore } from '../stores/message';
import type { Message } from '../types';

vi.mock('../api/message', () => ({
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  uploadMedia: vi.fn(),
  deleteMessage: vi.fn()
}));

const mocked = vi.mocked(messageApi);

function message(overrides: Partial<Message>): Message {
  return {
    id: overrides.id ?? 'm-1',
    conversationId: overrides.conversationId ?? 'c-1',
    content: 'text',
    type: 'text',
    sender: 'contact',
    timestamp: 1000,
    status: 'read',
    ...overrides
  };
}

beforeEach(() => {
  socketBus.clear();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('message store loading', () => {
  it('loads a page of messages with the hasMore flag', async () => {
    mocked.getMessages.mockResolvedValue({ messages: [message({ id: 'm-1' })], hasMore: true });
    const store = useMessageStore();

    await store.fetchMessages('c-1');

    expect(store.currentMessages('c-1')).toHaveLength(1);
    expect(store.hasMore('c-1')).toBe(true);
    expect(store.isLoading('c-1')).toBe(false);
    expect(mocked.getMessages).toHaveBeenCalledWith('c-1', { limit: 20 });
  });

  it('records an error key when loading fails', async () => {
    mocked.getMessages.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useMessageStore();

    await store.fetchMessages('c-1');

    expect(store.error).toBe('api.500');
    expect(store.currentMessages('c-1')).toHaveLength(0);
  });

  it('prepends older pages while deduplicating by id', async () => {
    mocked.getMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm-3', timestamp: 300 }), message({ id: 'm-4', timestamp: 400 })],
      hasMore: true
    });
    const store = useMessageStore();
    await store.fetchMessages('c-1');

    mocked.getMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm-1', timestamp: 100 }), message({ id: 'm-3', timestamp: 300 })],
      hasMore: false
    });
    await store.loadMore('c-1');

    const list = store.currentMessages('c-1');
    expect(list.map((m) => m.id)).toEqual(['m-1', 'm-3', 'm-4']);
    expect(store.hasMore('c-1')).toBe(false);
    expect(mocked.getMessages).toHaveBeenLastCalledWith('c-1', { before: 300, limit: 20 });
  });

  it('does nothing when loading more for an empty thread', async () => {
    const store = useMessageStore();
    await store.loadMore('c-1');
    expect(mocked.getMessages).not.toHaveBeenCalled();
  });
});

describe('message store sending', () => {
  it('sends optimistically and confirms with the saved copy', async () => {
    mocked.sendMessage.mockResolvedValue(message({ id: 'srv-1', sender: 'user', status: 'sending', content: 'habari' }));
    const store = useMessageStore();

    const promise = store.sendMessage('c-1', { content: 'habari', type: 'text' });
    expect(store.currentMessages('c-1')).toHaveLength(1);
    expect(store.currentMessages('c-1')[0].status).toBe('sending');

    const ok = await promise;
    expect(ok).toBe(true);
    expect(store.currentMessages('c-1')[0]).toMatchObject({ id: 'srv-1', status: 'sent' });
    expect(store.isSending).toBe(false);
  });

  it('flags failed sends and exposes the error key', async () => {
    mocked.sendMessage.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useMessageStore();

    const ok = await store.sendMessage('c-1', { content: 'habari', type: 'text' });

    expect(ok).toBe(false);
    expect(store.currentMessages('c-1')[0].status).toBe('failed');
    expect(store.error).toBe('api.500');
  });

  it('retries failed messages only', async () => {
    mocked.sendMessage
      .mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'))
      .mockResolvedValueOnce(message({ id: 'srv-2', sender: 'user', status: 'sent', content: 'habari' }));
    const store = useMessageStore();

    await store.sendMessage('c-1', { content: 'habari', type: 'text' });
    const failedId = store.currentMessages('c-1')[0].id;

    expect(await store.retryMessage('c-1', 'missing')).toBe(false);

    const ok = await store.retryMessage('c-1', failedId);
    expect(ok).toBe(true);
    expect(store.currentMessages('c-1')[0]).toMatchObject({ id: 'srv-2', status: 'sent' });
  });

  it('marks a retry failure with the failed status again', async () => {
    mocked.sendMessage.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useMessageStore();
    await store.sendMessage('c-1', { content: 'x', type: 'text' });
    const failedId = store.currentMessages('c-1')[0].id;

    const ok = await store.retryMessage('c-1', failedId);

    expect(ok).toBe(false);
    expect(store.currentMessages('c-1')[0].status).toBe('failed');
  });

  it('deletes messages', async () => {
    mocked.getMessages.mockResolvedValue({ messages: [message({ id: 'm-1' }), message({ id: 'm-2' })], hasMore: false });
    mocked.deleteMessage.mockResolvedValue(undefined);
    const store = useMessageStore();
    await store.fetchMessages('c-1');

    expect(await store.deleteMessage('c-1', 'm-1')).toBe(true);
    expect(store.currentMessages('c-1').map((m) => m.id)).toEqual(['m-2']);
  });
});

describe('message store socket observer', () => {
  it('appends live messages once', async () => {
    mocked.getMessages.mockResolvedValue({ messages: [message({ id: 'm-1' })], hasMore: false });
    const store = useMessageStore();
    await store.fetchMessages('c-1');

    const incoming = message({ id: 'm-2', sender: 'contact', content: 'live' });
    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: incoming });
    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: incoming });

    expect(store.currentMessages('c-1').map((m) => m.id)).toEqual(['m-1', 'm-2']);
  });

  it('marks outgoing messages as read on receipts', async () => {
    mocked.getMessages.mockResolvedValue({
      messages: [
        message({ id: 'm-1', sender: 'user' }),
        message({ id: 'm-2', sender: 'contact' })
      ],
      hasMore: false
    });
    const store = useMessageStore();
    await store.fetchMessages('c-1');

    socketBus.emit({ type: SOCKET_MESSAGE_READ, conversationId: 'c-1' });
    expect(store.currentMessages('c-1')[0].status).toBe('read');
    expect(store.currentMessages('c-1')[1].status).toBe('read');

    socketBus.emit({ type: SOCKET_MESSAGE_READ, conversationId: 'c-1', messageId: 'm-1' });
    expect(store.currentMessages('c-1')[0].status).toBe('read');
  });
});