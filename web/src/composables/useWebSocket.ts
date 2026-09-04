import { ref } from 'vue';
import { backoffDelay, defaultWsUrl } from '../lib/websocket';
import {
  SOCKET_CONVERSATION_UPDATED,
  SOCKET_MESSAGE_READ,
  SOCKET_NEW_MESSAGE,
  SOCKET_TYPING,
  socketBus
} from '../events/socket';
import type { Conversation, Message } from '../types';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const PONG_TIMEOUT_MS = 10_000;

interface SocketEnvelope {
  event: string;
  data?: unknown;
}

export interface InboxSocketOptions {
  url?: string;
  WebSocketImpl?: typeof WebSocket;
  /** Injectable scheduler so tests can drive reconnect/heartbeat timing. */
  schedule?: (fn: () => void, delayMs: number) => unknown;
  onStatus?: (status: WebSocketStatus) => void;
}

/** Native WebSocket client with exponential backoff and ping/pong heartbeat. */
export class InboxSocketClient {
  private readonly options: InboxSocketOptions;
  private socket: WebSocket | null = null;
  private attempt = 0;
  private closed = false;
  private heartbeat: ReturnType<typeof setTimeout> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: InboxSocketOptions = {}) {
    this.options = options;
  }

  connect(): void {
    if (this.closed) return;
    const Impl =
      this.options.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
    if (!Impl) {
      this.report('disconnected');
      return;
    }
    this.report(this.attempt === 0 ? 'connecting' : 'reconnecting');
    let socket: WebSocket;
    try {
      socket = new Impl(this.options.url ?? defaultWsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.report('connected');
      this.startHeartbeat();
    };
    socket.onmessage = (event) => {
      this.clearPongTimer();
      this.handleMessage(String(event.data));
    };
    socket.onclose = () => {
      this.stopHeartbeat();
      if (!this.closed) this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* socket may already be gone */
      }
      this.socket = null;
    }
    this.report('disconnected');
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    if (this.socket?.readyState === 1) {
      try {
        this.socket.send(JSON.stringify({ event: 'typing_indicator', data: { conversationId, isTyping } }));
      } catch {
        /* transport hiccup; reconnect logic will recover */
      }
    }
  }
  private report(value: WebSocketStatus): void {
    this.options.onStatus?.(value);
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.report('reconnecting');
    const schedule = this.options.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
    schedule(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const schedule = this.options.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
    const tick = (): void => {
      if (this.socket?.readyState === 1) {
        try {
          this.socket.send(JSON.stringify({ event: 'ping' }));
        } catch {
          /* ignore; pong timeout will recover */
        }
        this.pongTimer = schedule(() => {
          try {
            this.socket?.close();
          } catch {
            /* already gone */
          }
        }, PONG_TIMEOUT_MS) as ReturnType<typeof setTimeout>;
      }
      this.heartbeat = schedule(tick, HEARTBEAT_INTERVAL_MS) as ReturnType<typeof setTimeout>;
    };
    this.heartbeat = schedule(tick, HEARTBEAT_INTERVAL_MS) as ReturnType<typeof setTimeout>;
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearTimeout(this.heartbeat);
    this.clearPongTimer();
    this.heartbeat = null;
  }

  private clearPongTimer(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private handleMessage(raw: string): void {
    let parsed: SocketEnvelope;
    try {
      parsed = JSON.parse(raw) as SocketEnvelope;
    } catch {
      return;
    }
    if (!parsed || typeof parsed.event !== 'string') return;
    switch (parsed.event) {
      case 'pong':
        break;
      case 'new_message':
        socketBus.emit({ type: SOCKET_NEW_MESSAGE, message: parsed.data as Message });
        break;
      case 'message_read': {
        const data = parsed.data as { conversationId: string; messageId?: string };
        socketBus.emit({ type: SOCKET_MESSAGE_READ, conversationId: data.conversationId, messageId: data.messageId });
        break;
      }
      case 'conversation_updated': {
        const data = parsed.data as { conversationId: string; patch: Partial<Conversation> };
        socketBus.emit({ type: SOCKET_CONVERSATION_UPDATED, conversationId: data.conversationId, patch: data.patch });
        break;
      }
      case 'typing_indicator': {
        const data = parsed.data as { conversationId: string; isTyping: boolean };
        socketBus.emit({ type: SOCKET_TYPING, conversationId: data.conversationId, isTyping: data.isTyping });
        break;
      }
      default:
        break;
    }
  }
}

const status = ref<WebSocketStatus>('disconnected');
let client: InboxSocketClient | null = null;

/** Singleton-backed connection manager shared by every consumer. */
export function useWebSocket(options: InboxSocketOptions = {}) {
  function connect(): void {
    if (client) return;
    client = new InboxSocketClient({
      ...options,
      onStatus: (next) => {
        status.value = next;
        options.onStatus?.(next);
      }
    });
    client.connect();
  }

  function disconnect(): void {
    client?.disconnect();
    client = null;
  }

  function typing(conversationId: string, isTyping: boolean): void {
    client?.sendTyping(conversationId, isTyping);
  }

  return { status, connect, disconnect, typing };
}

/** Test hook: drop the singleton so each suite starts clean. */
export function resetWebSocketForTests(): void {
  client?.disconnect();
  client = null;
  status.value = 'disconnected';
}