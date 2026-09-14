import { computed } from 'vue';
import { useNotificationStore } from '../stores/notification';
import type { NotificationFilters } from '../types';

/** List concerns only: filtering, paging and the bulk actions. */
export function useNotificationList() {
  const store = useNotificationStore();

  const notifications = computed(() => store.notifications);
  const loading = computed(() => store.loading);
  const hasMore = computed(() => store.hasMore);
  const total = computed(() => store.total);
  const unreadCount = computed(() => store.unreadCount);
  const filters = computed(() => store.filters);
  const error = computed(() => store.error);
  const hasDemoData = computed(() => store.hasDemoData);

  async function applyFilters(patch: Partial<NotificationFilters>): Promise<void> {
    store.setFilters(patch);
    await store.fetchNotifications();
  }

  async function loadNotifications(): Promise<void> {
    await store.fetchNotifications();
  }

  async function filterByType(type: NotificationFilters['type']): Promise<void> {
    await applyFilters({ type });
  }

  async function filterByReadStatus(status: NotificationFilters['status']): Promise<void> {
    await applyFilters({ status });
  }

  async function loadMore(): Promise<void> {
    await store.loadMoreNotifications();
  }

  async function markAllAsRead(): Promise<boolean> {
    return store.markAllAsRead();
  }

  async function deleteReadNotifications(): Promise<boolean> {
    return store.deleteReadNotifications();
  }

  async function refresh(): Promise<void> {
    await store.fetchNotifications();
    await store.fetchUnreadCount();
  }

  return {
    notifications,
    loading,
    hasMore,
    total,
    unreadCount,
    filters,
    error,
    hasDemoData,
    loadNotifications,
    filterByType,
    filterByReadStatus,
    loadMore,
    markAllAsRead,
    deleteReadNotifications,
    refresh
  };
}
