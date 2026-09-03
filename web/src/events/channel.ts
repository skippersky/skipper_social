import type { Channel, ChannelPlatform } from '../types';

export const CHANNEL_CONNECTED = 'channel:connected';
export const CHANNEL_DISCONNECTED = 'channel:disconnected';
export const CHANNEL_TOKEN_REFRESHED = 'channel:token-refreshed';
export const CHANNEL_STATUS_CHANGED = 'channel:status-changed';

export type ChannelEventType =
  | typeof CHANNEL_CONNECTED
  | typeof CHANNEL_DISCONNECTED
  | typeof CHANNEL_TOKEN_REFRESHED
  | typeof CHANNEL_STATUS_CHANGED;

export interface ChannelEvent {
  type: ChannelEventType;
  platform?: ChannelPlatform;
  channel?: Channel | null;
}

type ChannelEventHandler = (event: ChannelEvent) => void;

const handlers = new Set<ChannelEventHandler>();

/** Minimal typed event bus with a mitt-compatible on/off/emit surface. */
export const channelBus = {
  on(handler: ChannelEventHandler): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
  off(handler: ChannelEventHandler): void {
    handlers.delete(handler);
  },
  emit(event: ChannelEvent): void {
    for (const handler of [...handlers]) {
      handler(event);
    }
  },
  clear(): void {
    handlers.clear();
  }
};