import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '../stores/notification';
import type { AppNotification } from '../types';

/**
 * Single-notification operations. Owns the click-through contract: a row is
 * marked read before the router navigates, so a back action never shows a stale
 * unread badge.
 */
export function useNotification() {
  const store = useNotificationStore();
  const router = useRouter();
  const pendingId = ref<string | null>(null);

  const loading = computed(() => pendingId.value !== null);
  const error = computed(() => store.error);

  async function markAsRead(notificationId: string): Promise<boolean> {
    pendingId.value = notificationId;
    try {
      return await store.markAsRead(notificationId);
    } finally {
      pendingId.value = null;
    }
  }

  async function deleteNotification(notificationId: string): Promise<boolean> {
    pendingId.value = notificationId;
    try {
      return await store.deleteNotification(notificationId);
    } finally {
      pendingId.value = null;
    }
  }

  /** Route a notification to its target page; informational rows stay put. */
  function resolveLink(notification: AppNotification): string | null {
    return notification.link ?? null;
  }

  async function handleNotificationClick(notification: AppNotification): Promise<string | null> {
    if (!notification.read) await markAsRead(notification.id);
    const link = resolveLink(notification);
    if (link) await router.push(link);
    return link;
  }

  return { loading, error, markAsRead, deleteNotification, handleNotificationClick, resolveLink };
}
