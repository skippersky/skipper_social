import { apiDelete, apiGet, apiPut } from './http';
import {
  demoDeleteNotification,
  demoDeleteReadNotifications,
  demoMarkAllNotificationsRead,
  demoMarkNotificationRead,
  demoNotificationById,
  demoNotificationPreferences,
  demoNotifications,
  demoUnreadNotificationCount,
  demoUpdateNotificationPreferences,
  isMissingBackend
} from './demo';
import type {
  AppNotification,
  NotificationFilters,
  NotificationPreferences,
  PagedNotifications
} from '../types';

const NOTIFICATIONS = '/api/v1/notifications';
export const PAGE_LIMIT = 20;

export interface NotificationListParams {
  type?: NotificationFilters['type'];
  status?: NotificationFilters['status'];
  limit?: number;
  offset?: number;
}

function toQuery(params?: NotificationListParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.type && params.type !== 'all') search.set('type', params.type);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));
  const text = search.toString();
  return text ? '?' + text : '';
}

export async function getNotifications(
  params?: NotificationListParams
): Promise<PagedNotifications> {
  try {
    return await apiGet<PagedNotifications>(NOTIFICATIONS + toQuery(params));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNotifications(params);
  }
}

export async function getNotificationById(id: string): Promise<AppNotification> {
  try {
    return await apiGet<AppNotification>(NOTIFICATIONS + '/' + encodeURIComponent(id));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNotificationById(id);
  }
}

export async function markAsRead(id: string): Promise<AppNotification> {
  try {
    return await apiPut<AppNotification>(
      NOTIFICATIONS + '/' + encodeURIComponent(id) + '/read',
      {}
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMarkNotificationRead(id);
  }
}

/** Resolves to the number of rows the backend flipped to read. */
export async function markAllAsRead(): Promise<number> {
  try {
    const result = await apiPut<{ updated: number }>(NOTIFICATIONS + '/read-all', {});
    return result?.updated ?? 0;
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMarkAllNotificationsRead();
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    await apiDelete<void>(NOTIFICATIONS + '/' + encodeURIComponent(id));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDeleteNotification(id);
  }
}

/** Resolves to the number of read rows removed. */
export async function deleteReadNotifications(): Promise<number> {
  try {
    const result = await apiDelete<{ deleted: number }>(NOTIFICATIONS + '/read');
    return result?.deleted ?? 0;
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoDeleteReadNotifications();
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const result = await apiGet<{ count: number }>(NOTIFICATIONS + '/unread-count');
    return result?.count ?? 0;
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUnreadNotificationCount();
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    return await apiGet<NotificationPreferences>(NOTIFICATIONS + '/preferences');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNotificationPreferences();
  }
}

export async function updateNotificationPreferences(
  data: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  try {
    return await apiPut<NotificationPreferences>(NOTIFICATIONS + '/preferences', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateNotificationPreferences(data);
  }
}
