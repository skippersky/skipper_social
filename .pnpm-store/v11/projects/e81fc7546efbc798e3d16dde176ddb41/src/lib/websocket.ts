export interface ConversationUpdate {
  conversationId: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount?: number;
}

interface SocketEnvelope {
  event: string;
  data: ConversationUpdate;
}

export type SocketState = 'connecting' | 'open' | 'closed';

/**
 * Exponential backoff: 1s, 2s, 4s, ... capped at 30s (DESIGN/Sprint 2b spec).
 */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

export interface ConversationSocketOptions {
  url: string;
  onUpdate?: (update: ConversationUpdate) => void;
  onStateChange?: (state: SocketState) => void;
  /** Injectable for tests and non-browser environments. */
  WebSocketImpl?: typeof WebSocket;
  /** Injectable scheduler so tests can observe reconnect timing. */
  schedule?: (fn: () => void, delayMs: number) => void;
}

/**
 * Native-WebSocket client for conversation updates. The backend event contract
 * is finalised in Sprint 3; until then this stays inert without errors.
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
    this.options.onStateChange?.('connecting');
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
    try {
      const parsed = JSON.parse(raw) as SocketEnvelope;
      if (parsed.event === 'conversation_update' && parsed.data) {
        this.options.onUpdate?.(parsed.data);
      }
    } catch {
      /* ignore malformed payloads */
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