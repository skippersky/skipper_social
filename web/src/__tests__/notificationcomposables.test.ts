import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import { defineComponent, nextTick } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import {
  deleteNotification as deleteNotificationApi,
  deleteReadNotifications as deleteReadApi,
  getNotifications,
  getUnreadCount,
  markAllAsRead as markAllReadApi,
  markAsRead as markAsReadApi
} from '../api/notification';
import { useNotification } from '../composables/useNotification';
import { useNotificationList } from '../composables/useNotificationList';
import { useNotificationSocket } from '../composables/useNotificationSocket';
import { resetWebSocketForTests, useWebSocket } from '../composables/useWebSocket';
import { SOCKET_NOTIFICATION, SOCKET_NOTIFICATION_READ, socketBus } from '../events/socket';
import { useNotificationStore } from '../stores/notification';
import { MAX_NOTIFICATION_RETRIES } from '../websocket/notificationWs';
import type { AppNotification, NotificationPreferences } from '../types';

/* The api layer is stubbed so the real store drives every composable. */
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

const PREFS: NotificationPreferences = {
  message: true,
  conversation: true,
  customer: true,
  system: true,
  browserPush: false,
  sound: true
};

function row(id: string, extra: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: 'message',
    title: 'Title ' + id,
    body: 'Body ' + id,
    read: false,
    createdAt: 1700000000000,
    ...extra
  };
}

/** Transport double: records opens and closes without touching the network. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static closeCalls = 0;
  readonly url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    FakeWebSocket.closeCalls += 1;
    this.readyState = 3;
    this.onclose?.();
  }
}

const stub = { template: '<div />' };
const liveWrappers: VueWrapper[] = [];
let pinia: Pinia;
let router: Router;

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/dashboard/notifications', component: stub },
      { path: '/dashboard/conversations', component: stub },
      { path: '/dashboard/channels', component: stub }
    ]
  });
}

/** Runs a composable inside a real component scope so onScopeDispose fires. */
async function withSetup<T>(composable: () => T) {
  let result!: T;
  const host = defineComponent({
    setup() {
      result = composable();
      return () => null;
    }
  });
  const wrapper = mount(host, { global: { plugins: [pinia, router] } });
  liveWrappers.push(wrapper);
  await flushPromises();
  return { result, wrapper };
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  resetWebSocketForTests();
  socketBus.clear();
  FakeWebSocket.instances = [];
  FakeWebSocket.closeCalls = 0;
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  pinia = createPinia();
  router = buildRouter();
  await router.push('/');
  await router.isReady();
  vi.mocked(getNotifications).mockResolvedValue({ notifications: [], hasMore: false, total: 0 });
  vi.mocked(getUnreadCount).mockResolvedValue(0);
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  resetWebSocketForTests();
  socketBus.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('useNotification', () => {
  it('resolves the click-through target and stays put for informational rows', async () => {
    const { result } = await withSetup(() => useNotification());

    expect(result.resolveLink(row('a', { link: '/dashboard/channels' }))).toBe(
      '/dashboard/channels'
    );
    expect(result.resolveLink(row('b'))).toBeNull();
  });

  it('marks an unread row read before navigating to its link', async () => {
    vi.mocked(markAsReadApi).mockResolvedValue(row('n1', { read: true }));
    const { result } = await withSetup(() => useNotification());

    const link = await result.handleNotificationClick(
      row('n1', { link: '/dashboard/channels' })
    );

    expect(link).toBe('/dashboard/channels');
    expect(markAsReadApi).toHaveBeenCalledWith('n1');
    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
    expect(result.loading.value).toBe(false);
  });

  it('skips the read call for an already read row without a link', async () => {
    const { result } = await withSetup(() => useNotification());

    const link = await result.handleNotificationClick(row('n2', { read: true }));

    expect(link).toBeNull();
    expect(markAsReadApi).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('flags loading only while a row request is in flight', async () => {
    let release: (value: AppNotification) => void = () => undefined;
    vi.mocked(markAsReadApi).mockImplementation(
      () => new Promise<AppNotification>((resolve) => (release = resolve))
    );
    const { result } = await withSetup(() => useNotification());

    const pending = result.markAsRead('n3');
    await nextTick();
    expect(result.loading.value).toBe(true);

    release(row('n3', { read: true }));
    expect(await pending).toBe(true);
    expect(result.loading.value).toBe(false);
  });

  it('deletes through the store and reports the outcome', async () => {
    vi.mocked(deleteNotificationApi).mockResolvedValue(undefined);
    const { result } = await withSetup(() => useNotification());

    expect(await result.deleteNotification('n4')).toBe(true);
    expect(deleteNotificationApi).toHaveBeenCalledWith('n4');
  });

  it('surfaces a mapped api error key when the delete fails', async () => {
    vi.mocked(deleteNotificationApi).mockRejectedValue(new Error('boom'));
    const { result } = await withSetup(() => useNotification());

    expect(await result.deleteNotification('n5')).toBe(false);
    expect(result.error.value).toBe('api.network');
    expect(result.loading.value).toBe(false);
  });
});

describe('useNotificationList', () => {
  it('refreshes the page and the unread badge together', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [row('a'), row('b', { read: true })],
      hasMore: true,
      total: 12
    });
    vi.mocked(getUnreadCount).mockResolvedValue(7);
    const { result } = await withSetup(() => useNotificationList());

    await result.refresh();

    expect(result.notifications.value.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.total.value).toBe(12);
    expect(result.hasMore.value).toBe(true);
    expect(result.unreadCount.value).toBe(7);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('records a type filter and refetches with it', async () => {
    const { result } = await withSetup(() => useNotificationList());

    await result.filterByType('system');

    expect(result.filters.value).toEqual({ type: 'system', status: 'all' });
    expect(getNotifications).toHaveBeenLastCalledWith({ limit: 20, offset: 0, type: 'system' });
  });

  it('records a read-status filter and refetches with it', async () => {
    const { result } = await withSetup(() => useNotificationList());

    await result.filterByReadStatus('unread');

    expect(result.filters.value).toEqual({ type: 'all', status: 'unread' });
    expect(getNotifications).toHaveBeenLastCalledWith({ limit: 20, offset: 0, status: 'unread' });
  });

  it('appends the next page without duplicating ids', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce({ notifications: [row('a'), row('b')], hasMore: true, total: 4 })
      .mockResolvedValueOnce({ notifications: [row('b'), row('c')], hasMore: false, total: 4 });
    const { result } = await withSetup(() => useNotificationList());

    await result.loadNotifications();
    await result.loadMore();

    expect(result.notifications.value.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(result.hasMore.value).toBe(false);
    expect(getNotifications).toHaveBeenLastCalledWith({ limit: 20, offset: 2 });
  });

  it('skips the extra page request when nothing is left', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [row('a')],
      hasMore: false,
      total: 1
    });
    const { result } = await withSetup(() => useNotificationList());

    await result.loadNotifications();
    await result.loadMore();

    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it('runs the bulk read and clear actions', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [row('a'), row('b', { read: true })],
      hasMore: false,
      total: 2
    });
    vi.mocked(markAllReadApi).mockResolvedValue(2);
    vi.mocked(deleteReadApi).mockResolvedValue(1);
    const { result } = await withSetup(() => useNotificationList());
    await result.loadNotifications();

    expect(await result.markAllAsRead()).toBe(true);
    expect(result.notifications.value.every((item) => item.read)).toBe(true);
    expect(result.unreadCount.value).toBe(0);

    expect(await result.deleteReadNotifications()).toBe(true);
    expect(result.notifications.value).toHaveLength(0);
  });

  it('exposes the sample-data disclosure flag', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [row('d', { demo: true })],
      hasMore: false,
      total: 1
    });
    const { result } = await withSetup(() => useNotificationList());

    expect(result.hasDemoData.value).toBe(false);
    await result.loadNotifications();
    expect(result.hasDemoData.value).toBe(true);
    expect(result.loading.value).toBe(false);
  });
});

describe('useNotificationSocket', () => {
  it('starts detached and reports connecting once attached', async () => {
    const store = useNotificationStore(pinia);
    const { result } = await withSetup(() => useNotificationSocket());

    expect(result.connectionStatus.value).toBe('disconnected');

    result.connect();
    await nextTick();

    expect(result.connectionStatus.value).toBe('connecting');
    expect(result.socket.status).toBe('connecting');
    expect(store.connectionStatus).toBe('connecting');
    expect(FakeWebSocket.instances).toHaveLength(1);
    result.disconnect();
  });

  it('reuses the single app socket instead of opening a second one', async () => {
    const { result } = await withSetup(() => useNotificationSocket());
    const shared = useWebSocket();

    shared.connect();
    result.connect();
    await nextTick();
    result.disconnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.closeCalls).toBe(0);
    shared.disconnect();
  });

  it('pushes a live frame into the store, the toast queue and the realtime ref', async () => {
    const store = useNotificationStore(pinia);
    const { result } = await withSetup(() => useNotificationSocket());
    result.connect();
    await nextTick();

    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('live-1') });
    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('live-1') });

    expect(result.realtimeNotification.value?.id).toBe('live-1');
    expect(store.notifications.map((item) => item.id)).toEqual(['live-1']);
    expect(store.toasts.map((item) => item.id)).toEqual(['live-1']);
    expect(store.unreadCount).toBe(1);
    result.disconnect();
  });

  it('applies a read receipt from another device without moving the badge below zero', async () => {
    const store = useNotificationStore(pinia);
    const { result } = await withSetup(() => useNotificationSocket());
    result.connect();
    await nextTick();

    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('live-2') });
    socketBus.emit({ type: SOCKET_NOTIFICATION_READ, notificationId: 'live-2', read: true });
    socketBus.emit({ type: SOCKET_NOTIFICATION_READ, notificationId: 'live-2', read: true });

    expect(store.notifications[0]?.read).toBe(true);
    expect(store.unreadCount).toBe(0);
    result.disconnect();
  });

  it('goes live and resyncs the badge when the transport recovers', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(3);
    const store = useNotificationStore(pinia);
    const { result } = await withSetup(() => useNotificationSocket());
    const shared = useWebSocket();
    result.connect();
    await nextTick();

    shared.status.value = 'connected';
    await nextTick();
    await flushPromises();

    expect(result.connectionStatus.value).toBe('connected');
    expect(store.connectionStatus).toBe('connected');
    expect(store.unreadCount).toBe(3);
    result.disconnect();
  });

  it('gives up on the live feed after the retry ceiling', async () => {
    const store = useNotificationStore(pinia);
    const { result } = await withSetup(() => useNotificationSocket());
    result.connect();
    await nextTick();

    for (let attempt = 0; attempt < MAX_NOTIFICATION_RETRIES; attempt += 1) {
      result.socket.handleTransportStatus('reconnecting');
    }

    expect(result.connectionStatus.value).toBe('error');
    expect(store.connectionStatus).toBe('error');
    result.disconnect();
  });

  it('polls the unread badge while attached and stops on detach', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(2);
    const { result } = await withSetup(() => useNotificationSocket());

    /* Timers go fake before connect so the poll interval is the fake one. */
    vi.useFakeTimers();
    result.connect();
    await nextTick();
    vi.advanceTimersByTime(60000);
    await nextTick();

    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    result.disconnect();
    vi.advanceTimersByTime(120000);
    await nextTick();
    vi.useRealTimers();
    await flushPromises();

    expect(getUnreadCount).toHaveBeenCalledTimes(1);
    expect(result.connectionStatus.value).toBe('disconnected');
  });

  it('detaches the feed when the owning scope is disposed', async () => {
    const store = useNotificationStore(pinia);
    const { result, wrapper } = await withSetup(() => useNotificationSocket());
    result.connect();
    await nextTick();

    wrapper.unmount();
    await nextTick();

    expect(result.connectionStatus.value).toBe('disconnected');
    expect(store.connectionStatus).toBe('disconnected');
    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('after') });
    expect(store.notifications).toHaveLength(0);
  });
});
