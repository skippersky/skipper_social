import type { Conversation, Message } from '../types';

export const SOCKET_NEW_MESSAGE = 'socket:new-message';
export const SOCKET_MESSAGE_READ = 'socket:message-read';
export const SOCKET_CONVERSATION_UPDATED = 'socket:conversation-updated';
export const SOCKET_TYPING = 'socket:typing-indicator';

export type SocketEventType =
  | typeof SOCKET_NEW_MESSAGE
  | typeof SOCKET_MESSAGE_READ
  | typeof SOCKET_CONVERSATION_UPDATED
  | typeof SOCKET_TYPING;

export type SocketEvent =
  | { type: typeof SOCKET_NEW_MESSAGE; message: Message }
  | { type: typeof SOCKET_MESSAGE_READ; conversationId: string; messageId?: string }
  | {
      type: typeof SOCKET_CONVERSATION_UPDATED;
      conversationId: string;
      patch: Partial<Conversation>;
    }
  | { type: typeof SOCKET_TYPING; conversationId: string; isTyping: boolean };

type SocketEventHandler = (event: SocketEvent) => void;

const handlers = new Set<SocketEventHandler>();

/** Minimal typed event bus with a mitt-compatible on/off/emit surface. */
export const socketBus = {
  on(handler: SocketEventHandler): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
  off(handler: SocketEventHandler): void {
    handlers.delete(handler);
  },
  emit(event: SocketEvent): void {
    for (const handler of [...handlers]) {
      handler(event);
    }
  },
  clear(): void {
    handlers.clear();
  }
};