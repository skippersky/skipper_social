import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as notificationApi from '../api/notification';
import { ApiError } from '../api/http';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../api/demo';
import {
  DEFAULT_FILTERS,
  MAX_TOASTS,
  PAGE_LIMIT,
  TOAST_TTL_MS,
  UNREAD_POLL_MS,
  useNotificationStore
} from '../stores/notification';
import type { AppNotification, PagedNotifications } from '../types';

vi.mock('../api/notification', () => ({
  PAGE_LIMIT: 20,
  getNotifications: vi.fn(),
  getNotificationById: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  deleteReadNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn()
}));

const api = vi.mocked(notificationApi);

let seq = 0;

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  seq += 1;
  return {
    id: 'ntf-' + seq,
    type: 'message',
    title: 'Amani Juma',
    body: 'Ningependa kujua zaidi kuhusu vifuruki.',
    read: false,
    createdAt: 1700000000000 + seq,
    ...overrides
  };
}

function page(rows: AppNotification[], total = rows.length, hasMore = false): PagedNotifications {
  return { notifications: rows, total, hasMore };
}

/** Two unread plus one read row: the shape the centre loads on first paint. */
function seedStore() {
  const rows = [
    notification({ id: 'a' }),
    notification({ id: 'b', type: 'customer' }),
    notification({ id: 'c', type: 'system', read: true })
  ];
  api.getNotifications.mockResolvedValue(page(rows, 3, false));
  return rows;
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  localStorage.clear();
  api.updateNotificationPreferences.mockImplementation((patch) =>
    Promise.resolve({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...patch })
  );
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('notification store constants', () => {
  it('publishes the paging, toast and polling budget', () => {
    expect(PAGE_LIMIT).toBe(20);
    expect(MAX_TOASTS).toBe(3);
    expect(TOAST_TTL_MS).toBe(5000);
    expect(UNREAD_POLL_MS).toBe(60000);
    expect(DEFAULT_FILTERS).toEqual({ type: 'all', status: 'all' });
  });
});

describe('fetchNotifications', () => {
  it('maps the page and derives the unread badge', async () => {
    const store = useNotificationStore();
    seedStore();

    await store.fetchNotifications();

    expect(store.notifications.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(store.total).toBe(3);
    expect(store.hasMore).toBe(false);
    expect(store.unreadCount).toBe(2);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(api.getNotifications).toHaveBeenCalledWith({ limit: PAGE_LIMIT, offset: 0 });
  });

  it('forwards the active filters', async () => {
    const store = useNotificationStore();
    seedStore();
    store.setFilters({ type: 'customer', status: 'unread' });

    await store.fetchNotifications();

    expect(api.getNotifications).toHaveBeenCalledWith({
      limit: PAGE_LIMIT,
      offset: 0,
      type: 'customer',
      status: 'unread'
    });
  });

  it('maps a backend failure onto an i18n error key', async () => {
    const store = useNotificationStore();
    api.getNotifications.mockRejectedValue(new ApiError('HTTP_503', 'unavailable'));

    await store.fetchNotifications();

    expect(store.error).toBe('api.500');
    expect(store.loading).toBe(false);
    expect(store.notifications).toEqual([]);
  });

  it('maps an unknown failure onto the network error key', async () => {
    const store = useNotificationStore();
    api.getNotifications.mockRejectedValue(new Error('offline'));

    await store.fetchNotifications();

    expect(store.error).toBe('api.network');
  });
});

describe('loadMoreNotifications', () => {
  it('appends the next page, drops duplicates and advances the offset', async () => {
    const store = useNotificationStore();
    const first = [notification({ id: 'a' }), notification({ id: 'b' })];
    const second = [notification({ id: 'b' }), notification({ id: 'c' })];
    api.getNotifications
      .mockResolvedValueOnce(page(first, 4, true))
      .mockResolvedValueOnce(page(second, 4, true));

    await store.fetchNotifications();
    await store.loadMoreNotifications();

    expect(store.notifications.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(api.getNotifications).toHaveBeenLastCalledWith({ limit: PAGE_LIMIT, offset: 2 });
    expect(store.total).toBe(4);
    expect(store.hasMore).toBe(true);
  });

  it('does nothing once the last page has landed', async () => {
    const store = useNotificationStore();
    seedStore();

    await store.fetchNotifications();
    await store.loadMoreNotifications();

    expect(api.getNotifications).toHaveBeenCalledTimes(1);
  });

  it('reports a paging failure without losing the rows already loaded', async () => {
    const store = useNotificationStore();
    api.getNotifications
      .mockResolvedValueOnce(page([notification({ id: 'a' })], 5, true))
      .mockRejectedValueOnce(new ApiError('TIMEOUT', 'slow'));

    await store.fetchNotifications();
    await store.loadMoreNotifications();

    expect(store.error).toBe('api.timeout');
    expect(store.notifications.map((row) => row.id)).toEqual(['a']);
    expect(store.loading).toBe(false);
  });
});

describe('unread badge', () => {
  it('reads the count from the unread endpoint', async () => {
    const store = useNotificationStore();
    api.getUnreadCount.mockResolvedValue(7);

    await expect(store.fetchUnreadCount()).resolves.toBe(7);
    expect(store.unreadCount).toBe(7);
    expect(store.hasUnread).toBe(true);
  });

  it('keeps the previous count when the poll fails', async () => {
    const store = useNotificationStore();
    api.getUnreadCount.mockResolvedValueOnce(4).mockRejectedValueOnce(new Error('offline'));

    await store.fetchUnreadCount();
    await expect(store.fetchUnreadCount()).resolves.toBe(4);
    expect(store.error).toBe('api.network');
  });

  it('polls on the fallback interval and stops on demand', async () => {
    vi.useFakeTimers();
    const store = useNotificationStore();
    api.getUnreadCount.mockResolvedValue(2);

    store.startPolling();
    await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS);
    expect(api.getUnreadCount).toHaveBeenCalledTimes(1);

    store.stopPolling();
    await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS * 3);
    expect(api.getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('replaces an existing poll instead of stacking timers', async () => {
    vi.useFakeTimers();
    const store = useNotificationStore();
    api.getUnreadCount.mockResolvedValue(2);

    store.startPolling(1000);
    store.startPolling(1000);
    await vi.advanceTimersByTimeAsync(3000);

    expect(api.getUnreadCount).toHaveBeenCalledTimes(3);
    store.stopPolling();
    store.stopPolling();
  });
});

describe('read state', () => {
  it('marks one row read and decrements the badge', async () => {
    const store = useNotificationStore();
    const rows = seedStore();
    await store.fetchNotifications();
    api.markAsRead.mockResolvedValue({ ...rows[0], read: true });

    await expect(store.markAsRead('a')).resolves.toBe(true);

    expect(store.notifications[0].read).toBe(true);
    expect(store.unreadCount).toBe(1);
    expect(store.error).toBeNull();
  });

  it('reports a failure without touching the badge', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    api.markAsRead.mockRejectedValue(new ApiError('HTTP_403', 'nope'));

    await expect(store.markAsRead('a')).resolves.toBe(false);

    expect(store.error).toBe('api.403');
    expect(store.unreadCount).toBe(2);
  });

  it('marks everything read and clears the badge', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    api.markAllAsRead.mockResolvedValue(2);

    await expect(store.markAllAsRead()).resolves.toBe(true);

    expect(store.notifications.every((row) => row.read)).toBe(true);
    expect(store.unreadCount).toBe(0);
    expect(store.unreadNotifications).toEqual([]);
  });

  it('reports a bulk failure', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    api.markAllAsRead.mockRejectedValue(new Error('offline'));

    await expect(store.markAllAsRead()).resolves.toBe(false);
    expect(store.error).toBe('api.network');
    expect(store.unreadCount).toBe(2);
  });

  it('applies a read receipt pushed from another device', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();

    store.markReadFromSocket('a', true);
    expect(store.unreadCount).toBe(1);

    store.markReadFromSocket('a', false);
    expect(store.unreadCount).toBe(2);

    /* An unknown id and a no-op repeat must not move the badge. */
    store.markReadFromSocket('ghost', true);
    store.markReadFromSocket('a', false);
    expect(store.unreadCount).toBe(2);
  });
});

describe('deletion', () => {
  it('removes one row, its toast and its share of the counters', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    const live = notification({ id: 'live-1' });
    store.addRealtimeNotification(live);
    api.deleteNotification.mockResolvedValue(undefined);

    await expect(store.deleteNotification('live-1')).resolves.toBe(true);

    expect(store.notifications.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(store.toasts).toEqual([]);
    expect(store.total).toBe(3);
    expect(store.unreadCount).toBe(2);
  });

  it('reports a delete failure', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    api.deleteNotification.mockRejectedValue(new ApiError('HTTP_500', 'boom'));

    await expect(store.deleteNotification('a')).resolves.toBe(false);
    expect(store.error).toBe('api.500');
    expect(store.notifications).toHaveLength(3);
  });

  it('clears the read rows and stops paging', async () => {
    const store = useNotificationStore();
    api.getNotifications.mockResolvedValue(
      page([notification({ id: 'a' }), notification({ id: 'b', read: true })], 9, true)
    );
    await store.fetchNotifications();
    api.deleteReadNotifications.mockResolvedValue(1);

    await expect(store.deleteReadNotifications()).resolves.toBe(true);

    expect(store.notifications.map((row) => row.id)).toEqual(['a']);
    expect(store.total).toBe(8);
    expect(store.hasMore).toBe(false);
  });

  it('drops read toasts together with the rows', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    const live = notification({ id: 'live-read', read: true });
    store.addRealtimeNotification(live);
    store.toasts = [live];
    api.deleteReadNotifications.mockResolvedValue(1);

    await store.deleteReadNotifications();

    expect(store.toasts).toEqual([]);
  });

  it('reports a bulk delete failure', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    api.deleteReadNotifications.mockRejectedValue(new Error('offline'));

    await expect(store.deleteReadNotifications()).resolves.toBe(false);
    expect(store.error).toBe('api.network');
    expect(store.notifications).toHaveLength(3);
  });
});

describe('addRealtimeNotification', () => {
  it('is idempotent on id so a REST refresh cannot double count', () => {
    const store = useNotificationStore();
    const live = notification({ id: 'live-1' });

    expect(store.addRealtimeNotification(live)).toBe(true);
    expect(store.addRealtimeNotification(live)).toBe(false);
    expect(store.addRealtimeNotification({ ...live })).toBe(false);

    expect(store.notifications).toHaveLength(1);
    expect(store.unreadCount).toBe(1);
    expect(store.total).toBe(1);
    expect(store.toasts.map((row) => row.id)).toEqual(['live-1']);
  });

  it('ignores a malformed frame', () => {
    const store = useNotificationStore();

    expect(store.addRealtimeNotification(undefined as unknown as AppNotification)).toBe(false);
    expect(store.addRealtimeNotification({ id: 12 } as unknown as AppNotification)).toBe(false);
    expect(store.notifications).toEqual([]);
    expect(store.toasts).toEqual([]);
  });

  it('records a read frame without raising a toast', () => {
    const store = useNotificationStore();

    expect(store.addRealtimeNotification(notification({ id: 'r', read: true }))).toBe(true);
    expect(store.toasts).toEqual([]);
    expect(store.unreadCount).toBe(0);
    expect(store.notifications).toHaveLength(1);
  });

  it('caps the toast queue and drops the oldest', () => {
    const store = useNotificationStore();

    for (const id of ['t1', 't2', 't3', 't4']) {
      store.addRealtimeNotification(notification({ id }));
    }

    expect(store.toasts).toHaveLength(MAX_TOASTS);
    expect(store.toasts.map((row) => row.id)).toEqual(['t2', 't3', 't4']);
    expect(store.notifications).toHaveLength(4);
  });

  it('re-raises an existing toast to the top instead of duplicating it', () => {
    const store = useNotificationStore();
    store.addRealtimeNotification(notification({ id: 't1' }));
    store.addRealtimeNotification(notification({ id: 't2' }));
    store.notifications = [];

    store.addRealtimeNotification(notification({ id: 't1' }));

    expect(store.toasts.map((row) => row.id)).toEqual(['t2', 't1']);
  });

  it('stays silent for a category the user switched off', async () => {
    const store = useNotificationStore();
    await store.updatePreferences({ system: false });

    expect(store.addRealtimeNotification(notification({ id: 's', type: 'system' }))).toBe(true);
    expect(store.toasts).toEqual([]);
    expect(store.notifications).toHaveLength(1);
  });

  it('dismisses one toast or the whole queue', () => {
    const store = useNotificationStore();
    store.addRealtimeNotification(notification({ id: 't1' }));
    store.addRealtimeNotification(notification({ id: 't2' }));

    store.dismissToast('t1');
    expect(store.toasts.map((row) => row.id)).toEqual(['t2']);

    store.clearToasts();
    expect(store.toasts).toEqual([]);
    /* Clearing toasts never touches the stored rows. */
    expect(store.notifications).toHaveLength(2);
  });
});

describe('notification store getters', () => {
  it('groups rows by type and tolerates an unknown category', async () => {
    const store = useNotificationStore();
    seedStore();
    await store.fetchNotifications();
    const ghost = { ...notification({ id: 'ghost' }), type: 'ghost' } as unknown as AppNotification;
    store.notifications = [...store.notifications, ghost];

    const grouped = store.notificationsByType;
    expect(grouped.message.map((row) => row.id)).toEqual(['a']);
    expect(grouped.customer.map((row) => row.id)).toEqual(['b']);
    expect(grouped.system.map((row) => row.id)).toEqual(['c']);
    expect(grouped.conversation).toEqual([]);
  });

  it('flags sample data for the disclosure bar', async () => {
    const store = useNotificationStore();
    expect(store.hasDemoData).toBe(false);

    api.getNotifications.mockResolvedValue(page([notification({ id: 'd', demo: true })]));
    await store.fetchNotifications();

    expect(store.hasDemoData).toBe(true);
    expect(store.unreadNotifications.map((row) => row.id)).toEqual(['d']);
  });
});

describe('preferences', () => {
  it('starts from the shared defaults', () => {
    const store = useNotificationStore();
    expect(store.preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('loads and saves the delivery switches', async () => {
    const store = useNotificationStore();
    api.getNotificationPreferences.mockResolvedValue({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      customer: false
    });

    await store.fetchPreferences();
    expect(store.preferences.customer).toBe(false);

    /* The server echoes the authoritative copy, so the store adopts it whole. */
    api.updateNotificationPreferences.mockResolvedValue({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      customer: false,
      sound: false
    });
    await expect(store.updatePreferences({ sound: false })).resolves.toBe(true);
    expect(store.preferences).toMatchObject({ customer: false, sound: false });
    expect(api.updateNotificationPreferences).toHaveBeenCalledWith({ sound: false });
  });

  it('reports a load failure and keeps the current switches', async () => {
    const store = useNotificationStore();
    api.getNotificationPreferences.mockRejectedValue(new ApiError('HTTP_401', 'no'));

    await expect(store.fetchPreferences()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(store.error).toBe('api.401');
  });

  it('reports a save failure', async () => {
    const store = useNotificationStore();
    api.updateNotificationPreferences.mockRejectedValue(new Error('offline'));

    await expect(store.updatePreferences({ sound: false })).resolves.toBe(false);
    expect(store.error).toBe('api.network');
    expect(store.preferences.sound).toBe(true);
  });
});

describe('filters and connection status', () => {
  it('merges a filter patch and resets to the defaults', () => {
    const store = useNotificationStore();

    store.setFilters({ type: 'system' });
    expect(store.filters).toEqual({ type: 'system', status: 'all' });

    store.setFilters({ status: 'unread' });
    expect(store.filters).toEqual({ type: 'system', status: 'unread' });

    store.resetFilters();
    expect(store.filters).toEqual(DEFAULT_FILTERS);
    /* The shared default object must never be mutated by a store instance. */
    expect(DEFAULT_FILTERS).toEqual({ type: 'all', status: 'all' });
  });

  it('tracks the live connection state', () => {
    const store = useNotificationStore();
    expect(store.connectionStatus).toBe('disconnected');

    store.setConnectionStatus('connecting');
    store.setConnectionStatus('connected');
    expect(store.connectionStatus).toBe('connected');

    store.setConnectionStatus('error');
    expect(store.connectionStatus).toBe('error');
  });
});
