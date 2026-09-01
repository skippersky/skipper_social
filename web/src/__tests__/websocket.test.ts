import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backoffDelay,
  ConversationSocket,
  defaultWsUrl,
  type ConversationUpdate,
  type MessageStatusUpdate
} from '../lib/websocket';
import type { Message } from '../types';

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
  const newMessages: Message[] = [];
  const statusUpdates: MessageStatusUpdate[] = [];
  const states: string[] = [];
  const socket = new ConversationSocket({
    url: 'ws://localhost/ws',
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    schedule: (fn, delay) => {
      scheduled.push({ fn, delay });
    },
    onUpdate: (update) => updates.push(update),
    onNewMessage: (message) => newMessages.push(message),
    onMessageStatus: (update) => statusUpdates.push(update),
    onStateChange: (state) => states.push(state)
  });
  return { scheduled, updates, newMessages, statusUpdates, states, socket };
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

describe('defaultWsUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honours the VITE_WS_URL override', () => {
    vi.stubEnv('VITE_WS_URL', 'wss://api.example.test/ws');
    expect(defaultWsUrl()).toBe('wss://api.example.test/ws');
  });

  it('falls back to the same-origin /ws endpoint', () => {
    const url = defaultWsUrl();
    expect(url.startsWith('ws')).toBe(true);
    expect(url.endsWith('/ws')).toBe(true);
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

  it('dispatches new_message payloads', () => {
    const { newMessages } = setup();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({
      data: JSON.stringify({
        event: 'new_message',
        data: {
          id: 'm-9',
          conversationId: 'c-1',
          content: 'hi',
          type: 'text',
          sender: 'contact',
          timestamp: 5,
          status: 'sent'
        }
      })
    });

    expect(newMessages).toHaveLength(1);
    expect(newMessages[0]).toMatchObject({ id: 'm-9', conversationId: 'c-1' });
  });

  it('dispatches message_status_update payloads', () => {
    const { statusUpdates } = setup();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({
      data: JSON.stringify({
        event: 'message_status_update',
        data: { messageId: 'm-2', status: 'read' }
      })
    });

    expect(statusUpdates).toHaveLength(1);
    expect(statusUpdates[0]).toMatchObject({ messageId: 'm-2', status: 'read' });
  });

  it('ignores malformed or unrelated payloads', () => {
    const { updates, newMessages, statusUpdates } = setup();
    const socket = FakeSocket.instances[0];
    socket.onmessage?.({ data: '{not json' });
    socket.onmessage?.({ data: JSON.stringify({ event: 'other', data: {} }) });

    expect(updates).toHaveLength(0);
    expect(newMessages).toHaveLength(0);
    expect(statusUpdates).toHaveLength(0);
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

  it('reports offline after repeated failed connection attempts', () => {
    const { scheduled, states } = setup();

    for (let i = 0; i < 3; i += 1) {
      FakeSocket.instances[i].onclose?.();
      scheduled[i].fn();
    }

    expect(states[states.length - 1]).toBe('closed');
  });
});