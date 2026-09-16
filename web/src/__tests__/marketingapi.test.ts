import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as marketingApi from '../api/marketing';
import { ApiError } from '../api/http';
import {
  demoCampaigns,
  demoRecipients,
  demoResetMarketing,
  demoSendHistory,
  demoTemplates
} from '../api/demoMarketing';
import { composeContent } from '../lib/marketingContent';
import type {
  AIContentRequest,
  CampaignInput,
  MarketingContent,
  Recipient,
  TemplateInput
} from '../types';
import { DEFAULT_SEND_SETTINGS } from '../types';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({ success: ok, code: ok ? 'OK' : 'HTTP_' + status, message: 'server said no', data })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

function missingBackend() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));
}

function serverError(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

function serve(data: unknown, ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(data, ok, status));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const NOW = new Date(2026, 8, 7, 9, 0).getTime();

function request(patch: Partial<AIContentRequest> = {}): AIContentRequest {
  return {
    prompt: 'Weekend flash sale on denim jackets',
    goal: 'promotion',
    audience: 'Nairobi denim buyers',
    language: 'en',
    tone: 'friendly',
    length: 'standard',
    ...patch
  };
}

function content(): MarketingContent {
  return composeContent(
    {
      prompt: 'Weekend flash sale',
      goal: 'promotion',
      audience: 'Nairobi denim buyers',
      language: 'en',
      tone: 'friendly',
      length: 'standard'
    },
    NOW
  );
}

function campaignInput(patch: Partial<CampaignInput> = {}): CampaignInput {
  return {
    name: 'September denim push',
    content: content(),
    templateId: 'tpl-promo',
    recipientIds: ['u-1', 'u-2'],
    filters: { tagIds: [], channels: ['whatsapp'], activity: 'all', query: '' },
    settings: { ...DEFAULT_SEND_SETTINGS },
    ...patch
  };
}

function templateInput(patch: Partial<TemplateInput> = {}): TemplateInput {
  return {
    name: 'Flash sale',
    category: 'promotion',
    title: 'Two days only',
    content: 'Everything at half price for {audience}.',
    cta: 'Shop now',
    ...patch
  };
}

beforeEach(() => {
  localStorage.clear();
  demoResetMarketing();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('marketing api content endpoints', () => {
  it('posts the prompt to the backend and returns its draft', async () => {
    const draft = content();
    const mock = serve(draft);

    await expect(marketingApi.generateAIContent(request())).resolves.toEqual(draft);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/content/generate');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toMatchObject({ goal: 'promotion' });
  });

  it('falls back to the offline composer when the backend is missing', async () => {
    offline();
    const first = await marketingApi.generateAIContent(request());
    expect(first.id.startsWith('mc-')).toBe(true);
    expect(first.title).toContain('Nairobi denim buyers');

    missingBackend();
    const second = await marketingApi.generateAIContent(request());
    expect(second.id).toBe(first.id);
    expect(second.body).toBe(first.body);
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
  });

  it('refines a cached draft when feedback and a source id arrive together', async () => {
    offline();
    const source = await marketingApi.generateAIContent(request());
    const refined = await marketingApi.generateAIContent(
      request({ sourceId: source.id, feedback: 'make it more playful' })
    );
    expect(refined.id).toBe(source.id);
    expect(refined.tone).toBe('playful');
  });

  it('surfaces a hard server failure instead of pretending to be offline', async () => {
    serverError(500);
    await expect(marketingApi.generateAIContent(request())).rejects.toThrow(ApiError);
    await expect(marketingApi.generateAIContent(request())).rejects.toMatchObject({ code: 'HTTP_500' });
  });

  it('renders channel previews from the backend or locally', async () => {
    const served = [{ platform: 'whatsapp', title: 't', body: 'b', cta: 'c', charCount: 1, limit: 4096, truncated: false }];
    const mock = serve(served);
    await expect(
      marketingApi.previewContent({ content: content(), platforms: ['whatsapp'] })
    ).resolves.toEqual(served);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/content/preview');

    offline();
    const local = await marketingApi.previewContent({ content: content(), platforms: ['instagram', 'tiktok'] });
    expect(local.map((item) => item.platform)).toEqual(['instagram', 'tiktok']);
    expect(local[0].limit).toBe(2200);

    const defaulted = await marketingApi.previewContent({ content: content(), platforms: [] });
    expect(defaulted.map((item) => item.platform)).toEqual(['whatsapp']);
  });
});

describe('marketing api templates', () => {
  it('lists demo templates ordered by usefulness and filters by category', async () => {
    offline();
    const all = await marketingApi.getTemplates();
    expect(all.map((item) => item.id)).toEqual(demoTemplates().map((item) => item.id));
    expect(all[0].id).toBe('tpl-promo');
    expect(all[0].usageCount).toBeGreaterThanOrEqual(all[all.length - 1].usageCount);

    const promotions = await marketingApi.getTemplates('promotion');
    expect(promotions.every((item) => item.category === 'promotion')).toBe(true);
    expect(promotions.length).toBeLessThan(all.length);
  });

  it('serialises the category filter into the query string', async () => {
    const mock = serve([]);
    await marketingApi.getTemplates('winback');
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/templates?category=winback');
    await marketingApi.getTemplates();
    expect(String(mock.mock.calls[1][0])).toBe('/api/v1/marketing/templates');
  });

  it('creates, updates, counts a use and deletes a template offline', async () => {
    offline();
    const created = await marketingApi.createTemplate(templateInput());
    expect(created.id.startsWith('tpl-')).toBe(true);
    expect(created.usageCount).toBe(0);
    expect(created.name).toBe('Flash sale');

    const updated = await marketingApi.updateTemplate(created.id, { cta: 'Buy today' });
    expect(updated.cta).toBe('Buy today');
    expect(updated.name).toBe('Flash sale');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    const used = await marketingApi.useTemplate(created.id);
    expect(used.usageCount).toBe(1);
    expect((await marketingApi.getTemplates()).some((item) => item.id === created.id)).toBe(true);

    await marketingApi.deleteTemplate(created.id);
    expect((await marketingApi.getTemplates()).some((item) => item.id === created.id)).toBe(false);
  });

  it('rejects template operations on an unknown id', async () => {
    offline();
    await expect(marketingApi.updateTemplate('tpl-nope', { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(marketingApi.useTemplate('tpl-nope')).rejects.toThrow(ApiError);
  });

  it('routes template writes through the backend when it answers', async () => {
    const saved = { ...templateInput(), id: 'srv-tpl', usageCount: 3, createdAt: NOW, updatedAt: NOW };
    const mock = serve(saved);
    await expect(marketingApi.createTemplate(templateInput())).resolves.toEqual(saved);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/templates');

    await marketingApi.updateTemplate('a/b', { name: 'renamed' });
    expect(String(mock.mock.calls[1][0])).toBe('/api/v1/marketing/templates/a%2Fb');
    expect(mock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });

    await marketingApi.useTemplate('srv-tpl');
    expect(String(mock.mock.calls[2][0])).toBe('/api/v1/marketing/templates/srv-tpl/use');

    await marketingApi.deleteTemplate('srv-tpl');
    expect(String(mock.mock.calls[3][0])).toBe('/api/v1/marketing/templates/srv-tpl');
    expect(mock.mock.calls[3][1]).toMatchObject({ method: 'DELETE' });
  });
});

describe('marketing api recipients and channels', () => {
  it('queries the audience built from the customer directory', async () => {
    offline();
    const recipients = await marketingApi.getRecipients();
    expect(recipients).toEqual(demoRecipients());
    expect(recipients.length).toBeGreaterThan(0);
    expect(recipients.every((item) => typeof item.valid === 'boolean')).toBe(true);
    expect(
      recipients.every((item) => item.handle.length > 0 || !item.valid)
    ).toBe(true);
    expect(recipients.filter((item) => !item.valid).every((item) => Boolean(item.invalidReason))).toBe(true);
  });

  it('narrows the audience by query, channel and activity', async () => {
    offline();
    const all = await marketingApi.getRecipients();
    const byName = await marketingApi.getRecipients({ query: all[0].name.split(' ')[0] });
    expect(byName.length).toBeLessThanOrEqual(all.length);
    expect(byName.every((item) => item.id === all[0].id || item.name.includes(all[0].name.split(' ')[0]))).toBe(true);

    const none = await marketingApi.getRecipients({ query: 'nobody-here-at-all' });
    expect(none).toEqual([]);

    const active = await marketingApi.getRecipients({ activity: 'active' });
    const inactive = await marketingApi.getRecipients({ activity: 'inactive' });
    expect(active.length + inactive.length).toBe(all.length);

    const tagged = await marketingApi.getRecipients({ tagIds: ['tag-vip'] });
    expect(tagged.every((item) => item.tags.length > 0)).toBe(true);
  });

  it('posts the filters verbatim and defaults to an empty body', async () => {
    const mock = serve([]);
    await marketingApi.getRecipients({ query: 'amani' });
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/recipients/query');
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toEqual({ query: 'amani' });

    await marketingApi.getRecipients();
    expect(JSON.parse(String(mock.mock.calls[1][1].body))).toEqual({});
  });

  it('splits a selection into deliverable and blocked recipients', async () => {
    offline();
    const pool = await marketingApi.getRecipients();
    const blocked: Recipient = { ...pool[0], id: 'blocked-1', valid: false, invalidReason: 'opted_out' };
    const split = await marketingApi.validateRecipients([pool[0], blocked]);
    expect(split.valid.map((item) => item.id)).toEqual(pool.filter((item) => item.valid).slice(0, 1).map((item) => item.id));
    expect(split.invalid.map((item) => item.id)).toEqual(['blocked-1']);
    expect(split.valid.length + split.invalid.length).toBe(2);
  });

  it('lists the connected marketing channels', async () => {
    const mock = serve(['facebook', 'instagram']);
    await expect(marketingApi.getMarketingChannels()).resolves.toEqual(['facebook', 'instagram']);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/channels');

    offline();
    const local = await marketingApi.getMarketingChannels();
    expect(Array.isArray(local)).toBe(true);
    expect(local.length).toBeGreaterThan(0);
  });
});

describe('marketing api campaigns', () => {
  it('returns the seeded campaigns in status order and pages them', async () => {
    offline();
    const page = await marketingApi.getCampaigns();
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
    expect(page.campaigns.map((item) => item.id)).toEqual(['cmp-running', 'cmp-draft', 'cmp-done']);
    expect(page.campaigns).toEqual(demoCampaigns().campaigns);

    const first = await marketingApi.getCampaigns({ limit: 2, offset: 0 });
    expect(first.campaigns).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await marketingApi.getCampaigns({ limit: 2, offset: 2 });
    expect(second.campaigns.map((item) => item.id)).toEqual(['cmp-done']);
    expect(second.hasMore).toBe(false);
  });

  it('filters the list by status and by free text', async () => {
    offline();
    const running = await marketingApi.getCampaigns({ status: 'running' });
    expect(running.campaigns.map((item) => item.id)).toEqual(['cmp-running']);
    expect((await marketingApi.getCampaigns({ status: 'all' })).total).toBe(3);
    expect((await marketingApi.getCampaigns({ query: 'festival' })).campaigns.map((item) => item.id)).toEqual(['cmp-draft']);
    expect((await marketingApi.getCampaigns({ query: 'nothing matches this' })).total).toBe(0);
  });

  it('serialises list params and skips the empty ones', async () => {
    const mock = serve({ campaigns: [], hasMore: false, total: 0 });
    await marketingApi.getCampaigns({ query: 'denim', status: 'draft', limit: 10, offset: 20 });
    const url = String(mock.mock.calls[0][0]);
    expect(url).toContain('/api/v1/marketing/campaigns?');
    expect(url).toContain('query=denim');
    expect(url).toContain('status=draft');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');

    await marketingApi.getCampaigns({ query: '', status: undefined });
    expect(String(mock.mock.calls[1][0])).toBe('/api/v1/marketing/campaigns');
  });

  it('passes a backend page through untouched', async () => {
    const payload = { campaigns: [{ id: 'srv-1' }], hasMore: true, total: 41 };
    serve(payload);
    await expect(marketingApi.getCampaigns()).resolves.toEqual(payload);
  });

  it('loads one campaign and recomputes its progress and stats', async () => {
    offline();
    const campaign = await marketingApi.getCampaignDetail('cmp-running');
    expect(campaign.id).toBe('cmp-running');
    expect(campaign.progress.total).toBe(campaign.recipientCount);
    expect(campaign.progress.percent).toBeGreaterThanOrEqual(0);
    expect(campaign.progress.percent).toBeLessThanOrEqual(100);
    expect(campaign.stats.delivered).toBeGreaterThanOrEqual(0);
    expect(campaign.stats.openRate).toBeGreaterThanOrEqual(0);
    expect(campaign.stats.openRate).toBeLessThanOrEqual(100);

    const mock = serve({ id: 'srv-1' });
    await marketingApi.getCampaignDetail('srv-1');
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/campaigns/srv-1');
  });

  it('throws NOT_FOUND for an unknown campaign id', async () => {
    offline();
    await expect(marketingApi.getCampaignDetail('cmp-nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    missingBackend();
    await expect(marketingApi.getCampaignDetail('cmp-nope')).rejects.toThrow(ApiError);
  });

  it('creates a draft campaign and bumps the template usage', async () => {
    offline();
    const before = (await marketingApi.getTemplates()).find((item) => item.id === 'tpl-promo');
    const created = await marketingApi.createCampaign(campaignInput());
    expect(created.status).toBe('draft');
    expect(created.recipientCount).toBe(2);
    expect(created.channels).toEqual(['whatsapp']);
    expect(created.progress).toMatchObject({ total: 2, sent: 0, failed: 0, pending: 2, percent: 0 });
    expect(created.startedAt).toBeNull();
    expect(created.demo).toBeUndefined();

    const after = (await marketingApi.getTemplates()).find((item) => item.id === 'tpl-promo');
    expect(after?.usageCount).toBe((before?.usageCount ?? 0) + 1);
    const listed = await marketingApi.getCampaigns();
    expect(listed.total).toBe(4);
    expect(listed.campaigns.some((item) => item.id === created.id)).toBe(true);
    const drafts = listed.campaigns.filter((item) => item.status === 'draft');
    expect(drafts[0].id).toBe(created.id);
  });

  it('walks a campaign through start, pause and cancel', async () => {
    offline();
    const created = await marketingApi.createCampaign(campaignInput({ templateId: undefined }));

    const started = await marketingApi.startCampaign(created.id);
    expect(started.status === 'running' || started.status === 'completed').toBe(true);
    expect(started.startedAt).not.toBeNull();

    const paused = await marketingApi.pauseCampaign(created.id);
    expect(paused.status === 'paused' || paused.status === 'completed').toBe(true);

    const cancelled = await marketingApi.cancelCampaign(created.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.finishedAt).not.toBeNull();
    await expect(marketingApi.startCampaign('cmp-nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reads stats and records for one campaign', async () => {
    offline();
    const stats = await marketingApi.getCampaignStats('cmp-done');
    expect(stats).toMatchObject({
      delivered: expect.any(Number),
      opened: expect.any(Number),
      clicked: expect.any(Number),
      replied: expect.any(Number),
      converted: expect.any(Number)
    });
    expect(stats.converted).toBeLessThanOrEqual(stats.replied);

    const records = await marketingApi.getCampaignRecords('cmp-running', 3);
    expect(records).toHaveLength(3);
    expect(records.every((item) => item.campaignId === 'cmp-running')).toBe(true);
    expect(records.every((item) => item.status === 'sent')).toBe(true);
    expect(await marketingApi.getCampaignRecords('cmp-done')).toHaveLength(1);
    const stamps = records.map((item) => item.sentAt ?? 0);
    expect(stamps).toEqual([...stamps].sort((a, b) => b - a));
    expect(await marketingApi.getCampaignRecords('cmp-nope')).toEqual([]);

    const mock = serve([]);
    await marketingApi.getCampaignRecords('cmp-done', 7);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/campaigns/cmp-done/records?limit=7');
  });

  it('records a delivery and moves the campaign progress forward', async () => {
    offline();
    const created = await marketingApi.createCampaign(campaignInput({ recipientIds: ['u-1', 'u-2'] }));
    await marketingApi.startCampaign(created.id);
    const recipient: Recipient = {
      id: 'u-1',
      name: 'Amani Juma',
      channel: 'whatsapp',
      handle: '+254700000000',
      tags: [],
      valid: true
    };

    const sent = await marketingApi.recordSend(created.id, recipient, 'sent');
    expect(sent.status).toBe('sent');
    expect(sent.sentAt).not.toBeNull();
    expect(sent.campaignName).toBe('September denim push');
    expect(sent.id.startsWith('rec-')).toBe(true);

    const failed = await marketingApi.recordSend(created.id, recipient, 'failed', 'channel rate limited');
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('channel rate limited');
    expect(failed.sentAt).toBeNull();

    const detail = await marketingApi.getCampaignDetail(created.id);
    expect(detail.progress.sent).toBe(1);
    expect(detail.progress.failed).toBe(1);
    expect(detail.progress.pending).toBe(0);
    expect(detail.progress.percent).toBe(100);
    await expect(marketingApi.recordSend('cmp-nope', recipient, 'sent')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('requeues failed deliveries and reports how many', async () => {
    offline();
    expect(await marketingApi.retryFailed('cmp-running')).toBe(1);
    const after = await marketingApi.getCampaignRecords('cmp-running', 50);
    expect(after.filter((item) => item.status === 'failed')).toHaveLength(0);
    expect(after.some((item) => item.status === 'pending')).toBe(true);
    expect(await marketingApi.retryFailed('cmp-running')).toBe(0);
    await expect(marketingApi.retryFailed('cmp-nope')).rejects.toThrow(ApiError);

    const mock = serve({ retried: 4 });
    await expect(marketingApi.retryFailed('cmp-running')).resolves.toBe(4);
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/campaigns/cmp-running/retry');
  });
});

describe('marketing api history and overview', () => {
  it('pages the send history newest first', async () => {
    offline();
    const page = await marketingApi.getSendHistory();
    expect(page.total).toBeGreaterThan(0);
    expect(page.records).toHaveLength(Math.min(20, page.total));
    expect(page).toEqual(demoSendHistory());
    const stamps = page.records.map((item) => item.sentAt ?? 0);
    expect(stamps).toEqual([...stamps].sort((a, b) => b - a));

    const first = await marketingApi.getSendHistory({ limit: 2, offset: 0 });
    expect(first.hasMore).toBe(true);
    const second = await marketingApi.getSendHistory({ limit: 2, offset: 2 });
    expect(second.records[0].id).not.toBe(first.records[0].id);
  });

  it('filters the history by campaign and by day window', async () => {
    offline();
    const done = await marketingApi.getSendHistory({ campaignId: 'cmp-done' });
    expect(done.records.every((item) => item.campaignId === 'cmp-done')).toBe(true);
    expect(done.total).toBeGreaterThan(0);
    expect((await marketingApi.getSendHistory({ campaignId: 'cmp-nope' })).total).toBe(0);

    const future = await marketingApi.getSendHistory({ from: Date.now() + 86400000 });
    expect(future.total).toBe(0);
    const ancient = await marketingApi.getSendHistory({ to: 1 });
    expect(ancient.total).toBe(0);
    const runningAll = await marketingApi.getSendHistory({ campaignId: 'cmp-running' });
    const recent = await marketingApi.getSendHistory({ from: Date.now() - 86400000 });
    expect(recent.total).toBe(runningAll.records.filter((item) => item.sentAt !== null).length);
    expect(recent.total).toBeGreaterThan(0);
    const windowed = await marketingApi.getSendHistory({ from: Date.now() - 3 * 86400000 });
    expect(windowed.total).toBe(recent.total + done.total);
    expect(windowed.total).toBeLessThanOrEqual(runningAll.total + done.total);
  });

  it('serialises history params into the query string', async () => {
    const mock = serve({ records: [], hasMore: false, total: 0 });
    await marketingApi.getSendHistory({ from: 1000, to: 2000, campaignId: 'cmp-1', limit: 5, offset: 10 });
    const url = String(mock.mock.calls[0][0]);
    expect(url).toContain('/api/v1/marketing/history?');
    expect(url).toContain('from=1000');
    expect(url).toContain('to=2000');
    expect(url).toContain('campaignId=cmp-1');
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
    await marketingApi.getSendHistory();
    expect(String(mock.mock.calls[1][0])).toBe('/api/v1/marketing/history');
  });

  it('summarises the month for the dashboard header', async () => {
    offline();
    const overview = await marketingApi.getMarketingOverview();
    expect(overview.monthSent).toBeGreaterThan(0);
    expect(overview.activeCampaigns).toBe(1);
    expect(overview.monthOpenRate).toBeGreaterThanOrEqual(0);
    expect(overview.monthConversionRate).toBeLessThanOrEqual(100);

    const mock = serve({ monthSent: 1, monthOpenRate: 2, monthConversionRate: 3, activeCampaigns: 4 });
    await expect(marketingApi.getMarketingOverview()).resolves.toMatchObject({ activeCampaigns: 4 });
    expect(String(mock.mock.calls[0][0])).toBe('/api/v1/marketing/overview');
  });

  it('rethrows a 5xx on a read instead of serving demo numbers', async () => {
    serverError(503);
    await expect(marketingApi.getMarketingOverview()).rejects.toMatchObject({ code: 'HTTP_503' });
    await expect(marketingApi.getCampaigns()).rejects.toThrow(ApiError);
    await expect(marketingApi.getSendHistory()).rejects.toThrow(ApiError);
  });
});
