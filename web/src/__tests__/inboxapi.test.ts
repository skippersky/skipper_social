import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as aiApi from '../api/ai';
import * as conversationApi from '../api/conversation';
import { isMissingBackend } from '../api/demo';
import { ApiError } from '../api/http';
import * as messageApi from '../api/message';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: ok, code: ok ? 'OK' : `HTTP_${status}`, message: '', data })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isMissingBackend', () => {
  it('treats network errors, timeouts and 404s as a missing backend', () => {
    expect(isMissingBackend(new Error('offline'))).toBe(true);
    expect(isMissingBackend(new ApiError('TIMEOUT', 'slow'))).toBe(true);
    expect(isMissingBackend(new ApiError('HTTP_404', 'gone'))).toBe(true);
    expect(isMissingBackend(new ApiError('NOT_FOUND', 'gone'))).toBe(true);
    expect(isMissingBackend(new ApiError('HTTP_500', 'boom'))).toBe(false);
  });
});

describe('conversation api with demo fallback', () => {
  it('falls back to the demo directory, tagged as demo data', async () => {
    offline();
    const list = await conversationApi.getConversations();

    expect(list.length).toBeGreaterThanOrEqual(5);
    expect(list.every((c) => c.demo === true)).toBe(true);
    expect(list[0].id).toBe('i-1');
    const times = list.map((c) => c.lastMessageTime);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('returns backend data untouched when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([{ id: 'srv-1', contactName: 'Real' }])));
    const list = await conversationApi.getConversations();

    expect(list).toEqual([{ id: 'srv-1', contactName: 'Real' }]);
  });

  it('serialises filters into the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await conversationApi.getConversations({ query: 'amani', status: 'unread', platform: 'whatsapp' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('query=amani');
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=unread');
    expect(String(fetchMock.mock.calls[0][0])).toContain('platform=whatsapp');
  });

  it('keeps read/archive operations quiet while offline', async () => {
    offline();
    await expect(conversationApi.markAsRead('i-1')).resolves.toBeUndefined();
    await expect(conversationApi.archiveConversation('i-1')).resolves.toBeUndefined();
    await expect(conversationApi.unarchiveConversation('i-1')).resolves.toBeUndefined();
  });
});

describe('message api with demo fallback', () => {
  it('pages the demo history from the end', async () => {
    offline();
    const page = await messageApi.getMessages('i-1');

    expect(page.messages).toHaveLength(20);
    expect(page.hasMore).toBe(true);
  });

  it('loads older demo messages before the cursor without overlap', async () => {
    offline();
    const first = await messageApi.getMessages('i-1');
    const oldest = first.messages[0].timestamp;

    const older = await messageApi.getMessages('i-1', { before: oldest, limit: 20 });

    expect(older.messages.length).toBeGreaterThan(0);
    expect(older.messages.every((m) => m.timestamp < oldest)).toBe(true);
    expect(older.hasMore).toBe(false);
  });

  it('returns an empty page for unknown conversations', async () => {
    offline();
    const page = await messageApi.getMessages('ghost');
    expect(page).toEqual({ messages: [], hasMore: false });
  });

  it('sends demo messages with a sent status', async () => {
    offline();
    const saved = await messageApi.sendMessage('i-2', { content: 'hello', type: 'text' });

    expect(saved).toMatchObject({ conversationId: 'i-2', content: 'hello', sender: 'user', status: 'sent' });

    const page = await messageApi.getMessages('i-2');
    expect(page.messages.some((m) => m.id === saved.id)).toBe(true);
  });

  it('uploads media to a demo data URL while offline', async () => {
    offline();
    const result = await messageApi.uploadMedia(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(result.url.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('uploads through the backend when it responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ url: 'https://cdn/x.png' })));
    const result = await messageApi.uploadMedia(new File(['x'], 'photo.png'));
    expect(result.url).toBe('https://cdn/x.png');
  });

  it('deletes demo messages without throwing', async () => {
    offline();
    await expect(messageApi.deleteMessage('i-2-m-1')).resolves.toBeUndefined();
    const page = await messageApi.getMessages('i-2');
    expect(page.messages.some((m) => m.id === 'i-2-m-1')).toBe(false);
  });
});

describe('ai api with demo fallback', () => {
  it('generates a reply suggestion echoing the last contact message', async () => {
    offline();
    const suggestion = await aiApi.generateReply('i-1');

    expect(suggestion.id).toContain('demo-ai');
    expect(suggestion.text.length).toBeGreaterThan(10);
  });

  it('lists the quick reply templates', async () => {
    offline();
    const templates = await aiApi.getQuickTemplates();

    expect(templates).toHaveLength(4);
    expect(templates[0]).toMatchObject({ id: 't-greet' });
  });

  it('applies a known template and rejects unknown ones', async () => {
    offline();
    const applied = await aiApi.applyTemplate('t-price');
    expect(applied.text).toContain('25,000');

    await expect(aiApi.applyTemplate('ghost')).rejects.toThrow();
  });
});