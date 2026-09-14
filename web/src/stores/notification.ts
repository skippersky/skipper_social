import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as notificationApi from '../api/notification';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../api/demo';
import { apiErrorI18nKey } from '../api/http';
import type {
  AppNotification,
  NotificationConnectionStatus,
  NotificationFilters,
  NotificationPreferences,
  NotificationType
} from '../types';

export const DEFAULT_FILTERS: NotificationFilters = { type: 'all', status: 'all' };
export const PAGE_LIMIT = 20;
/** Simultaneous toast ceiling; the oldest is dropped when a fourth arrives. */
export const MAX_TOASTS = 3;
/** On-screen lifetime of a realtime toast before it dismisses itself. */
export const TOAST_TTL_MS = 5_000;
/** Unread badge refresh used when the socket is down. */
export const UNREAD_POLL_MS = 60_000;

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<AppNotification[]>([]);
  const unreadCount = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<NotificationFilters>({ ...DEFAULT_FILTERS });
  const total = ref(0);
  const hasMore = ref(false);
  const offset = ref(0);
  const connectionStatus = ref<NotificationConnectionStatus>('disconnected');
  const preferences = ref<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const toasts = ref<AppNotification[]>([]);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const unreadNotifications = computed(() =>
    notifications.value.filter((notification) => !notification.read)
  );

  const hasUnread = computed(() => unreadCount.value > 0);

  const notificationsByType = computed(() => {
    const grouped: Record<NotificationType, AppNotification[]> = {
      message: [],
      conversation: [],
      customer: [],
      system: []
    };
    for (const notification of notifications.value) {
      grouped[notification.type]?.push(notification);
    }
    return grouped;
  });

  /** Sample-data disclosure, mirroring the inbox and customer directory. */
  const hasDemoData = computed(() =>
    notifications.value.some((notification) => notification.demo === true)
  );

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function listParams(nextOffset = 0): notificationApi.NotificationListParams {
    const params: notificationApi.NotificationListParams = { limit: PAGE_LIMIT, offset: nextOffset };
    if (filters.value.type !== 'all') params.type = filters.value.type;
    if (filters.value.status !== 'all') params.status = filters.value.status;
    return params;
  }

  async function fetchNotifications(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await notificationApi.getNotifications(listParams());
      notifications.value = page.notifications;
      total.value = page.total;
      hasMore.value = page.hasMore;
      offset.value = page.notifications.length;
      unreadCount.value = page.notifications.filter((item) => !item.read).length;
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreNotifications(): Promise<void> {
    if (!hasMore.value || loading.value) return;
    loading.value = true;
    try {
      const page = await notificationApi.getNotifications(listParams(offset.value));
      const known = new Set(notifications.value.map((item) => item.id));
      notifications.value = [
        ...notifications.value,
        ...page.notifications.filter((item) => !known.has(item.id))
      ];
      total.value = page.total;
      hasMore.value = page.hasMore;
      offset.value += page.notifications.length;
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchUnreadCount(): Promise<number> {
    try {
      unreadCount.value = await notificationApi.getUnreadCount();
    } catch (err) {
      fail(err);
    }
    return unreadCount.value;
  }

  async function markAsRead(id: string): Promise<boolean> {
    error.value = null;
    try {
      const saved = await notificationApi.markAsRead(id);
      applyReadState(id, true);
      return saved.read;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function markAllAsRead(): Promise<boolean> {
    error.value = null;
    try {
      await notificationApi.markAllAsRead();
      notifications.value = notifications.value.map((item) => ({ ...item, read: true }));
      unreadCount.value = 0;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function deleteNotification(id: string): Promise<boolean> {
    error.value = null;
    try {
      const target = notifications.value.find((item) => item.id === id);
      await notificationApi.deleteNotification(id);
      notifications.value = notifications.value.filter((item) => item.id !== id);
      toasts.value = toasts.value.filter((item) => item.id !== id);
      total.value = Math.max(0, total.value - 1);
      offset.value = Math.max(0, offset.value - 1);
      if (target && !target.read) unreadCount.value = Math.max(0, unreadCount.value - 1);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function deleteReadNotifications(): Promise<boolean> {
    error.value = null;
    try {
      await notificationApi.deleteReadNotifications();
      const removed = notifications.value.filter((item) => item.read).length;
      notifications.value = notifications.value.filter((item) => !item.read);
      toasts.value = toasts.value.filter((item) => !item.read);
      total.value = Math.max(0, total.value - removed);
      offset.value = notifications.value.length;
      hasMore.value = false;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  /**
   * Inserts a frame pushed over the socket. Idempotent on id so a REST refresh
   * racing a live push cannot duplicate the row or double count the badge.
   */
  function addRealtimeNotification(notification: AppNotification): boolean {
    if (!notification || typeof notification.id !== 'string') return false;
    if (notifications.value.some((item) => item.id === notification.id)) return false;
    notifications.value = [notification, ...notifications.value];
    total.value += 1;
    offset.value += 1;
    if (!notification.read) {
      unreadCount.value += 1;
      enqueueToast(notification);
    }
    return true;
  }

  function applyReadState(id: string, read: boolean): void {
    const target = notifications.value.find((item) => item.id === id);
    if (!target || target.read === read) return;
    notifications.value = notifications.value.map((item) =>
      item.id === id ? { ...item, read } : item
    );
    unreadCount.value = Math.max(0, unreadCount.value + (read ? -1 : 1));
  }

  /** Read receipt pushed from another tab or device. */
  function markReadFromSocket(id: string, read: boolean): void {
    applyReadState(id, read);
  }

  function enqueueToast(notification: AppNotification): void {
    if (!preferences.value[notification.type]) return;
    const next = [...toasts.value.filter((item) => item.id !== notification.id), notification];
    toasts.value = next.slice(Math.max(0, next.length - MAX_TOASTS));
  }

  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }

  function clearToasts(): void {
    toasts.value = [];
  }

  async function fetchPreferences(): Promise<NotificationPreferences> {
    try {
      preferences.value = await notificationApi.getNotificationPreferences();
    } catch (err) {
      fail(err);
    }
    return preferences.value;
  }

  async function updatePreferences(patch: Partial<NotificationPreferences>): Promise<boolean> {
    error.value = null;
    try {
      preferences.value = await notificationApi.updateNotificationPreferences(patch);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  function setFilters(patch: Partial<NotificationFilters>): void {
    filters.value = { ...filters.value, ...patch };
  }

  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS };
  }

  function setConnectionStatus(status: NotificationConnectionStatus): void {
    connectionStatus.value = status;
  }

  /** Badge refresh that keeps working while the socket is down. */
  function startPolling(intervalMs = UNREAD_POLL_MS): void {
    stopPolling();
    pollTimer = setInterval(() => {
      void fetchUnreadCount();
    }, intervalMs);
  }

  function stopPolling(): void {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    total,
    hasMore,
    connectionStatus,
    preferences,
    toasts,
    unreadNotifications,
    notificationsByType,
    hasUnread,
    hasDemoData,
    fetchNotifications,
    loadMoreNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteReadNotifications,
    addRealtimeNotification,
    markReadFromSocket,
    dismissToast,
    clearToasts,
    fetchPreferences,
    updatePreferences,
    setFilters,
    resetFilters,
    setConnectionStatus,
    startPolling,
    stopPolling
  };
});
