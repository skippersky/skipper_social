import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEDUPE_CAPACITY,
  MAX_NOTIFICATION_RETRIES,
  NotificationSocket
} from '../websocket/notificationWs';
import {
  SOCKET_NEW_MESSAGE,
  SOCKET_NOTIFICATION,
  SOCKET_NOTIFICATION_READ,
  socketBus
} from '../events/socket';
import type { WebSocketStatus } from '../composables/useWebSocket';
import type { AppNotification, Message } from '../types';

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

/** Injected transport so the suite never opens a real WebSocket. */
function buildSocket() {
  const connect = vi.fn();
  const statuses: Array<(status: WebSocketStatus) => void> = [];
  const watchStatus = vi.fn((handler: (status: WebSocketStatus) => void) => {
    statuses.push(handler);
    return () => {
      const index = statuses.indexOf(handler);
      if (index >= 0) statuses.splice(index, 1);
    };
  });
  const socket = new NotificationSocket({ connect, watchStatus });
  return { socket, connect, watchStatus, statuses };
}

afterEach(() => {
  socketBus.clear();
});

describe('NotificationSocket transport', () => {
  it('attaches to the shared bus and opens the transport exactly once', () => {
    const { socket, connect, watchStatus } = buildSocket();

    socket.connect();
    socket.connect();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(watchStatus).toHaveBeenCalledTimes(1);
    expect(socket.status).toBe('connecting');
  });

  it('delivers notification frames and ignores inbox frames', () => {
    const { socket } = buildSocket();
    const seen: AppNotification[] = [];
    socket.onMessage((notification) => seen.push(notification));
    socket.connect();

    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('n1') });
    socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: { id: 'm1' } as unknown as Message });

    expect(seen.map((item) => item.id)).toEqual(['n1']);
  });

  it('drops a repeated id and a malformed frame', () => {
    const { socket } = buildSocket();
    const seen: string[] = [];
    socket.onMessage((notification) => seen.push(notification.id));
    socket.connect();

    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('dup') });
    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('dup') });
    socketBus.emit({
      type: SOCKET_NOTIFICATION,
      notification: undefined as unknown as AppNotification
    });
    socketBus.emit({
      type: SOCKET_NOTIFICATION,
      notification: { ...row('bad'), id: 7 } as unknown as AppNotification
    });

    expect(seen).toEqual(['dup']);
    expect(socket.trackedIds).toBe(1);
  });

  it('forwards read receipts pushed from another device', () => {
    const { socket } = buildSocket();
    const reads: Array<[string, boolean]> = [];
    socket.onRead((id, read) => reads.push([id, read]));
    socket.connect();

    socketBus.emit({ type: SOCKET_NOTIFICATION_READ, notificationId: 'n9', read: true });
    socketBus.emit({ type: SOCKET_NOTIFICATION_READ, notificationId: 'n9', read: false });

    expect(reads).toEqual([
      ['n9', true],
      ['n9', false]
    ]);
  });

  it('stops delivering once a handler unsubscribes', () => {
    const { socket } = buildSocket();
    const seen: string[] = [];
    const off = socket.onMessage((notification) => seen.push(notification.id));
    socket.connect();

    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('a') });
    off();
    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('b') });

    expect(seen).toEqual(['a']);
  });

  it('detaches on disconnect without closing the shared transport', () => {
    const { socket, connect, statuses } = buildSocket();
    const seen: string[] = [];
    const dropped: number[] = [];
    socket.onMessage((notification) => seen.push(notification.id));
    socket.onDisconnect(() => dropped.push(1));
    socket.connect();

    socket.disconnect();
    socketBus.emit({ type: SOCKET_NOTIFICATION, notification: row('late') });

    expect(seen).toEqual([]);
    expect(dropped).toHaveLength(1);
    expect(socket.status).toBe('disconnected');
    expect(statuses).toHaveLength(0);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationSocket dedupe ring', () => {
  it('records an id once and reports the repeat', () => {
    const { socket } = buildSocket();

    expect(socket.isDuplicate('x')).toBe(false);
    expect(socket.isDuplicate('x')).toBe(true);
    expect(socket.trackedIds).toBe(1);
  });

  it('evicts the oldest ids once the ring is full', () => {
    const { socket } = buildSocket();
    const total = DEDUPE_CAPACITY + 40;

    for (let index = 0; index < total; index += 1) socket.isDuplicate('id-' + index);

    expect(socket.trackedIds).toBe(DEDUPE_CAPACITY);
    expect(socket.isDuplicate('id-0')).toBe(false);
    expect(socket.isDuplicate('id-' + (total - 1))).toBe(true);
  });

  it('reset clears the ring and the retry budget', () => {
    const { socket } = buildSocket();
    socket.isDuplicate('keep');
    socket.handleTransportStatus('reconnecting');

    socket.reset();

    expect(socket.trackedIds).toBe(0);
    expect(socket.isDuplicate('keep')).toBe(false);
    socket.handleTransportStatus('reconnecting');
    expect(socket.status).toBe('connecting');
  });
});

describe('NotificationSocket status mapping', () => {
  it('goes live on a connected transport and fires the connect handlers', () => {
    const { socket } = buildSocket();
    const connected: number[] = [];
    socket.onConnect(() => connected.push(1));

    socket.handleTransportStatus('connected');

    expect(socket.status).toBe('connected');
    expect(connected).toHaveLength(1);
  });

  it('keeps a live feed live while the transport re-handshakes', () => {
    const { socket } = buildSocket();
    socket.handleTransportStatus('connected');

    socket.handleTransportStatus('connecting');

    expect(socket.status).toBe('connected');
  });

  it('reports connecting below the ceiling and error at the ceiling', () => {
    const { socket } = buildSocket();
    const errors: string[] = [];
    socket.onError((reason) => errors.push(reason));

    for (let attempt = 1; attempt < MAX_NOTIFICATION_RETRIES; attempt += 1) {
      socket.handleTransportStatus('reconnecting');
      expect(socket.status).toBe('connecting');
    }

    socket.handleTransportStatus('reconnecting');

    expect(socket.status).toBe('error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String(MAX_NOTIFICATION_RETRIES));
  });

  it('a successful connection resets the retry budget', () => {
    const { socket } = buildSocket();
    const errors: string[] = [];
    socket.onError((reason) => errors.push(reason));

    for (let attempt = 0; attempt < MAX_NOTIFICATION_RETRIES - 1; attempt += 1) {
      socket.handleTransportStatus('reconnecting');
    }
    socket.handleTransportStatus('connected');
    for (let attempt = 0; attempt < MAX_NOTIFICATION_RETRIES - 1; attempt += 1) {
      socket.handleTransportStatus('reconnecting');
    }

    expect(socket.status).toBe('connecting');
    expect(errors).toHaveLength(0);
  });

  it('maps a dropped transport to disconnected', () => {
    const { socket } = buildSocket();
    const dropped: number[] = [];
    socket.onDisconnect(() => dropped.push(1));
    socket.handleTransportStatus('connected');

    socket.handleTransportStatus('disconnected');

    expect(socket.status).toBe('disconnected');
    expect(dropped).toHaveLength(1);
  });

  it('ignores an unknown transport status', () => {
    const { socket } = buildSocket();
    socket.handleTransportStatus('connected');

    socket.handleTransportStatus('idle' as unknown as WebSocketStatus);

    expect(socket.status).toBe('connected');
  });
});
