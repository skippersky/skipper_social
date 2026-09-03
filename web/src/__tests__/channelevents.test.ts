import { describe, expect, it } from 'vitest';
import {
  CHANNEL_CONNECTED,
  CHANNEL_DISCONNECTED,
  CHANNEL_TOKEN_REFRESHED,
  channelBus
} from '../events/channel';

describe('channel event bus', () => {
  it('delivers events to subscribers', () => {
    const received: string[] = [];
    const off = channelBus.on((event) => received.push(event.type));

    channelBus.emit({ type: CHANNEL_CONNECTED, platform: 'whatsapp' });
    channelBus.emit({ type: CHANNEL_TOKEN_REFRESHED, platform: 'tiktok' });

    expect(received).toEqual([CHANNEL_CONNECTED, CHANNEL_TOKEN_REFRESHED]);
    off();
    channelBus.clear();
  });

  it('stops delivering after unsubscribe', () => {
    const received: string[] = [];
    const off = channelBus.on((event) => received.push(event.type));
    off();

    channelBus.emit({ type: CHANNEL_DISCONNECTED, platform: 'facebook' });

    expect(received).toEqual([]);
  });

  it('clear removes every subscriber', () => {
    const received: string[] = [];
    channelBus.on((event) => received.push(event.type));
    channelBus.clear();

    channelBus.emit({ type: CHANNEL_CONNECTED, platform: 'instagram' });

    expect(received).toEqual([]);
  });
});