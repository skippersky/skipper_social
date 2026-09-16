import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import * as marketingApi from '../api/marketing';
import { ApiError } from '../api/http';
import {
  HISTORY_CSV_HEADERS,
  HISTORY_CSV_PREFIX,
  STATUS_FILTERS,
  exportHistory,
  historyCsvRows,
  useMarketing
} from '../composables/useMarketing';
import { EMPTY_TEMPLATE, TEMPLATE_CATEGORIES, useTemplates } from '../composables/useTemplates';
import { DEFAULT_AI_FORM, GENERATE_DEBOUNCE_MS, useAIContent } from '../composables/useAIContent';
import { useBatchSend } from '../composables/useBatchSend';
import type { SendItem } from '../composables/useBatchSend';
import { useMarketingStore } from '../stores/marketing';
import { composeContent } from '../lib/marketingContent';
import {
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  TEMPLATE_TITLE_MAX
} from '../lib/marketingValidation';
import type { CsvDownloadEnv } from '../lib/csv';
import type {
  Campaign,
  MarketingContent,
  MarketingTemplate,
  PagedCampaigns,
  Recipient,
  SendRecord
} from '../types';
import { DEFAULT_SEND_SETTINGS, MARKETING_GOALS } from '../types';

vi.mock('../api/marketing', () => ({
  generateAIContent: vi.fn(),
  previewContent: vi.fn(),
  getTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  useTemplate: vi.fn(),
  getRecipients: vi.fn(),
  validateRecipients: vi.fn(),
  getMarketingChannels: vi.fn(),
  getCampaigns: vi.fn(),
  getCampaignDetail: vi.fn(),
  createCampaign: vi.fn(),
  startCampaign: vi.fn(),
  pauseCampaign: vi.fn(),
  cancelCampaign: vi.fn(),
  getCampaignStats: vi.fn(),
  getCampaignRecords: vi.fn(),
  recordSend: vi.fn(),
  retryFailed: vi.fn(),
  getSendHistory: vi.fn(),
  getMarketingOverview: vi.fn()
}));

const api = vi.mocked(marketingApi);

const NOW = new Date(2026, 8, 7, 9, 0).getTime();

/** One macrotask, so queued microtasks and Vue flushes land first. */
function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), 0);
  });
}

/**
 * useAIContent registers an unmount hook, so it needs a real component
 * instance; the other composables are plain functions.
 */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let captured: T | null = null;
  const app = createApp({
    setup() {
      captured = composable();
      return () => h('div');
    }
  });
  app.mount(document.createElement('div'));
  const value = captured as T;
  return { result: value, unmount: () => app.unmount() };
}

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

function campaign(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    name: 'Denim launch',
    status: 'draft',
    content: content(),
    recipientCount: 3,
    channels: ['whatsapp'],
    settings: { ...DEFAULT_SEND_SETTINGS },
    progress: { total: 3, sent: 0, failed: 0, pending: 3, percent: 0, ratePerMinute: 0 },
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
    finishedAt: null,
    ...patch
  };
}

function recipient(id: string, valid = true): Recipient {
  return {
    id,
    name: 'Recipient ' + id,
    channel: 'whatsapp',
    handle: '+2547000' + id,
    tags: [],
    valid,
    invalidReason: valid ? undefined : 'opted_out'
  };
}

function record(id: string, patch: Partial<SendRecord> = {}): SendRecord {
  return {
    id,
    campaignId: 'cmp-1',
    campaignName: 'Denim launch',
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

function template(id: string, patch: Partial<MarketingTemplate> = {}): MarketingTemplate {
  return {
    id,
    name: 'Template ' + id,
    category: 'promotion',
    title: 'Title ' + id,
    content: 'Body ' + id,
    cta: 'Shop now',
    usageCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  };
}

let store: ReturnType<typeof useMarketingStore>;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.clearAllMocks();
  store = useMarketingStore();
  api.getCampaigns.mockResolvedValue({ campaigns: [campaign()], total: 1, hasMore: false });
  api.getCampaignDetail.mockResolvedValue(campaign());
  api.getCampaignRecords.mockResolvedValue([record('rec-1')]);
  api.getSendHistory.mockResolvedValue({ records: [record('rec-1')], total: 1, hasMore: false });
  api.getMarketingOverview.mockResolvedValue({
    monthSent: 5,
    monthOpenRate: 0.4,
    monthConversionRate: 0.1,
    activeCampaigns: 1
  });
  api.getTemplates.mockResolvedValue([template('tpl-1')]);
  api.createTemplate.mockResolvedValue(template('tpl-new'));
  api.updateTemplate.mockResolvedValue(template('tpl-1', { name: 'Renamed' }));
  api.deleteTemplate.mockResolvedValue(undefined);
  api.useTemplate.mockResolvedValue(template('tpl-1', { usageCount: 1 }));
  api.generateAIContent.mockResolvedValue(content({ id: 'gen-1' }));
  api.previewContent.mockResolvedValue([]);
  api.getRecipients.mockResolvedValue([
    recipient('u-1'),
    recipient('u-2'),
    recipient('u-3'),
    recipient('u-9', false)
  ]);
  api.validateRecipients.mockImplementation(async (list) => ({
    valid: list.filter((item) => item.valid),
    invalid: list.filter((item) => !item.valid)
  }));
  api.getMarketingChannels.mockResolvedValue(['whatsapp', 'instagram']);
  api.startCampaign.mockResolvedValue(campaign({ status: 'running' }));
  api.pauseCampaign.mockResolvedValue(campaign({ status: 'paused' }));
  api.cancelCampaign.mockResolvedValue(campaign({ status: 'cancelled' }));
  api.recordSend.mockImplementation(async (campaignId, target, status) =>
    record('rec-' + target.id, {
      campaignId,
      recipientId: target.id,
      recipientName: target.name,
      status
    })
  );
  api.retryFailed.mockResolvedValue(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMarketing campaign navigation', () => {
  it('offers every campaign status plus the all filter', () => {
    expect(STATUS_FILTERS).toEqual([
      'all',
      'draft',
      'running',
      'paused',
      'completed',
      'cancelled'
    ]);
  });

  it('builds list params from the trimmed query and the status filter', async () => {
    const m = useMarketing();
    expect(m.listParams()).toEqual({ limit: 20, offset: 0 });
    await m.search('  denim  ');
    expect(api.getCampaigns).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: 'denim' });
    expect(m.query.value).toBe('  denim  ');
    await m.filterStatus('running');
    expect(m.statusFilter.value).toBe('running');
    expect(m.listParams(40)).toEqual({
      limit: 20,
      offset: 40,
      query: 'denim',
      status: 'running'
    });
  });

  it('loads the first page then appends deduplicated pages', async () => {
    const m = useMarketing();
    api.getCampaigns.mockResolvedValueOnce({ campaigns: [campaign()], total: 3, hasMore: true });
    await m.refresh();
    expect(m.campaigns.value).toHaveLength(1);
    expect(m.campaignsTotal.value).toBe(3);
    expect(m.hasMore.value).toBe(true);
    expect(m.loading.value).toBe(false);
    api.getCampaigns.mockResolvedValueOnce({
      campaigns: [campaign(), campaign({ id: 'cmp-2' })],
      total: 3,
      hasMore: false
    });
    await m.loadMore();
    expect(api.getCampaigns).toHaveBeenLastCalledWith({ limit: 20, offset: 1 });
    expect(m.campaigns.value.map((item) => item.id)).toEqual(['cmp-1', 'cmp-2']);
    await m.loadMore();
    expect(api.getCampaigns).toHaveBeenCalledTimes(2);
  });

  it('does not page while a list request is still in flight', async () => {
    const m = useMarketing();
    let releasePage: (page: PagedCampaigns) => void = () => undefined;
    api.getCampaigns.mockImplementationOnce(
      () =>
        new Promise<PagedCampaigns>((resolve) => {
          releasePage = resolve;
        })
    );
    const pending = m.refresh();
    expect(m.loading.value).toBe(true);
    await m.loadMore();
    expect(api.getCampaigns).toHaveBeenCalledTimes(1);
    releasePage({ campaigns: [campaign()], total: 3, hasMore: true });
    await pending;
    expect(m.campaigns.value).toHaveLength(1);
    expect(m.loading.value).toBe(false);
  });

  it('opens one campaign together with its delivery records', async () => {
    const m = useMarketing();
    const opened = await m.open('cmp-1');
    expect(opened?.id).toBe('cmp-1');
    expect(api.getCampaignDetail).toHaveBeenCalledWith('cmp-1');
    expect(api.getCampaignRecords).toHaveBeenCalled();
    expect(m.detail.value?.id).toBe('cmp-1');
    expect(m.records.value.map((item) => item.id)).toEqual(['rec-1']);
    expect(m.stats.value).toEqual(opened?.stats ?? null);
  });

  it('returns null when the campaign cannot be opened', async () => {
    const m = useMarketing();
    api.getCampaignDetail.mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'));
    expect(await m.open('missing')).toBeNull();
    expect(api.getCampaignRecords).not.toHaveBeenCalled();
    expect(m.error.value).toBe('api.500');
  });

  it('routes every lifecycle transition through the store', async () => {
    const m = useMarketing();
    /* applyCampaign only mirrors into currentCampaign once it is open. */
    await m.open('cmp-1');
    await m.transition('cmp-1', 'start');
    expect(api.startCampaign).toHaveBeenCalledWith('cmp-1');
    expect(m.detail.value?.status).toBe('running');
    await m.transition('cmp-1', 'pause');
    expect(api.pauseCampaign).toHaveBeenCalledWith('cmp-1');
    expect(m.detail.value?.status).toBe('paused');
    await m.transition('cmp-1', 'cancel');
    expect(api.cancelCampaign).toHaveBeenCalledWith('cmp-1');
    expect(m.detail.value?.status).toBe('cancelled');
    expect(m.saving.value).toBe(false);
  });

  it('builds history params from the range and campaign filters', async () => {
    const m = useMarketing();
    expect(m.historyParams()).toEqual({ limit: 20, offset: 0 });
    m.setHistoryRange(1000, 2000);
    m.setHistoryCampaign('cmp-1');
    expect(m.historyParams(20)).toEqual({
      limit: 20,
      offset: 20,
      from: 1000,
      to: 2000,
      campaignId: 'cmp-1'
    });
    await m.loadHistory();
    expect(api.getSendHistory).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 0,
      from: 1000,
      to: 2000,
      campaignId: 'cmp-1'
    });
    expect(m.historyTotal.value).toBe(1);
    expect(m.history.value).toHaveLength(1);
  });

  it('pages the history only while more rows exist', async () => {
    const m = useMarketing();
    api.getSendHistory.mockResolvedValueOnce({
      records: [record('rec-1')],
      total: 3,
      hasMore: true
    });
    await m.loadHistory();
    expect(m.historyHasMore.value).toBe(true);
    api.getSendHistory.mockResolvedValueOnce({
      records: [record('rec-2'), record('rec-3')],
      total: 3,
      hasMore: false
    });
    await m.loadMoreHistory();
    expect(api.getSendHistory).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }));
    expect(m.history.value.map((item) => item.id)).toEqual(['rec-1', 'rec-2', 'rec-3']);
    expect(m.historyHasMore.value).toBe(false);
    await m.loadMoreHistory();
    expect(api.getSendHistory).toHaveBeenCalledTimes(2);
  });

  it('mirrors the overview and the live progress from the store', async () => {
    const m = useMarketing();
    await store.fetchOverview();
    expect(m.overview.value).toEqual({
      monthSent: 5,
      monthOpenRate: 0.4,
      monthConversionRate: 0.1,
      activeCampaigns: 1
    });
    store.setProgress({
      total: 4,
      done: 1,
      failed: 0,
      running: true,
      percent: 25,
      etaMs: 6000,
      currentName: 'Recipient u-2',
      ratePerMinute: 10
    });
    expect(m.progress.value?.percent).toBe(25);
    expect(m.sending.value).toBe(true);
    store.setProgress(null);
    expect(m.progress.value).toBeNull();
    expect(m.sending.value).toBe(false);
  });
});
describe('send history csv export', () => {
  it('renders one row per record in the documented column order', () => {
    const rows = historyCsvRows([
      record('rec-1'),
      record('rec-2', {
        sentAt: null,
        status: 'failed',
        failureReason: 'channel rate limited',
        opened: true,
        clicked: true,
        replied: true
      })
    ]);
    expect(HISTORY_CSV_HEADERS).toEqual([
      'record_id',
      'campaign',
      'recipient',
      'channel',
      'status',
      'sent_at',
      'opened',
      'clicked',
      'replied',
      'failure_reason'
    ]);
    expect(rows[0]).toEqual([
      'rec-1',
      'Denim launch',
      'Amani',
      'whatsapp',
      'sent',
      new Date(NOW).toISOString(),
      false,
      false,
      false,
      ''
    ]);
    expect(rows[1][5]).toBe('');
    expect(rows[1][6]).toBe(true);
    expect(rows[1][9]).toBe('channel rate limited');
  });

  it('accepts an injected timestamp formatter', () => {
    const rows = historyCsvRows([record('rec-1')], () => 'STAMP');
    expect(rows[0][5]).toBe('STAMP');
  });

  it('names the file after the prefix and the local day', () => {
    const result = exportHistory([record('rec-1')], { now: NOW });
    expect(result.filename).toBe(HISTORY_CSV_PREFIX + '-2026-09-07.csv');
    expect(result.rows).toBe(1);
    expect(result.csv.split(/\r?\n/)[0]).toBe(HISTORY_CSV_HEADERS.join(','));
    expect(result.csv).toContain('Denim launch');
    /* jsdom has no URL.createObjectURL, so the host reports a blocked save. */
    expect(result.downloaded).toBe(false);
  });

  it('downloads through an injected environment', () => {
    const createObjectURL = vi.fn(() => 'blob:kili');
    const revokeObjectURL = vi.fn();
    const env: CsvDownloadEnv = { createObjectURL, revokeObjectURL, document };
    const result = exportHistory([record('rec-1')], { now: NOW, env });
    expect(result.downloaded).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kili');
  });

  it('honours custom headers and a custom prefix', () => {
    const result = exportHistory([], { headers: ['a', 'b'], prefix: 'custom', now: NOW });
    expect(result.filename).toBe('custom-2026-09-07.csv');
    expect(result.rows).toBe(0);
    expect(result.csv).toContain('a,b');
  });

  it('exports whatever the history view currently shows', async () => {
    const m = useMarketing();
    await m.loadHistory();
    const env: CsvDownloadEnv = {
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
      document
    };
    const result = m.exportCsv(undefined, { now: NOW, env });
    expect(result.rows).toBe(1);
    expect(result.downloaded).toBe(true);
    const custom = m.exportCsv([record('a'), record('b')], { now: NOW });
    expect(custom.rows).toBe(2);
    expect(custom.downloaded).toBe(false);
  });
});

describe('useTemplates library', () => {
  it('lists the all tab plus every marketing goal', () => {
    expect(TEMPLATE_CATEGORIES).toEqual(['all', ...MARKETING_GOALS]);
  });

  it('filters the library by category and free text', async () => {
    const t = useTemplates();
    api.getTemplates.mockResolvedValueOnce([
      template('tpl-1', {
        category: 'promotion',
        name: 'Denim push',
        title: 'Big sale',
        content: 'Half price denim'
      }),
      template('tpl-2', {
        category: 'winback',
        name: 'We miss you',
        title: 'Come back',
        content: 'A gift for you'
      })
    ]);
    await t.refresh();
    expect(t.filtered.value.map((item) => item.id)).toEqual(['tpl-1', 'tpl-2']);
    t.search('  denim  ');
    expect(t.filtered.value.map((item) => item.id)).toEqual(['tpl-1']);
    t.search('GIFT');
    expect(t.filtered.value.map((item) => item.id)).toEqual(['tpl-2']);
    t.search('');
    t.filterByCategory('winback');
    expect(t.category.value).toBe('winback');
    expect(t.filtered.value.map((item) => item.id)).toEqual(['tpl-2']);
  });

  it('passes the active category to the api', async () => {
    const t = useTemplates();
    await t.refresh('festival');
    expect(api.getTemplates).toHaveBeenLastCalledWith('festival');
    expect(t.category.value).toBe('festival');
    await t.refresh('all');
    expect(api.getTemplates).toHaveBeenLastCalledWith(undefined);
    await t.refresh();
    expect(api.getTemplates).toHaveBeenLastCalledWith(undefined);
    expect(t.loading.value).toBe(false);
  });

  it('opens the create dialog with an optional preset', () => {
    const t = useTemplates();
    expect(t.dialogOpen.value).toBe(false);
    t.openCreate({ name: 'Seed', category: 'winback' });
    expect(t.dialogOpen.value).toBe(true);
    expect(t.isEditing.value).toBe(false);
    expect(t.draft.value).toEqual({ ...EMPTY_TEMPLATE, name: 'Seed', category: 'winback' });
    expect(t.errors.value).toEqual({});
    t.closeDialog();
    expect(t.dialogOpen.value).toBe(false);
    expect(t.editing.value).toBeNull();
  });

  it('copies an existing template into the editor', () => {
    const t = useTemplates();
    t.openEdit(
      template('tpl-9', {
        name: 'Named',
        title: 'Titled',
        content: 'Body text',
        cta: 'Buy'
      })
    );
    expect(t.isEditing.value).toBe(true);
    expect(t.draft.value).toEqual({
      name: 'Named',
      category: 'promotion',
      title: 'Titled',
      content: 'Body text',
      cta: 'Buy'
    });
    expect(t.canSave.value).toBe(true);
  });

  it('revalidates the draft only after an error was shown', () => {
    const t = useTemplates();
    t.openCreate();
    t.updateDraft({ name: 'X' });
    expect(t.errors.value).toEqual({});
    expect(Object.keys(t.validate()).sort()).toEqual(['content', 'name', 'title']);
    expect(t.errors.value.name).toBe('marketing.error.templateNameLength');
    t.updateDraft({ name: 'Denim push', title: 'Half price', content: 'Body copy here' });
    expect(t.errors.value).toEqual({});
    expect(t.canSave.value).toBe(true);
  });

  it('refuses to save an invalid draft', async () => {
    const t = useTemplates();
    t.openCreate();
    expect(await t.save()).toBeNull();
    expect(api.createTemplate).not.toHaveBeenCalled();
    expect(t.dialogOpen.value).toBe(true);
    expect(Object.keys(t.errors.value).length).toBe(3);
  });

  it('creates, updates and deletes through the store', async () => {
    const t = useTemplates();
    await t.refresh();
    t.openCreate({
      name: 'New one',
      title: 'Hello',
      content: 'Body copy here',
      cta: 'Shop'
    });
    const created = await t.save();
    expect(api.createTemplate).toHaveBeenCalledWith({
      name: 'New one',
      category: 'promotion',
      title: 'Hello',
      content: 'Body copy here',
      cta: 'Shop'
    });
    expect(created?.id).toBe('tpl-new');
    expect(t.dialogOpen.value).toBe(false);
    expect(t.templates.value.map((item) => item.id)).toEqual(['tpl-new', 'tpl-1']);

    t.openEdit(template('tpl-1'));
    const updated = await t.save();
    expect(api.updateTemplate).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ name: 'Template tpl-1' })
    );
    expect(updated?.name).toBe('Renamed');
    expect(t.templates.value.find((item) => item.id === 'tpl-1')?.name).toBe('Renamed');

    expect(await t.remove('tpl-1')).toBe(true);
    expect(api.deleteTemplate).toHaveBeenCalledWith('tpl-1');
    expect(t.templates.value.some((item) => item.id === 'tpl-1')).toBe(false);
    expect(t.saving.value).toBe(false);
  });

  it('keeps the dialog open when saving fails', async () => {
    const t = useTemplates();
    api.createTemplate.mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'));
    t.openCreate({ name: 'New one', title: 'Hello', content: 'Body copy here', cta: 'Shop' });
    expect(await t.save()).toBeNull();
    expect(t.dialogOpen.value).toBe(true);
    expect(t.error.value).toBe('api.500');
    api.deleteTemplate.mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'));
    expect(await t.remove('tpl-1')).toBe(false);
  });

  it('exposes the field limits used by the dialog counters', () => {
    const t = useTemplates();
    expect(t.limits).toEqual({
      name: TEMPLATE_NAME_MAX,
      title: TEMPLATE_TITLE_MAX,
      body: TEMPLATE_BODY_MAX
    });
  });
});
describe('useAIContent generator', () => {
  it('gates generation on a prompt and refinement on feedback', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    expect(ai.form.value).toEqual(DEFAULT_AI_FORM);
    expect(ai.canGenerate.value).toBe(false);
    ai.update({ prompt: '   ' });
    expect(ai.canGenerate.value).toBe(false);
    ai.update({ prompt: 'Denim sale' });
    expect(ai.canGenerate.value).toBe(true);
    expect(ai.canRefine.value).toBe(false);
    await ai.generate();
    expect(ai.canRefine.value).toBe(false);
    ai.feedback.value = 'more playful';
    expect(ai.canRefine.value).toBe(true);
    host.unmount();
  });

  it('builds the request from the trimmed form', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({
      prompt: '  Denim sale ',
      audience: ' Nairobi buyers ',
      language: 'fr',
      tone: 'urgent',
      length: 'short'
    });
    const request = ai.toRequest(false);
    expect(request).toMatchObject({
      prompt: 'Denim sale',
      goal: 'promotion',
      audience: 'Nairobi buyers',
      language: 'fr',
      tone: 'urgent',
      length: 'short'
    });
    expect(request.sourceId).toBeUndefined();
    expect(request.feedback).toBeUndefined();
    await ai.generate();
    expect(api.generateAIContent).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Denim sale', language: 'fr' })
    );
    expect(ai.toRequest(true).feedback).toBe('');
    ai.feedback.value = '  shorter  ';
    const refined = ai.toRequest(true);
    expect(refined.feedback).toBe('shorter');
    expect(refined.sourceId).toBe('gen-1');
    host.unmount();
  });

  it('stores the draft, renders previews and summarises it', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({ prompt: 'Denim sale' });
    const result = await ai.generate();
    expect(result?.id).toBe('gen-1');
    expect(ai.content.value?.id).toBe('gen-1');
    expect(ai.previews.value.map((item) => item.platform)).toEqual(['whatsapp']);
    expect(ai.charCount.value).toBe(result?.body.length ?? 0);
    expect(ai.summary.value.length).toBeGreaterThan(0);
    expect(ai.sendable.value).toBe(true);
    expect(ai.cacheHit.value).toBe(false);
    expect(ai.lastError.value).toBeNull();
    expect(ai.generating.value).toBe(false);
    host.unmount();
  });

  it('shares one request between concurrent callers', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({ prompt: 'Denim sale' });
    let releaseContent: (value: MarketingContent) => void = () => undefined;
    api.generateAIContent.mockImplementationOnce(
      () =>
        new Promise<MarketingContent>((resolve) => {
          releaseContent = resolve;
        })
    );
    const first = ai.generate();
    const second = ai.regenerate();
    expect(ai.generating.value).toBe(true);
    expect(ai.canGenerate.value).toBe(false);
    releaseContent(content({ id: 'gen-shared' }));
    const [a, b] = await Promise.all([first, second]);
    expect(a?.id).toBe('gen-shared');
    expect(b).toBe(a);
    expect(api.generateAIContent).toHaveBeenCalledTimes(1);
    expect(ai.generating.value).toBe(false);
    host.unmount();
  });

  it('flags a semantic cache hit only for an unchanged regenerate', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({ prompt: 'Denim sale' });
    api.generateAIContent.mockResolvedValue(content({ id: 'gen-same' }));
    await ai.generate();
    expect(ai.cacheHit.value).toBe(false);
    await ai.regenerate();
    expect(ai.cacheHit.value).toBe(true);
    ai.feedback.value = 'shorter';
    await ai.refine();
    expect(ai.cacheHit.value).toBe(false);
    expect(api.generateAIContent).toHaveBeenLastCalledWith(
      expect.objectContaining({ feedback: 'shorter', sourceId: 'gen-same' })
    );
    expect(ai.feedback.value).toBe('');
    host.unmount();
  });

  it('surfaces the store error key when generation fails', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({ prompt: 'Denim sale' });
    api.generateAIContent.mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'));
    expect(await ai.generate()).toBeNull();
    expect(ai.lastError.value).toBe('api.500');
    expect(ai.generating.value).toBe(false);
    expect(ai.content.value).toBeNull();
    expect(ai.sendable.value).toBe(false);
    expect(ai.charCount.value).toBe(0);
    host.unmount();
  });

  it('refine is a no-op without a draft or without feedback', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    expect(await ai.refine('louder')).toBeNull();
    expect(api.generateAIContent).not.toHaveBeenCalled();
    ai.update({ prompt: 'Denim sale' });
    await ai.generate();
    expect(await ai.refine('   ')).toBeNull();
    expect(api.generateAIContent).toHaveBeenCalledTimes(1);
    host.unmount();
  });

  it('debounces the auto generate affordance', async () => {
    vi.useFakeTimers();
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.update({ prompt: 'Denim sale' });
    ai.scheduleGenerate();
    ai.scheduleGenerate();
    expect(api.generateAIContent).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(GENERATE_DEBOUNCE_MS);
    expect(api.generateAIContent).toHaveBeenCalledTimes(1);
    host.unmount();
  });

  it('does not schedule while the prompt is blank and honours cancel', async () => {
    vi.useFakeTimers();
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.scheduleGenerate();
    await vi.advanceTimersByTimeAsync(GENERATE_DEBOUNCE_MS);
    expect(api.generateAIContent).not.toHaveBeenCalled();
    ai.update({ prompt: 'Denim sale' });
    ai.scheduleGenerate();
    ai.cancelScheduled();
    await vi.advanceTimersByTimeAsync(GENERATE_DEBOUNCE_MS * 2);
    expect(api.generateAIContent).not.toHaveBeenCalled();
    host.unmount();
  });

  it('cancels a pending auto generate when the host unmounts', async () => {
    vi.useFakeTimers();
    const host = withSetup(useAIContent);
    host.result.update({ prompt: 'Denim sale' });
    host.result.scheduleGenerate();
    host.unmount();
    await vi.advanceTimersByTimeAsync(GENERATE_DEBOUNCE_MS);
    expect(api.generateAIContent).not.toHaveBeenCalled();
  });

  it('turns a template into an editable draft and counts the use', () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    const draft = ai.applyTemplate(
      template('tpl-7', {
        category: 'winback',
        title: 'Come back',
        content: 'We miss you',
        cta: 'Return'
      })
    );
    expect(draft.id).toBe('tpl-tpl-7');
    expect(draft.goal).toBe('winback');
    expect(draft.language).toBe(DEFAULT_AI_FORM.language);
    expect(ai.form.value.goal).toBe('winback');
    expect(ai.form.value.prompt).toBe('Come back');
    expect(ai.content.value?.body).toBe('We miss you');
    expect(ai.previews.value).toHaveLength(1);
    expect(api.useTemplate).toHaveBeenCalledWith('tpl-7');
    host.unmount();
  });

  it('edits the draft in place and clears it on demand', async () => {
    const host = withSetup(useAIContent);
    const ai = host.result;
    ai.updateContent({ body: 'ignored without a draft' });
    expect(ai.content.value).toBeNull();
    ai.update({ prompt: 'Denim sale' });
    await ai.generate();
    ai.updateContent({ body: 'Hand edited' });
    expect(ai.content.value?.body).toBe('Hand edited');
    expect(ai.previews.value[0].body).toContain('Hand edited');
    ai.feedback.value = 'leftover';
    ai.lastError.value = 'api.500';
    ai.clear();
    expect(ai.content.value).toBeNull();
    expect(ai.previews.value).toEqual([]);
    expect(ai.feedback.value).toBe('');
    expect(ai.lastError.value).toBeNull();
    expect(ai.cacheHit.value).toBe(false);
    host.unmount();
  });
});

describe('useBatchSend throttled delivery', () => {
  it('queues only reachable recipients', async () => {
    const b = useBatchSend();
    expect(b.count.value).toBe(0);
    expect(b.blocked.value).toBe(0);
    await b.loadRecipients({ activity: 'active' });
    expect(api.getRecipients).toHaveBeenCalledWith({ activity: 'active' });
    b.selectAll(false);
    expect(b.count.value).toBe(3);
    expect(b.blocked.value).toBe(1);
    expect(b.items.value.map((item) => item.id)).toEqual(['u-1', 'u-2', 'u-3']);
    b.toggle('u-1');
    expect(b.items.value.map((item) => item.id)).toEqual(['u-2', 'u-3']);
    b.select(['u-9']);
    expect(b.count.value).toBe(0);
    expect(b.blocked.value).toBe(1);
    b.clear();
    expect(store.selectedIds).toEqual([]);
  });

  it('validates the selection through the api', async () => {
    const b = useBatchSend();
    await b.loadRecipients();
    b.selectAll(false);
    const result = await b.validate();
    expect(api.validateRecipients).toHaveBeenCalledTimes(1);
    expect(result.valid.map((item) => item.id)).toEqual(['u-1', 'u-2', 'u-3']);
    expect(result.invalid.map((item) => item.id)).toEqual(['u-9']);
  });

  it('estimates the delivery window from the clamped rate', async () => {
    const b = useBatchSend();
    await b.loadRecipients();
    b.selectAll(true);
    const estimate = b.estimate();
    expect(estimate.count).toBe(3);
    expect(estimate.rate).toEqual({ perMinute: 10, intervalMs: 6000 });
    expect(estimate.ms).toBe(12000);
    expect(estimate.text).toBe('12s');
    expect(b.estimate({ perMinute: 120, intervalMs: 10 }).rate).toEqual({
      perMinute: 60,
      intervalMs: 1000
    });
    expect(b.estimate({ perMinute: 0, intervalMs: 90000 }).rate).toEqual({
      perMinute: 1,
      intervalMs: 60000
    });
  });

  it('follows the rate of the open campaign', async () => {
    const b = useBatchSend();
    api.getCampaignDetail.mockResolvedValueOnce(
      campaign({ settings: { ...DEFAULT_SEND_SETTINGS, perMinute: 30, intervalMs: 500 } })
    );
    await store.fetchCampaign('cmp-1');
    expect(store.sendRate).toEqual({ perMinute: 30, intervalMs: 2000 });
    await b.loadRecipients();
    b.selectAll(true);
    const estimate = b.estimate();
    expect(estimate.rate).toEqual({ perMinute: 30, intervalMs: 2000 });
    expect(estimate.ms).toBe(4000);
    expect(estimate.text).toBe('4s');
  });

  it('refuses to start with an empty audience', async () => {
    const b = useBatchSend({ delay: () => Promise.resolve() });
    expect(await b.start('cmp-1')).toBeNull();
    expect(store.progress).toBeNull();
    expect(api.recordSend).not.toHaveBeenCalled();
  });

  it('refuses to start while another batch is running', async () => {
    const b = useBatchSend({ delay: () => Promise.resolve() });
    await b.loadRecipients();
    b.selectAll(true);
    store.setProgress({
      total: 3,
      done: 0,
      failed: 0,
      running: true,
      percent: 0,
      etaMs: 6000,
      currentName: 'Recipient u-1',
      ratePerMinute: 10
    });
    expect(b.running.value).toBe(true);
    expect(await b.start('cmp-1')).toBeNull();
    expect(api.recordSend).not.toHaveBeenCalled();
  });

  it('delivers at the clamped gap and records every send', async () => {
    const gaps: number[] = [];
    const b = useBatchSend({
      delay: (ms) => {
        gaps.push(ms);
        return Promise.resolve();
      }
    });
    await b.loadRecipients();
    b.selectAll(true);
    const summary = await b.start('cmp-1');
    expect(gaps).toEqual([6000, 6000]);
    expect(summary?.total).toBe(3);
    expect(summary?.sent).toBe(3);
    expect(summary?.failed).toBe(0);
    expect(summary?.skipped).toBe(0);
    expect(summary?.cancelled).toBe(false);
    expect(api.recordSend).toHaveBeenCalledTimes(3);
    expect(store.records).toHaveLength(3);
    expect(store.progress?.percent).toBe(100);
    expect(store.progress?.done).toBe(3);
    expect(b.running.value).toBe(false);
    expect(b.lastSummary.value).toEqual(summary);
    expect(b.failures.value).toEqual([]);
    expect(b.retryable.value).toEqual([]);
  });

  it('collects failures and re-queues only what broke', async () => {
    const b = useBatchSend({ delay: () => Promise.resolve() });
    await b.loadRecipients();
    b.selectAll(true);
    const deliver = vi.fn(async (item: SendItem) => {
      if (item.id === 'u-2') throw new Error('channel rate limited');
      return record('rec-' + item.id);
    });
    const summary = await b.start('cmp-1', undefined, deliver);
    expect(deliver).toHaveBeenCalledTimes(3);
    expect(summary?.sent).toBe(2);
    expect(summary?.failed).toBe(1);
    expect(api.recordSend).not.toHaveBeenCalled();
    expect(b.failures.value).toEqual([
      { id: 'u-2', name: 'Recipient u-2', reason: 'channel rate limited' }
    ]);
    expect(b.retryable.value.map((item) => item.id)).toEqual(['u-2']);
    const rerun = await b.rerunFailures('cmp-1', async () => record('rec-retry'));
    expect(rerun?.sent).toBe(1);
    expect(rerun?.failed).toBe(0);
    expect(store.selectedIds).toEqual(['u-2']);
    expect(b.failures.value).toEqual([]);
  });

  it('returns null when there is nothing to retry', async () => {
    const b = useBatchSend({ delay: () => Promise.resolve() });
    expect(await b.rerunFailures('cmp-1')).toBeNull();
    b.resetFailures();
    expect(b.failures.value).toEqual([]);
  });

  it('cancels mid run and reports the skipped remainder', async () => {
    let releaseDelay: () => void = () => undefined;
    const b = useBatchSend({
      delay: () =>
        new Promise<void>((resolve) => {
          releaseDelay = resolve;
        })
    });
    await b.loadRecipients();
    b.selectAll(true);
    const running = b.start('cmp-1');
    await tick();
    expect(b.running.value).toBe(true);
    expect(store.progress?.done).toBe(1);
    b.cancel();
    releaseDelay();
    const summary = await running;
    expect(summary?.cancelled).toBe(true);
    expect(summary?.sent).toBe(1);
    expect(summary?.skipped).toBe(2);
    expect(b.running.value).toBe(false);
    expect(store.progress?.percent).toBe(33);
  });

  it('waits while paused and finishes after resume', async () => {
    const gates: Array<() => void> = [];
    const b = useBatchSend({
      delay: () =>
        new Promise<void>((resolve) => {
          gates.push(resolve);
        })
    });
    await b.loadRecipients();
    b.selectAll(true);
    const running = b.start('cmp-1');
    await tick();
    expect(store.progress?.done).toBe(1);
    expect(gates).toHaveLength(1);
    b.pause();
    expect(b.paused.value).toBe(true);
    gates[0]();
    await tick();
    expect(gates.length).toBeGreaterThan(1);
    expect(store.progress?.done).toBe(1);
    b.resume();
    gates[1]();
    await tick();
    expect(store.progress?.done).toBe(2);
    gates[2]();
    await tick();
    const summary = await running;
    expect(summary?.sent).toBe(3);
    expect(b.paused.value).toBe(false);
  });

  it('clears a finished panel but leaves a running one alone', () => {
    const b = useBatchSend();
    store.setProgress({
      total: 2,
      done: 2,
      failed: 0,
      running: false,
      percent: 100,
      etaMs: 0,
      currentName: '',
      ratePerMinute: 10
    });
    expect(b.running.value).toBe(false);
    b.dismiss();
    expect(store.progress).toBeNull();
    store.setProgress({
      total: 2,
      done: 0,
      failed: 0,
      running: true,
      percent: 0,
      etaMs: 5,
      currentName: 'Recipient u-1',
      ratePerMinute: 10
    });
    b.dismiss();
    expect(store.progress).not.toBeNull();
    expect(b.running.value).toBe(true);
  });

  it('delegates the server side retry and re-exports the formatter', async () => {
    const b = useBatchSend();
    expect(await b.retryFailed('cmp-1')).toBe(1);
    expect(api.retryFailed).toHaveBeenCalledWith('cmp-1');
    expect(b.formatDuration(65000)).toBe('1m 5s');
    expect(b.formatDuration(0)).toBe('0s');
  });

  it('ignores queue controls before a run starts', () => {
    const b = useBatchSend();
    b.pause();
    b.resume();
    b.cancel();
    expect(b.paused.value).toBe(false);
    expect(b.running.value).toBe(false);
  });
});
