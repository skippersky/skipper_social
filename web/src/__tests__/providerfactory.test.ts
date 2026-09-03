import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChannelProviderFactory,
  getChannelProvider,
  registerChannelProvider,
  WhatsAppProvider
} from '../providers';
import type { ChannelProvider } from '../providers';
import type { ChannelPlatform } from '../types';

describe('ChannelProviderFactory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns a provider for each built-in platform', () => {
    for (const platform of ['whatsapp', 'facebook', 'instagram', 'tiktok'] as ChannelPlatform[]) {
      expect(ChannelProviderFactory.get(platform).platform).toBe(platform);
    }
  });

  it('supports registering custom providers', () => {
    const custom: ChannelProvider = {
      platform: 'whatsapp',
      getRequiredCredentials: () => [],
      connect: async () => ({ authUrl: 'https://custom.example' }),
      disconnect: async () => undefined,
      refreshToken: async (id) => ({ channelId: id, tokenExpiresAt: 1 }),
      getStatus: async () => 'connected'
    };
    const original = getChannelProvider('whatsapp');

    registerChannelProvider(custom);
    expect(getChannelProvider('whatsapp')).toBe(custom);

    registerChannelProvider(original);
    expect(getChannelProvider('whatsapp')).toBe(original);
  });

  it('rejects unknown platforms', () => {
    expect(() => getChannelProvider('myspace' as ChannelPlatform)).toThrow();
  });

  it('every provider completes the connect, status, refresh and disconnect cycle', async () => {
    const { demoConnect } = await import('../api/demo');

    for (const platform of ['whatsapp', 'facebook', 'instagram', 'tiktok'] as ChannelPlatform[]) {
      const provider = getChannelProvider(platform);
      await provider.connect();
      const channel = demoConnect(platform, { code: 'demo' }).channel!;

      await expect(provider.getStatus(channel.id)).resolves.toBe('connected');
      const token = await provider.refreshToken(channel.id);
      expect(token.channelId).toBe(channel.id);
      await provider.disconnect(channel.id);
    }

    expect(localStorage.getItem('ks-demo-channels')).toBe('[]');
  });

  it('providers work standalone against the demo directory', async () => {
    const provider = new WhatsAppProvider();

    const auth = await provider.connect();
    expect(auth.authUrl).toContain('/auth/callback/whatsapp');

    const { demoConnect } = await import('../api/demo');
    const finalized = demoConnect('whatsapp', { code: 'demo' });
    const channel = finalized.channel!;
    await expect(provider.getStatus(channel.id)).resolves.toBe('connected');

    const token = await provider.refreshToken(channel.id);
    expect(token.channelId).toBe(channel.id);

    await provider.disconnect(channel.id);
    expect(localStorage.getItem('ks-demo-channels')).toBe('[]');
  });
});