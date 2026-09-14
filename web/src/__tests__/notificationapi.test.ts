import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationApi from '../api/notification';
import { ApiError } from '../api/http';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../api/demo';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({ success: ok, code: ok ? 'OK' : 'HTTP_' + status, message: '', data })
  } as Response;
}

/** Network down: every call must fall back to the offline demo directory. */
function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

/** A live backend answering 5xx: no demo fallback is allowed. */
function hardFailure(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

function urls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}

function live<T>(data: T) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(data));
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('notification api live backend', () => {
  it('forwards filters and paging as query params', async () => {
    const mock = live({ notifications: [], hasMore: false, total: 0 });

    await notificationApi.getNotifications({
      type: 'message',
      status: 'unread',
      limit: 20,
      offset: 40
    });

    const url = new URL(urls(mock)[0], 'http://localhost');
    expect(url.pathname).toBe('/api/v1/notifications');
    expect(url.searchParams.get('type')).toBe('message');
    expect(url.searchParams.get('status')).toBe('unread');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('40');
  });

  it('drops the query string for an unfiltered first page', async () => {
    const mock = live({ notifications: [], hasMore: false, total: 0 });

    await notificationApi.getNotifications();
    await notificationApi.getNotifications({ type: 'all', status: 'all' });

    expect(urls(mock)).toEqual(['/api/v1/notifications', '/api/v1/notifications']);
    expect(notificationApi.PAGE_LIMIT).toBe(20);
  });

  it('reads a single notification and escapes its id', async () => {
    const row = { id: 'a/b', type: 'system', title: 't', body: 'b', read: true, createdAt: 1 };
    const mock = live(row);

    await expect(notificationApi.getNotificationById('a/b')).resolves.toEqual(row);
    expect(urls(mock)[0]).toBe('/api/v1/notifications/a%2Fb');
  });

  it('marks one row read over PUT', async () => {
    const row = { id: 'n1', type: 'message', title: 't', body: 'b', read: true, createdAt: 1 };
    const mock = live(row);

    await expect(notificationApi.markAsRead('n1')).resolves.toMatchObject({ read: true });
    expect(urls(mock)[0]).toBe('/api/v1/notifications/n1/read');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'PUT' });
  });

  it('unwraps the bulk counters and defaults a missing field to zero', async () => {
    live({ updated: 4 });
    await expect(notificationApi.markAllAsRead()).resolves.toBe(4);

    live({ deleted: 7 });
    await expect(notificationApi.deleteReadNotifications()).resolves.toBe(7);

    live({ count: 3 });
    await expect(notificationApi.getUnreadCount()).resolves.toBe(3);

    live(null);
    await expect(notificationApi.markAllAsRead()).resolves.toBe(0);
    await expect(notificationApi.deleteReadNotifications()).resolves.toBe(0);
    await expect(notificationApi.getUnreadCount()).resolves.toBe(0);
  });

  it('deletes one row over DELETE', async () => {
    const mock = live(null);

    await expect(notificationApi.deleteNotification('n9')).resolves.toBeUndefined();
    expect(urls(mock)[0]).toBe('/api/v1/notifications/n9');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('reads and writes the delivery preferences', async () => {
    live(DEFAULT_NOTIFICATION_PREFERENCES);
    await expect(notificationApi.getNotificationPreferences()).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );

    const saved = { ...DEFAULT_NOTIFICATION_PREFERENCES, sound: false };
    const mock = live(saved);
    await expect(notificationApi.updateNotificationPreferences({ sound: false })).resolves.toEqual(
      saved
    );
    expect(urls(mock)[0]).toBe('/api/v1/notifications/preferences');
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toEqual({ sound: false });
  });

  it('treats a 404 as a missing backend and serves the demo directory', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));

    const page = await notificationApi.getNotifications();

    expect(page.total).toBe(11);
    expect(page.notifications.every((row) => row.demo === true)).toBe(true);
  });

  it('rethrows a hard backend failure instead of masking it with demo data', async () => {
    hardFailure(500);

    const error = await notificationApi.getNotifications().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HTTP_500');

    hardFailure(500);
    await expect(notificationApi.markAllAsRead()).rejects.toThrow();
  });
});

describe('notification api demo fallback', () => {
  it('seeds eleven rows from the inbox and the product timeline', async () => {
    offline();

    const page = await notificationApi.getNotifications();

    expect(page.total).toBe(11);
    expect(page.hasMore).toBe(false);
    expect(page.notifications[0].id).toBe('ntf-inbox-i-1');
    expect(page.notifications.map((row) => row.id)).toContain('ntf-10');
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
  });

  it('filters the demo directory by type and read status', async () => {
    offline();

    const system = await notificationApi.getNotifications({ type: 'system' });
    expect(system.notifications.map((row) => row.id)).toEqual(['ntf-5', 'ntf-7', 'ntf-9']);

    const unread = await notificationApi.getNotifications({ status: 'unread' });
    expect(unread.total).toBe(4);
    expect(unread.notifications.every((row) => !row.read)).toBe(true);

    const read = await notificationApi.getNotifications({ status: 'read' });
    expect(read.total).toBe(7);

    const both = await notificationApi.getNotifications({ type: 'customer', status: 'unread' });
    expect(both.notifications.map((row) => row.id)).toEqual(['ntf-3']);
  });

  it('pages the demo directory', async () => {
    offline();

    const first = await notificationApi.getNotifications({ limit: 4, offset: 0 });
    const second = await notificationApi.getNotifications({ limit: 4, offset: 4 });

    expect(first.notifications).toHaveLength(4);
    expect(first.hasMore).toBe(true);
    expect(second.notifications).toHaveLength(4);
    expect(second.notifications[0].id).not.toBe(first.notifications[0].id);
  });

  it('reads one demo row and rejects an unknown id', async () => {
    offline();

    await expect(notificationApi.getNotificationById('ntf-3')).resolves.toMatchObject({
      title: 'New customer',
      demo: true
    });

    const error = await notificationApi.getNotificationById('nope').catch((c: unknown) => c);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('persists read state in the demo directory', async () => {
    offline();

    await expect(notificationApi.getUnreadCount()).resolves.toBe(4);
    await expect(notificationApi.markAsRead('ntf-2')).resolves.toMatchObject({ read: true });
    await expect(notificationApi.getUnreadCount()).resolves.toBe(3);

    await expect(notificationApi.markAllAsRead()).resolves.toBe(3);
    await expect(notificationApi.getUnreadCount()).resolves.toBe(0);
  });

  it('deletes demo rows individually and in bulk', async () => {
    offline();

    await notificationApi.deleteNotification('ntf-9');
    await expect(notificationApi.getNotifications()).resolves.toMatchObject({ total: 10 });

    await notificationApi.deleteNotification('ntf-10');
    await expect(notificationApi.deleteReadNotifications()).resolves.toBe(5);
    await expect(notificationApi.getNotifications()).resolves.toMatchObject({ total: 4 });
  });

  it('surfaces a missing demo row as NOT_FOUND', async () => {
    offline();

    const error = await notificationApi.deleteNotification('ghost').catch((c: unknown) => c);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('keeps notification preferences in local storage', async () => {
    offline();

    await expect(notificationApi.getNotificationPreferences()).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );

    const saved = await notificationApi.updateNotificationPreferences({
      customer: false,
      browserPush: true
    });
    expect(saved).toMatchObject({ customer: false, browserPush: true, sound: true });
    expect(JSON.parse(localStorage.getItem('ks-demo-notification-prefs') ?? '{}')).toMatchObject({
      customer: false
    });
  });

  it('recovers from corrupted preference state', async () => {
    offline();
    localStorage.setItem('ks-demo-notification-prefs', '{not json');

    await expect(notificationApi.getNotificationPreferences()).resolves.toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });
});
