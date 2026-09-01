import type { Message, MessageStatus } from '../types';

export interface ConversationUpdate {
  conversationId: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount?: number;
}

export interface MessageStatusUpdate {
  messageId: string;
  status: MessageStatus;
}

interface SocketEnvelope {
  event: 'conversation_update' | 'new_message' | 'message_status_update' | string;
  data: ConversationUpdate | Message | MessageStatusUpdate;
}

export type SocketState = 'connecting' | 'open' | 'closed';

/** Report "connecting" only for the first attempts; prolonged failure reads offline. */
export const MAX_CONNECTING_ATTEMPTS = 3;

/**
 * Exponential backoff: 1s, 2s, 4s, ... capped at 30s.
 */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

/** Default WebSocket endpoint: same-origin /ws, overridable via VITE_WS_URL. */
export function defaultWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  if (typeof location === 'undefined') return 'ws://localhost/ws';
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws`;
}

export interface ConversationSocketOptions {
  url: string;
  onUpdate?: (update: ConversationUpdate) => void;
  onNewMessage?: (message: Message) => void;
  onMessageStatus?: (update: MessageStatusUpdate) => void;
  onStateChange?: (state: SocketState) => void;
  /** Injectable for tests and non-browser environments. */
  WebSocketImpl?: typeof WebSocket;
  /** Injectable scheduler so tests can observe reconnect timing. */
  schedule?: (fn: () => void, delayMs: number) => void;
}

/**
 * Native-WebSocket client for live conversation events. The backend service
 * arrives in Sprint 3; until then this reconnects quietly without errors.
 */
export class ConversationSocket {
  private readonly options: ConversationSocketOptions;
  private socket: WebSocket | null = null;
  private attempt = 0;
  private closed = false;

  constructor(options: ConversationSocketOptions) {
    this.options = options;
    this.connect();
  }

  close(): void {
    this.closed = true;
    this.options.onStateChange?.('closed');
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* socket may already be gone */
      }
      this.socket = null;
    }
  }

  private connect(): void {
    if (this.closed) {
      return;
    }
    const Impl =
      this.options.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
    if (!Impl) {
      this.options.onStateChange?.('closed');
      return;
    }
    const state: SocketState = this.attempt < MAX_CONNECTING_ATTEMPTS ? 'connecting' : 'closed';
    this.options.onStateChange?.(state);
    let socket: WebSocket;
    try {
      socket = new Impl(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.options.onStateChange?.('open');
    };
    socket.onmessage = (event: MessageEvent) => {
      this.handleMessage(String(event.data));
    };
    socket.onclose = () => {
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };
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
      case 'conversation_update':
        this.options.onUpdate?.(parsed.data as ConversationUpdate);
        break;
      case 'new_message':
        this.options.onNewMessage?.(parsed.data as Message);
        break;
      case 'message_status_update':
        this.options.onMessageStatus?.(parsed.data as MessageStatusUpdate);
        break;
      default:
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    const schedule =
      this.options.schedule ?? ((fn, ms) => { setTimeout(fn, ms); });
    schedule(() => this.connect(), delay);
  }
}