import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHANNEL_CONNECTED,
  CHANNEL_DISCONNECTED,
  channelBus,
  type ChannelEvent
} from '../events/channel';
import { useChannelStore } from '../stores/channel';
import { useSubscriptionStore } from '../stores/subscription';

async function primeSubscription() {
  const sub = useSubscriptionStore();
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  return sub;
}

describe('channel store', () => {
  beforeEach(() => {
    localStorage.clear();
    channelBus.clear();
    setActivePinia(createPinia());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => {
    channelBus.clear();
    vi.unstubAllGlobals();
  });

  it('connects through the demo oauth loop and emits events', async () => {
    const store = useChannelStore();
    const events: ChannelEvent[] = [];
    channelBus.on((event) => events.push(event));

    await expect(store.connect('whatsapp')).resolves.toContain('/auth/callback/whatsapp');

    const channel = await store.completeConnect('whatsapp', { code: 'demo' });
    expect(channel?.status).toBe('connected');
    expect(store.channels).toHaveLength(1);
    expect(store.isChannelConnected('whatsapp')).toBe(true);
    expect(store.connectedCount).toBe(1);
    expect(events.map((e) => e.type)).toContain(CHANNEL_CONNECTED);
  });
  it('disconnects channels and frees the slot', async () => {
    const store = useChannelStore();
    const events: ChannelEvent[] = [];
    channelBus.on((event) => events.push(event));

    await store.completeConnect('facebook', { code: 'demo' });
    const channel = store.channels[0];

    expect(await store.disconnectChannel(channel.id)).toBe(true);
    expect(store.channels).toHaveLength(0);
    expect(events.map((e) => e.type)).toContain(CHANNEL_DISCONNECTED);
  });

  it('limits available slots by the subscription quota', async () => {
    await primeSubscription();
    const store = useChannelStore();

    expect(store.availableSlots).toBe(1);
    await store.completeConnect('whatsapp', { code: 'demo' });
    expect(store.availableSlots).toBe(0);
  });

  it('marks channels as needing re-auth when refresh fails', async () => {
    const store = useChannelStore();
    await store.completeConnect('instagram', { code: 'demo' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ success: false, message: 'boom', data: null })
    }));

    await store.refreshAllTokens();

    expect(store.channels[0].status).toBe('needs_reauth');
    expect(store.error).toBe('api.500');
  });

  it('refreshes tokens on healthy backends', async () => {
    const store = useChannelStore();
    await store.completeConnect('tiktok', { code: 'demo' });

    await store.refreshAllTokens();

    expect(store.channels[0].status).toBe('connected');
    expect(store.error).toBeNull();
  });
});