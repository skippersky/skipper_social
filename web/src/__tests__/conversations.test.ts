import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConversations, fetchMessages, MOCK_CONVERSATIONS, MOCK_MESSAGES, sendMessage } from '../api/conversations';
import { ApiError } from '../api/http';

describe('fetchConversations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns backend data when the endpoint is available', async () => {
    const remote = [{ id: 'x', contactName: 'X', contactPhone: '+1', lastMessage: 'm', lastMessageTime: 1, unreadCount: 0 }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: remote })
    }));

    const result = await fetchConversations();
    expect(result).toEqual({ data: remote, degraded: false });
  });

  it('falls back to mock data when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await fetchConversations();
    expect(result.degraded).toBe(true);
    expect(result.data).toEqual(MOCK_CONVERSATIONS);
  });
});

describe('fetchMessages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns backend messages when available', async () => {
    const remote = [{ id: 'm-9', conversationId: 'c-2', content: 'hi', type: 'text', sender: 'contact', timestamp: 1, status: 'read' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: remote })
    }));

    await expect(fetchMessages('c-2')).resolves.toEqual({ data: remote, degraded: false });
  });

  it('degrades to mock messages filtered by conversation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await fetchMessages('c-1');
    expect(result.degraded).toBe(true);
    expect(result.data).toEqual(MOCK_MESSAGES.filter((m) => m.conversationId === 'c-1'));
    expect(result.data.length).toBeGreaterThan(0);

    const empty = await fetchMessages('c-4');
    expect(empty.data).toEqual([]);
  });
});

describe('sendMessage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to the messages endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: { id: 'm-1' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('c-1', 'hello', 'text');

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('/api/v1/conversations/c-1/messages');
  });

  it('propagates ApiError without retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ success: false, code: 'NOT_FOUND', message: 'missing', data: null })
    }));

    await expect(sendMessage('c-1', 'x', 'text')).rejects.toBeInstanceOf(ApiError);
  });
});