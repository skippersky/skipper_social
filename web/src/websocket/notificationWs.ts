import {
  SOCKET_NOTIFICATION,
  SOCKET_NOTIFICATION_READ,
  socketBus,
  type SocketEvent
} from '../events/socket';
import type { WebSocketStatus } from '../composables/useWebSocket';
import type { AppNotification, NotificationConnectionStatus } from '../types';

/**
 * Retry ceiling for the notification feed. The shared transport keeps backing
 * off forever for the inbox; the notification layer stops announcing "retrying"
 * after this many attempts and surfaces an error state instead.
 */
export const MAX_NOTIFICATION_RETRIES = 5;

/** Bound on the seen-id ring so a long session cannot grow the dedupe set. */
export const DEDUPE_CAPACITY = 200;

export type NotificationMessageHandler = (notification: AppNotification) => void;
export type NotificationReadHandler = (notificationId: string, read: boolean) => void;
export type NotificationVoidHandler = () => void;
export type NotificationErrorHandler = (reason: string) => void;

export interface NotificationSocketDeps {
  /** Opens the shared transport. Injected so tests never touch a real socket. */
  connect?: () => void;
  /** Subscribes to shared transport status changes; returns an unsubscribe. */
  watchStatus?: (handler: (status: WebSocketStatus) => void) => () => void;
}

/**
 * Notification feed on top of the Sprint 6 socket. One WebSocket serves the whole
 * app: this class owns subscription, dedupe and retry accounting for the
 * notification domain only, and never opens a second connection.
 */
export class NotificationSocket {
  private readonly deps: NotificationSocketDeps;
  private messageHandlers = new Set<NotificationMessageHandler>();
  private readHandlers = new Set<NotificationReadHandler>();
  private connectHandlers = new Set<NotificationVoidHandler>();
  private disconnectHandlers = new Set<NotificationVoidHandler>();
  private errorHandlers = new Set<NotificationErrorHandler>();
  private unsubscribeBus: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private statusValue: NotificationConnectionStatus = 'disconnected';
  private retries = 0;
  private readonly seen: string[] = [];
  private readonly seenIds = new Set<string>();

  constructor(deps: NotificationSocketDeps = {}) {
    this.deps = deps;
  }

  get status(): NotificationConnectionStatus {
    return this.statusValue;
  }

  /** Number of notification ids currently held in the dedupe ring. */
  get trackedIds(): number {
    return this.seenIds.size;
  }

  onMessage(handler: NotificationMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onRead(handler: NotificationReadHandler): () => void {
    this.readHandlers.add(handler);
    return () => this.readHandlers.delete(handler);
  }

  onConnect(handler: NotificationVoidHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: NotificationVoidHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  onError(handler: NotificationErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  connect(): void {
    if (this.unsubscribeBus) return;
    this.unsubscribeBus = socketBus.on((event) => this.handleBusEvent(event));
    this.unsubscribeStatus =
      this.deps.watchStatus?.((status) => this.handleTransportStatus(status)) ?? null;
    this.setStatus('connecting');
    this.deps.connect?.();
  }

  /**
   * Detaches the notification feed. The shared transport stays up for the inbox,
   * so this never closes a socket other consumers still need.
   */
  disconnect(): void {
    this.unsubscribeBus?.();
    this.unsubscribeBus = null;
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
    this.retries = 0;
    this.setStatus('disconnected');
    for (const handler of [...this.disconnectHandlers]) handler();
  }

  /** Clears the dedupe ring, e.g. after a logout or an account switch. */
  reset(): void {
    this.seen.length = 0;
    this.seenIds.clear();
    this.retries = 0;
  }

  /** True when this id was already delivered; otherwise records it. */
  isDuplicate(id: string): boolean {
    if (this.seenIds.has(id)) return true;
    this.seen.push(id);
    this.seenIds.add(id);
    while (this.seen.length > DEDUPE_CAPACITY) {
      const evicted = this.seen.shift();
      if (evicted !== undefined) this.seenIds.delete(evicted);
    }
    return false;
  }

  /** Maps a shared-transport status onto the notification connection state. */
  handleTransportStatus(status: WebSocketStatus): void {
    switch (status) {
      case 'connecting':
        if (this.statusValue !== 'connected') this.setStatus('connecting');
        break;
      case 'connected':
        this.retries = 0;
        this.setStatus('connected');
        for (const handler of [...this.connectHandlers]) handler();
        break;
      case 'reconnecting':
        this.retries += 1;
        if (this.retries >= MAX_NOTIFICATION_RETRIES) {
          this.setStatus('error');
          this.emitError('notification stream unreachable after ' + this.retries + ' attempts');
        } else {
          this.setStatus('connecting');
        }
        break;
      case 'disconnected':
        this.setStatus('disconnected');
        for (const handler of [...this.disconnectHandlers]) handler();
        break;
      default:
        break;
    }
  }

  private handleBusEvent(event: SocketEvent): void {
    if (event.type === SOCKET_NOTIFICATION) {
      this.deliver(event.notification);
      return;
    }
    if (event.type === SOCKET_NOTIFICATION_READ) {
      for (const handler of [...this.readHandlers]) handler(event.notificationId, event.read);
    }
  }

  private deliver(notification: AppNotification): void {
    if (!notification || typeof notification.id !== 'string') return;
    if (this.isDuplicate(notification.id)) return;
    for (const handler of [...this.messageHandlers]) handler(notification);
  }

  private emitError(reason: string): void {
    for (const handler of [...this.errorHandlers]) handler(reason);
  }

  private setStatus(next: NotificationConnectionStatus): void {
    this.statusValue = next;
  }
}
