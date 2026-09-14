import { onScopeDispose, ref, watch } from 'vue';
import { NotificationSocket } from '../websocket/notificationWs';
import { useWebSocket } from './useWebSocket';
import { useNotificationStore } from '../stores/notification';
import type { AppNotification, NotificationConnectionStatus } from '../types';

/**
 * Live notification feed. The transport is the shared Sprint 6 socket, so this
 * composable only wires status mapping, store fan-out and teardown.
 */
export function useNotificationSocket() {
  const store = useNotificationStore();
  const shared = useWebSocket();
  const realtimeNotification = ref<AppNotification | null>(null);
  const connectionStatus = ref<NotificationConnectionStatus>('disconnected');

  const socket = new NotificationSocket({
    connect: () => shared.connect(),
    watchStatus: (handler) => {
      const stop = watch(() => shared.status.value, handler, { immediate: true });
      return () => stop();
    }
  });

  socket.onMessage((notification) => {
    realtimeNotification.value = notification;
    store.addRealtimeNotification(notification);
  });

  socket.onRead((id, read) => {
    store.markReadFromSocket(id, read);
  });

  socket.onConnect(() => {
    connectionStatus.value = 'connected';
    store.setConnectionStatus('connected');
    /* A gap in the feed can hide rows, so resync the badge on recovery. */
    void store.fetchUnreadCount();
  });

  socket.onDisconnect(() => {
    connectionStatus.value = 'disconnected';
    store.setConnectionStatus('disconnected');
  });

  socket.onError(() => {
    connectionStatus.value = 'error';
    store.setConnectionStatus('error');
  });

  function reportStatus(status: NotificationConnectionStatus): void {
    connectionStatus.value = status;
    store.setConnectionStatus(status);
  }

  function connect(): void {
    socket.connect();
    reportStatus(socket.status);
    store.startPolling();
  }

  function disconnect(): void {
    socket.disconnect();
    reportStatus(socket.status);
    store.stopPolling();
  }

  onScopeDispose(() => {
    socket.disconnect();
    store.stopPolling();
  });

  return { connectionStatus, realtimeNotification, connect, disconnect, socket };
}
