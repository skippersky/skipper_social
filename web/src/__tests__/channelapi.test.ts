import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectChannel,
  disconnectChannel,
  getChannelById,
  getChannels,
  refreshChannelToken
} from '../api/channel';

describe('channel api demo fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty and reports missing ids', async () => {
    await expect(getChannels()).resolves.toEqual([]);
    await expect(getChannelById('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('starts the oauth loop with an in-app callback url', async () => {
    const start = await connectChannel('whatsapp');

    expect(start.authUrl).toContain('/auth/callback/whatsapp');
    expect(start.channel).toBeUndefined();
  });

  it('finalizes the oauth loop into a connected channel', async () => {
    const done = await connectChannel('whatsapp', { code: 'demo-code', state: 'demo-state' });

    expect(done.channel).toMatchObject({ platform: 'whatsapp', status: 'connected' });
    expect(done.channel?.accountName).toBe('+255 700 100 200');

    const list = await getChannels();
    expect(list).toHaveLength(1);
  });

  it('refreshes tokens and disconnects channels', async () => {
    const done = await connectChannel('facebook', { code: 'demo' });
    const channel = done.channel!;

    const token = await refreshChannelToken(channel.id);
    expect(token.channelId).toBe(channel.id);
    expect(token.tokenExpiresAt).toBeGreaterThan(Date.now());

    await disconnectChannel(channel.id);
    await expect(getChannels()).resolves.toEqual([]);
  });
});