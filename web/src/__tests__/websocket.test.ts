import { describe, expect, it } from 'vitest';
import { backoffDelay, ConversationSocket, type ConversationUpdate } from '../lib/websocket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

interface Scheduled {
  fn: () => void;
  delay: number;
}

function setup() {
  FakeSocket.instances = [];
  const scheduled: Scheduled[] = [];
  const updates: ConversationUpdate[] = [];
  const states: string[] = [];
  const socket = new ConversationSocket({
    url: 'ws://localhost/ws',
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    schedule: (fn, delay) => {
      scheduled.push({ fn, delay });
    },
    onUpdate: (update) => updates.push(update),
    onStateChange: (state) => states.push(state)
  });
  return { scheduled, updates, states, socket };
}

describe('backoffDelay', () => {
  it('doubles per attempt', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(4)).toBe(16000);
  });

  it('caps at 30 seconds', () => {
    expect(backoffDelay(5)).toBe(30000);
    expect(backoffDelay(10)).toBe(30000);
  });

  it('treats negative attempts as zero', () => {
    expect(backoffDelay(-3)).toBe(1000);
  });
});

describe('ConversationSocket', () => {
  it('connects and reports open state', () => {
    const { states } = setup();
    const socket = FakeSocket.instances[0];
    socket.onopen?.();

    expect(states).toEqual(['connecting', 'open']);
  });

  it('dispatches conversation_update payloads', () => {
    const { updates } = setup();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({
      data: JSON.stringify({
        event: 'conversation_update',
        data: { conversationId: 'c-1', lastMessage: 'hi', lastMessageTime: 123 }
      })
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ conversationId: 'c-1', lastMessage: 'hi' });
  });

  it('ignores malformed or unrelated payloads', () => {
    const { updates } = setup();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({ data: '{not json' });
    socket.onmessage?.({ data: JSON.stringify({ event: 'other', data: {} }) });

    expect(updates).toHaveLength(0);
  });

  it('reconnects with exponential backoff after close', () => {
    const { scheduled } = setup();
    FakeSocket.instances[0].onclose?.();
    expect(scheduled.map((s) => s.delay)).toEqual([1000]);

    scheduled[0].fn();
    FakeSocket.instances[1].onclose?.();
    expect(scheduled.map((s) => s.delay)).toEqual([1000, 2000]);
  });

  it('resets the attempt counter once open', () => {
    const { scheduled } = setup();
    FakeSocket.instances[0].onclose?.();
    scheduled[0].fn();
    FakeSocket.instances[1].onopen?.();
    FakeSocket.instances[1].onclose?.();

    expect(scheduled.map((s) => s.delay)).toEqual([1000, 1000]);
  });

  it('stops reconnecting after close()', () => {
    const { scheduled, socket, states } = setup();
    socket.close();
    FakeSocket.instances[0].onclose?.();

    expect(scheduled).toHaveLength(0);
    expect(FakeSocket.instances[0].closed).toBe(true);
    expect(states[states.length - 1]).toBe('closed');
  });
});