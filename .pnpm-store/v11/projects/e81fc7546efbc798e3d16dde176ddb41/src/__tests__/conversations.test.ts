import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConversations, MOCK_CONVERSATIONS } from '../api/conversations';

describe('fetchConversations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns backend data when the endpoint is available', async () => {
    const remote = [{ id: 'x', contactName: 'X', contactPhone: '+1', lastMessage: 'm', lastMessageTime: 1, unreadCount: 0 }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: remote })
    }));

    await expect(fetchConversations()).resolves.toEqual(remote);
  });

  it('falls back to mock data when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchConversations()).resolves.toEqual(MOCK_CONVERSATIONS);
    expect(MOCK_CONVERSATIONS.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to mock data on error envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ success: false, code: 'NOT_FOUND', message: 'missing', data: null })
    }));

    await expect(fetchConversations()).resolves.toEqual(MOCK_CONVERSATIONS);
  });
});