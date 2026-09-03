import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWebhookStatus, registerWebhook } from '../api/webhooks';

describe('webhook api demo fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports unregistered webhooks by default', async () => {
    const status = await getWebhookStatus('whatsapp');

    expect(status).toMatchObject({ platform: 'whatsapp', registered: false });
  });

  it('registers a webhook and reads it back', async () => {
    const registered = await registerWebhook('whatsapp', 'https://social.example/wa');

    expect(registered.registered).toBe(true);
    expect(registered.url).toBe('https://social.example/wa');

    const status = await getWebhookStatus('whatsapp');
    expect(status.registered).toBe(true);
    expect(status.url).toBe('https://social.example/wa');
  });
});