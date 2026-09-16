import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMarketingStore } from '../stores/marketing';
import { CAMPAIGN_PAGE_SIZE, HISTORY_PAGE_SIZE } from '../stores/marketing';
import { ApiError } from '../api/http';
import { demoResetMarketing } from '../api/demoMarketing';
import { composeContent } from '../lib/marketingContent';
import type { Campaign, MarketingContent, Recipient, SendRecord } from '../types';
import { DEFAULT_SEND_SETTINGS, RATE_LIMITS } from '../types';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({ success: ok, code: ok ? 'OK' : 'HTTP_' + status, message: 'nope', data })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

function serveOnce(...pages: unknown[]) {
  let mock = vi.fn();
  for (const page of pages) mock = mock.mockResolvedValueOnce(jsonResponse(page));
  vi.stubGlobal('fetch', mock.mockResolvedValue(jsonResponse(null, false, 500)));
  return mock;
}

function hardFail(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

const NOW = new Date(2026, 8, 7, 9, 0).getTime();

function content(patch: Partial<MarketingContent> = {}): MarketingContent {
  return {
    ...composeContent(
      {
        prompt: 'Weekend flash sale',
        goal: 'promotion',
        audience: 'Nairobi denim buyers',
        language: 'en',
        tone: 'friendly',
        length: 'standard'
      },
      NOW
    ),
    ...patch
  };
}

function recipient(id: string, valid = true): Recipient {
  return {
    id,
    name: 'Recipient ' + id,
    channel: 'whatsapp',
    handle: '+25470000' + id,
    tags: [],
    valid,
    invalidReason: valid ? undefined : 'opted_out'
  };
}

function record(id: string, patch: Partial<SendRecord> = {}): SendRecord {
  return {
    id,
    campaignId: 'cmp-1',
    campaignName: 'Campaign',
    recipientId: 'u-1',
    recipientName: 'Amani',
    channel: 'whatsapp',
    status: 'sent',
    sentAt: NOW,
    opened: false,
    clicked: false,
    replied: false,
    ...patch
  };
}

let store: ReturnType<typeof useMarketingStore>;

beforeEach(() => {
  localStorage.clear();
  demoResetMarketing();
  setActivePinia(createPinia());
  store = useMarketingStore();
  offline();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('marketing store overview and campaigns', () => {
  it('loads the demo overview without leaving the loading flag on', async () => {
    const overview = await store.fetchOverview();
    expect(overview.activeCampaigns).toBe(1);
    expect(overview.monthSent).toBeGreaterThan(0);
    expect(store.overview).toEqual(overview);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('stores an i18n key and empty numbers when the overview call fails', async () => {
    hardFail(500);
    const overview = await store.fetchOverview();
    expect(overview).toEqual({
      monthSent: 0,
      monthOpenRate: 0,
      monthConversionRate: 0,
      activeCampaigns: 0
    });
    expect(store.error).toBe('api.500');
    store.resetError();
    expect(store.error).toBeNull();
  });

  it('splits the campaign list into the buckets the dashboard shows', async () => {
    const list = await store.fetchCampaigns();
    expect(list).toHaveLength(3);
    expect(store.campaignsTotal).toBe(3);
    expect(store.campaignsHasMore).toBe(false);
    expect(store.activeCampaigns.map((item) => item.id)).toEqual(['cmp-running']);
    expect(store.draftCampaigns.map((item) => item.id)).toEqual(['cmp-draft']);
    expect(store.completedCampaigns.map((item) => item.id)).toEqual(['cmp-done']);
    expect(store.hasDemoData).toBe(true);
    expect(store.loading).toBe(false);
  });

  it('sends the page size and appends deduplicated pages', async () => {
    const campaign = (id: string, status: Campaign['status']): Campaign => ({
      id,
      name: id,
      status,
      content: content(),
      recipientCount: 1,
      channels: ['whatsapp'],
      settings: { ...DEFAULT_SEND_SETTINGS },
      progress: { total: 1, sent: 0, failed: 0, pending: 1, percent: 0, ratePerMinute: 0 },
      stats: {
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        converted: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        conversionRate: 0
      },
      createdAt: NOW,
      startedAt: null,
      finishedAt: null
    });
    const mock = serveOnce(
      { campaigns: [campaign('c1', 'draft'), campaign('c2', 'draft')], hasMore: true, total: 3 },
      { campaigns: [campaign('c2', 'draft'), campaign('c3', 'draft')], hasMore: false, total: 3 }
    );

    await store.fetchCampaigns();
    expect(String(mock.mock.calls[0][0])).toContain('limit=' + CAMPAIGN_PAGE_SIZE);
    expect(store.campaigns.map((item) => item.id)).toEqual(['c1', 'c2']);
    expect(store.campaignsHasMore).toBe(true);

    await store.fetchCampaigns({ offset: 2 });
    expect(String(mock.mock.calls[1][0])).toContain('offset=2');
    expect(store.campaigns.map((item) => item.id)).toEqual(['c1', 'c2', 'c3']);
    expect(store.campaignsTotal).toBe(3);
    expect(store.campaignsHasMore).toBe(false);
  });

  it('keeps the previous list when a reload fails', async () => {
    await store.fetchCampaigns();
    const before = store.campaigns.length;
    hardFail(503);
    const list = await store.fetchCampaigns();
    expect(list).toHaveLength(before);
    expect(store.error).toBe('api.500');
  });

  it('loads one campaign and derives the clamped send rate', async () => {
    const campaign = await store.fetchCampaign('cmp-running');
    expect(campaign?.id).toBe('cmp-running');
    expect(store.currentCampaign?.id).toBe('cmp-running');
    expect(store.stats).toEqual(campaign?.stats);
    expect(store.sendRate).toEqual({ perMinute: 10, intervalMs: 6000 });
    expect(store.sendRate.intervalMs).toBeGreaterThanOrEqual(RATE_LIMITS.minIntervalMs);
  });

  it('falls back to the default rate and a null campaign on a miss', async () => {
    expect(store.sendRate).toEqual({ perMinute: 10, intervalMs: 6000 });
    const missing = await store.fetchCampaign('cmp-nope');
    expect(missing).toBeNull();
    expect(store.currentCampaign).toBeNull();
    expect(store.stats).toBeNull();
    expect(store.error).toBe('api.404');
  });

  it('prepends a created campaign and bumps the total', async () => {
    await store.fetchCampaigns();
    const created = await store.createCampaign({
      name: 'September denim push',
      content: content(),
      templateId: 'tpl-promo',
      recipientIds: ['u-1', 'u-2'],
      filters: { tagIds: [], channels: ['whatsapp'], activity: 'all', query: '' },
      settings: { ...DEFAULT_SEND_SETTINGS }
    });
    expect(created?.status).toBe('draft');
    expect(store.campaigns[0].id).toBe(created?.id);
    expect(store.campaignsTotal).toBe(4);
    expect(store.currentCampaign?.id).toBe(created?.id);
    expect(store.saving).toBe(false);

    hardFail(500);
    await expect(
      store.createCampaign({
        name: 'x',
        content: content(),
        recipientIds: [],
        filters: { tagIds: [], channels: ['whatsapp'], activity: 'all', query: '' },
        settings: { ...DEFAULT_SEND_SETTINGS }
      })
    ).resolves.toBeNull();
    expect(store.error).toBe('api.500');
    expect(store.saving).toBe(false);
  });

  it('applies a transition to both the list and the open campaign', async () => {
    await store.fetchCampaigns();
    await store.fetchCampaign('cmp-running');

    const paused = await store.runTransition('cmp-running', 'pause');
    expect(paused?.status === 'paused' || paused?.status === 'completed').toBe(true);
    expect(store.campaigns.find((item) => item.id === 'cmp-running')?.status).toBe(paused?.status);
    expect(store.currentCampaign?.status).toBe(paused?.status);

    const cancelled = await store.runTransition('cmp-running', 'cancel');
    expect(cancelled?.status).toBe('cancelled');
    expect(store.completedCampaigns.some((item) => item.id === 'cmp-running')).toBe(true);

    await store.runTransition('cmp-draft', 'start');
    expect(store.campaigns.find((item) => item.id === 'cmp-draft')?.status).not.toBe('draft');

    hardFail(500);
    await expect(store.runTransition('cmp-draft', 'start')).resolves.toBeNull();
    expect(store.error).toBe('api.500');
  });

  it('reads and prepends delivery records, capped at two hundred', async () => {
    const records = await store.fetchRecords('cmp-running', 5);
    expect(records).toHaveLength(5);
    expect(store.records).toEqual(records);

    const sent = await store.recordSend('cmp-running', recipient('u-9'), 'sent');
    expect(sent?.status).toBe('sent');
    expect(store.records[0].id).toBe(sent?.id);

    const failed = await store.recordSend('cmp-running', recipient('u-9'), 'failed', 'blocked');
    expect(failed?.failureReason).toBe('blocked');
    expect(store.records[1].id).toBe(sent?.id);

    store.records = Array.from({ length: 250 }, (_, index) => record('r' + index));
    await store.recordSend('cmp-running', recipient('u-9'), 'sent');
    expect(store.records).toHaveLength(200);
  });

  it('never lets a dropped telemetry row break a batch', async () => {
    hardFail(500);
    await expect(store.recordSend('cmp-1', recipient('u-1'), 'sent')).resolves.toBeNull();
    expect(store.error).toBeNull();
    expect(store.records).toEqual([]);
  });

  it('requeues failures and refreshes the open campaign', async () => {
    await store.fetchCampaign('cmp-running');
    const retried = await store.retryFailed('cmp-running');
    expect(retried).toBe(1);
    expect(store.currentCampaign?.id).toBe('cmp-running');
    expect(store.saving).toBe(false);

    hardFail(500);
    await expect(store.retryFailed('cmp-running')).resolves.toBe(0);
    expect(store.error).toBe('api.500');
  });

  it('returns an empty record list when the read fails', async () => {
    hardFail(500);
    await expect(store.fetchRecords('cmp-running')).resolves.toEqual([]);
    expect(store.error).toBe('api.500');
  });
});
describe('marketing store templates', () => {
  it('lists templates and derives the category tabs', async () => {
    const list = await store.fetchTemplates();
    expect(list).toHaveLength(5);
    expect(store.templates).toEqual(list);
    expect(store.templateCategories).toEqual(['promotion', 'winback', 'new_arrival', 'festival', 'custom']);
    expect(store.loading).toBe(false);

    const filtered = await store.fetchTemplates('winback');
    expect(filtered.every((item) => item.category === 'winback')).toBe(true);
    expect(store.templateCategories).toEqual(['winback']);
  });

  it('keeps the previous list when the fetch fails', async () => {
    await store.fetchTemplates();
    hardFail(500);
    const list = await store.fetchTemplates();
    expect(list).toHaveLength(5);
    expect(store.error).toBe('api.500');
  });

  it('creates, updates, counts a use and deletes a template', async () => {
    await store.fetchTemplates();
    const created = await store.createTemplate({
      name: 'Flash sale',
      category: 'promotion',
      title: 'Two days only',
      content: 'Half price everything.',
      cta: 'Shop now'
    });
    expect(created?.id).toBeTruthy();
    expect(store.templates[0].id).toBe(created?.id);
    expect(store.templates).toHaveLength(6);
    expect(store.saving).toBe(false);

    const updated = await store.updateTemplate(created?.id ?? '', { cta: 'Buy today' });
    expect(updated?.cta).toBe('Buy today');
    expect(store.templates.find((item) => item.id === created?.id)?.cta).toBe('Buy today');

    const used = await store.useTemplate(created?.id ?? '');
    expect(used?.usageCount).toBe(1);
    expect(store.templates.find((item) => item.id === created?.id)?.usageCount).toBe(1);

    await expect(store.deleteTemplate(created?.id ?? '')).resolves.toBe(true);
    expect(store.templates.some((item) => item.id === created?.id)).toBe(false);
  });

  it('ignores an update for a template that is not in the list', async () => {
    await store.fetchTemplates();
    const created = await store.createTemplate({
      name: 'Ghost',
      category: 'custom',
      title: 't',
      content: 'c',
      cta: ''
    });
    store.templates = store.templates.filter((item) => item.id !== created?.id);
    const updated = await store.updateTemplate(created?.id ?? '', { name: 'Renamed' });
    expect(updated?.name).toBe('Renamed');
    expect(store.templates.some((item) => item.id === created?.id)).toBe(false);
    const used = await store.useTemplate(created?.id ?? '');
    expect(used?.usageCount).toBe(1);
    expect(store.templates.some((item) => item.id === created?.id)).toBe(false);
  });

  it('reports failures as i18n keys and null results', async () => {
    hardFail(500);
    await expect(
      store.createTemplate({ name: 'x', category: 'custom', title: 't', content: 'c', cta: '' })
    ).resolves.toBeNull();
    expect(store.error).toBe('api.500');
    await expect(store.updateTemplate('tpl-promo', { name: 'x' })).resolves.toBeNull();
    await expect(store.deleteTemplate('tpl-promo')).resolves.toBe(false);
    await expect(store.useTemplate('tpl-promo')).resolves.toBeNull();
    expect(store.saving).toBe(false);
  });
});

describe('marketing store content and previews', () => {
  it('generates a draft and renders previews for the selected platforms', async () => {
    expect(store.previews).toEqual([]);
    const draft = await store.generateContent({
      prompt: 'Weekend flash sale',
      goal: 'promotion',
      audience: 'Nairobi denim buyers',
      language: 'en',
      tone: 'friendly',
      length: 'standard'
    });
    expect(draft?.id.startsWith('mc-')).toBe(true);
    expect(store.generatedContent?.id).toBe(draft?.id);
    expect(store.previewPlatforms).toEqual(['whatsapp']);
    expect(store.previews).toHaveLength(1);
    expect(store.previews[0].platform).toBe('whatsapp');
    expect(store.saving).toBe(false);
  });

  it('fails the generation without clearing the editor', async () => {
    await store.generateContent({
      prompt: 'Weekend flash sale',
      goal: 'promotion',
      audience: '',
      language: 'en',
      tone: 'friendly',
      length: 'standard'
    });
    const before = store.generatedContent;
    hardFail(500);
    await expect(
      store.generateContent({
        prompt: 'again',
        goal: 'promotion',
        audience: '',
        language: 'en',
        tone: 'friendly',
        length: 'standard'
      })
    ).resolves.toBeNull();
    expect(store.generatedContent).toEqual(before);
    expect(store.error).toBe('api.500');
  });

  it('follows local edits and platform changes', async () => {
    const draft = content();
    store.setContent(draft);
    expect(store.generatedContent?.id).toBe(draft.id);
    expect(store.previews).toHaveLength(1);

    store.setContent({ ...draft, body: 'edited body' });
    expect(store.previews[0].body).toBe('edited body');

    store.setPreviewPlatforms(['instagram', 'tiktok']);
    expect(store.previewPlatforms).toEqual(['instagram', 'tiktok']);
    expect(store.previews.map((item) => item.platform)).toEqual(['instagram', 'tiktok']);

    store.setPreviewPlatforms([]);
    expect(store.previewPlatforms).toEqual(['whatsapp']);
    expect(store.previews).toHaveLength(1);

    store.clearContent();
    expect(store.generatedContent).toBeNull();
    expect(store.previews).toEqual([]);
    store.refreshPreviews();
    expect(store.previews).toEqual([]);
  });

  it('takes the preview platforms from the connected channel registry', async () => {
    store.setContent(content());
    const channels = await store.fetchChannels();
    expect(channels.length).toBeGreaterThan(0);
    expect(store.previewPlatforms).toEqual(channels);
    expect(store.previews.map((item) => item.platform)).toEqual(channels);

    hardFail(500);
    const kept = await store.fetchChannels();
    expect(kept).toEqual(channels);
    expect(store.error).toBe('api.500');
  });

  it('defaults the preview platform when the registry is empty', async () => {
    serveOnce([]);
    store.setContent(content());
    await expect(store.fetchChannels()).resolves.toEqual(['whatsapp']);
    expect(store.previews).toHaveLength(1);
  });
});

describe('marketing store audience selection', () => {
  it('loads the audience and derives the selection getters', async () => {
    const list = await store.fetchRecipients();
    expect(list.length).toBeGreaterThan(0);
    expect(store.recipients).toEqual(list);
    expect(store.loading).toBe(false);

    const blocked = list.find((item) => !item.valid);
    const deliverable = list.find((item) => item.valid);
    store.selectRecipients([deliverable?.id ?? 'u-1', blocked?.id ?? 'u-2', deliverable?.id ?? 'u-1']);
    expect(store.selectedIds).toHaveLength(2);
    expect(store.selectedRecipients).toHaveLength(2);
    expect(store.validSelected.map((item) => item.id)).toEqual([deliverable?.id]);
    expect(store.invalidSelected.length).toBe(blocked ? 1 : 0);
    expect(store.recipientSummary.total).toBe(2);
    expect(store.recipientSummary.valid + store.recipientSummary.invalid).toBe(2);
    expect(store.recipientSummary.byChannel.whatsapp).toBeGreaterThan(0);
  });

  it('prunes a selection that the new filter no longer returns', async () => {
    const list = await store.fetchRecipients();
    store.selectRecipients([list[0].id, 'u-gone']);
    await store.fetchRecipients({ query: list[0].name });
    expect(store.selectedIds).toEqual([list[0].id]);
  });

  it('toggles, selects every visible recipient and clears', async () => {
    const list = await store.fetchRecipients();
    store.toggleRecipient(list[0].id);
    expect(store.selectedIds).toEqual([list[0].id]);
    store.toggleRecipient(list[0].id);
    expect(store.selectedIds).toEqual([]);

    store.selectAllVisible();
    expect(store.selectedIds).toEqual(list.filter((item) => item.valid).map((item) => item.id));
    store.clearSelection();
    expect(store.selectedIds).toEqual([]);
    store.selectAllVisible(false);
    expect(store.selectedIds).toHaveLength(list.length);
    store.selectAllVisible(false);
    expect(store.selectedIds).toHaveLength(list.length);
  });

  it('splits the selection before the send loop starts', async () => {
    const list = await store.fetchRecipients();
    store.selectRecipients(list.map((item) => item.id));
    const split = await store.validateSelection();
    expect(split.valid.length).toBe(store.validSelected.length);
    expect(split.invalid.length).toBe(store.invalidSelected.length);
    expect(split.valid.every((item) => item.valid)).toBe(true);
  });

  it('falls back to the local split and keeps the error key when the api fails', async () => {
    const list = await store.fetchRecipients();
    store.selectRecipients(list.map((item) => item.id));
    hardFail(500);
    const split = await store.validateSelection();
    expect(split.valid).toEqual(store.validSelected);
    expect(split.invalid).toEqual(store.invalidSelected);
    expect(store.error).toBe('api.500');
  });

  it('keeps the audience it already had when a reload fails', async () => {
    const list = await store.fetchRecipients();
    hardFail(500);
    await expect(store.fetchRecipients()).resolves.toEqual(list);
    expect(store.error).toBe('api.500');
  });
});

describe('marketing store history and progress', () => {
  it('loads the first history page with the store page size', async () => {
    const list = await store.fetchHistory();
    expect(list.length).toBeLessThanOrEqual(HISTORY_PAGE_SIZE);
    expect(store.historyTotal).toBe(list.length);
    expect(store.historyHasMore).toBe(false);
    expect(store.loading).toBe(false);
  });

  it('appends deduplicated history pages while there is more', async () => {
    const mock = serveOnce(
      { records: [record('a'), record('b')], hasMore: true, total: 3 },
      { records: [record('b'), record('c')], hasMore: false, total: 3 }
    );

    await store.fetchHistory();
    expect(store.history.map((item) => item.id)).toEqual(['a', 'b']);
    expect(store.historyHasMore).toBe(true);
    expect(String(mock.mock.calls[0][0])).toContain('limit=' + HISTORY_PAGE_SIZE);

    await store.loadMoreHistory();
    expect(store.history.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(String(mock.mock.calls[1][0])).toContain('offset=2');
    expect(store.historyHasMore).toBe(false);

    await store.loadMoreHistory();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('keeps the history it has when a page fails', async () => {
    await store.fetchHistory();
    const before = store.history.length;
    hardFail(500);
    await expect(store.fetchHistory()).resolves.toHaveLength(before);
    expect(store.error).toBe('api.500');
  });

  it('tracks the sending flag from the queue progress', () => {
    expect(store.sending).toBe(false);
    store.setProgress({
      total: 4,
      done: 1,
      failed: 0,
      running: true,
      percent: 25,
      etaMs: 6000,
      currentName: 'Amani',
      ratePerMinute: 10
    });
    expect(store.sending).toBe(true);
    expect(store.progress?.percent).toBe(25);
    store.setProgress({
      total: 4,
      done: 4,
      failed: 1,
      running: false,
      percent: 100,
      etaMs: 0,
      currentName: '',
      ratePerMinute: 0
    });
    expect(store.sending).toBe(false);
    store.setProgress(null);
    expect(store.progress).toBeNull();
    expect(store.sending).toBe(false);
  });

  it('resets every slice back to its empty shape', async () => {
    await store.fetchCampaigns();
    await store.fetchTemplates();
    await store.fetchRecipients();
    await store.fetchHistory();
    store.setContent(content());
    store.selectAllVisible(false);
    store.setProgress({ total: 1, done: 0, failed: 0, running: true, percent: 0, etaMs: 0, currentName: '', ratePerMinute: 0 });

    store.$reset();

    expect(store.campaigns).toEqual([]);
    expect(store.campaignsTotal).toBe(0);
    expect(store.campaignsHasMore).toBe(false);
    expect(store.currentCampaign).toBeNull();
    expect(store.records).toEqual([]);
    expect(store.templates).toEqual([]);
    expect(store.generatedContent).toBeNull();
    expect(store.previews).toEqual([]);
    expect(store.previewPlatforms).toEqual(['whatsapp']);
    expect(store.recipients).toEqual([]);
    expect(store.selectedIds).toEqual([]);
    expect(store.history).toEqual([]);
    expect(store.historyTotal).toBe(0);
    expect(store.historyHasMore).toBe(false);
    expect(store.progress).toBeNull();
    expect(store.sending).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.saving).toBe(false);
    expect(store.error).toBeNull();
    expect(store.overview).toEqual({
      monthSent: 0,
      monthOpenRate: 0,
      monthConversionRate: 0,
      activeCampaigns: 0
    });
    expect(store.hasDemoData).toBe(false);
  });

  it('maps every api error onto a known i18n key', async () => {
    hardFail(403);
    await store.fetchOverview();
    expect(store.error).toBe('api.403');
    hardFail(500);
    await store.fetchTemplates();
    expect(store.error).toBe('api.500');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(new ApiError('PARSE', 'bad payload'))));
    await store.fetchOverview();
    expect(store.error).toBe('api.network');
  });
});
