import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_INTERVAL_MS,
  InboxSocketClient,
  PONG_TIMEOUT_MS,
  resetWebSocketForTests,
  useWebSocket,
  type WebSocketStatus
} from '../composables/useWebSocket';
import { SOCKET_NEW_MESSAGE, SOCKET_TYPING, socketBus } from '../events/socket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
}

interface Scheduled {
  fn: () => void;
  delay: number;
}

function setup() {
  FakeSocket.instances = [];
  const scheduled: Scheduled[] = [];
  const statuses: WebSocketStatus[] = [];
  const client = new InboxSocketClient({
    url: 'ws://localhost/ws',
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    schedule: (fn, delay) => {
      scheduled.push({ fn, delay });
      return scheduled.length;
    },
    onStatus: (status) => statuses.push(status)
  });
  client.connect();
  return { client, scheduled, statuses };
}

beforeEach(() => {
  socketBus.clear();
  resetWebSocketForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  socketBus.clear();
  resetWebSocketForTests();
});

describe('InboxSocketClient reconnection', () => {
  it('reports connecting then connected', () => {
    const { statuses } = setup();
    FakeSocket.instances[0].open();

    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('backs off exponentially: 1s 2s 4s 8s capped at 30s', () => {
    const { scheduled } = setup();

    for (let i = 0; i < 6; i += 1) {
      FakeSocket.instances[i].onclose?.();
      scheduled[i].fn();
    }

    expect(scheduled.map((s) => s.delay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
  });

  it('labels retries as reconnecting', () => {
    const { scheduled, statuses } = setup();
    FakeSocket.instances[0].onclose?.();
    scheduled[0].fn();

    expect(statuses[statuses.length - 1]).toBe('reconnecting');
  });

  it('resets the backoff after a successful connection', () => {
    const { scheduled } = setup();
    FakeSocket.instances[0].onclose?.();
    scheduled[0].fn();
    FakeSocket.instances[1].open();
    FakeSocket.instances[1].onclose?.();

    const reconnects = scheduled.filter((s) => s.delay !== HEARTBEAT_INTERVAL_MS);
    expect(reconnects.map((s) => s.delay)).toEqual([1000, 1000]);
  });

  it('stops reconnecting after disconnect()', () => {
    const { client, scheduled, statuses } = setup();
    client.disconnect();
    FakeSocket.instances[0].onclose?.();

    expect(scheduled).toHaveLength(0);
    expect(statuses[statuses.length - 1]).toBe('disconnected');
    expect(FakeSocket.instances[0].closed).toBe(true);
  });

  it('schedules a retry when the constructor throws', () => {
    FakeSocket.instances = [];
    class ThrowingSocket {
      constructor() {
        throw new Error('blocked');
      }
    }
    const scheduled: Scheduled[] = [];
    const client = new InboxSocketClient({
      WebSocketImpl: ThrowingSocket as unknown as typeof WebSocket,
      schedule: (fn, delay) => {
        scheduled.push({ fn, delay });
        return scheduled.length;
      }
    });
    client.connect();

    expect(scheduled.map((s) => s.delay)).toEqual([1000]);
  });

  it('reports disconnected when no WebSocket implementation exists', () => {
    vi.stubGlobal('WebSocket', undefined);
    const statuses: WebSocketStatus[] = [];
    const client = new InboxSocketClient({ onStatus: (s) => statuses.push(s) });
    client.connect();

    expect(statuses).toEqual(['disconnected']);
  });
});

describe('InboxSocketClient heartbeat', () => {
  it('pings every 30s and closes on pong timeout', () => {
    const { scheduled } = setup();
    FakeSocket.instances[0].open();

    const pingTick = scheduled.find((s) => s.delay === HEARTBEAT_INTERVAL_MS);
    expect(pingTick).toBeTruthy();

    pingTick!.fn();
    expect(FakeSocket.instances[0].sent).toContain(JSON.stringify({ event: 'ping' }));

    const pongTimeout = scheduled.find((s) => s.delay === PONG_TIMEOUT_MS);
    expect(pongTimeout).toBeTruthy();
    pongTimeout!.fn();
    expect(FakeSocket.instances[0].closed).toBe(true);
  });

  it('keeps the heartbeat loop alive after a pong response', () => {
    const { scheduled } = setup();
    const socket = FakeSocket.instances[0];
    socket.open();
    const ticks = () => scheduled.filter((s) => s.delay === HEARTBEAT_INTERVAL_MS);
    ticks()[0].fn();

    socket.onmessage?.({ data: JSON.stringify({ event: 'pong' }) });

    expect(ticks()).toHaveLength(2);
    ticks()[1].fn();
    expect(socket.sent.filter((s) => s.includes('ping'))).toHaveLength(2);
    expect(socket.closed).toBe(false);
  });
});

describe('InboxSocketClient event dispatch', () => {
  it('emits new messages onto the socket bus', () => {
    setup();
    const seen: unknown[] = [];
    socketBus.on((event) => seen.push(event));

    FakeSocket.instances[0].onmessage?.({
      data: JSON.stringify({
        event: 'new_message',
        data: { id: 'm-1', conversationId: 'c-1', content: 'hi', type: 'text', sender: 'contact', timestamp: 7, status: 'sent' }
      })
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: SOCKET_NEW_MESSAGE, message: { id: 'm-1' } });
  });

  it('emits typing indicators onto the socket bus', () => {
    setup();
    const seen: unknown[] = [];
    socketBus.on((event) => seen.push(event));

    FakeSocket.instances[0].onmessage?.({
      data: JSON.stringify({ event: 'typing_indicator', data: { conversationId: 'c-1', isTyping: true } })
    });

    expect(seen[0]).toMatchObject({ type: SOCKET_TYPING, conversationId: 'c-1', isTyping: true });
  });

  it('emits read receipts and conversation updates', () => {
    setup();
    const seen: unknown[] = [];
    socketBus.on((event) => seen.push(event));

    FakeSocket.instances[0].onmessage?.({
      data: JSON.stringify({ event: 'message_read', data: { conversationId: 'c-1', messageId: 'm-2' } })
    });
    FakeSocket.instances[0].onmessage?.({
      data: JSON.stringify({ event: 'conversation_updated', data: { conversationId: 'c-2', patch: { archived: true } } })
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ type: 'socket:message-read', conversationId: 'c-1' });
    expect(seen[1]).toMatchObject({ type: 'socket:conversation-updated', patch: { archived: true } });
  });

  it('ignores malformed and unknown payloads', () => {
    setup();
    const seen: unknown[] = [];
    socketBus.on((event) => seen.push(event));

    FakeSocket.instances[0].onmessage?.({ data: '{not json' });
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ event: 'other' }) });
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ nope: true }) });

    expect(seen).toHaveLength(0);
  });

  it('sends typing signals only while open', () => {
    const { client } = setup();
    const socket = FakeSocket.instances[0];

    client.sendTyping('c-1', true);
    expect(socket.sent).toHaveLength(0);

    socket.open();
    client.sendTyping('c-1', true);
    expect(socket.sent[0]).toContain('typing_indicator');
  });
});

describe('useWebSocket singleton', () => {
  it('connects once and exposes status', () => {
    FakeSocket.instances = [];
    const statuses: WebSocketStatus[] = [];
    const first = useWebSocket({
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      onStatus: (s) => statuses.push(s)
    });
    first.connect();
    const second = useWebSocket();
    second.connect();

    expect(FakeSocket.instances).toHaveLength(1);
    FakeSocket.instances[0].open();
    expect(second.status.value).toBe('connected');

    first.typing('c-1', true);
    expect(FakeSocket.instances[0].sent.some((s) => s.includes('typing_indicator'))).toBe(true);

    first.disconnect();
    expect(second.status.value).toBe('disconnected');
  });
});