import { describe, expect, it, vi } from 'vitest';
import {
  CSV_BOM,
  buildCsvFilename,
  downloadCsv,
  escapeCsvValue,
  isoDay,
  toCsv
} from '../lib/csv';
import type { CsvDownloadEnv } from '../lib/csv';
import {
  backOffRate,
  clampRate,
  createSendQueue,
  estimateDurationMs,
  formatDuration,
  retryableItems
} from '../lib/sendQueue';
import type { QueueFailure, SendQueueItem } from '../lib/sendQueue';
import {
  FEEDBACK_RULES,
  composeBody,
  composeContent,
  contentIdFor,
  copyPartsFor,
  hashPrompt,
  isContentSendable,
  refineContent,
  renderPreview,
  renderPreviews,
  summarizeContent
} from '../lib/marketingContent';
import type { DraftRequest } from '../lib/marketingContent';
import {
  CAMPAIGN_NAME_MAX,
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  TEMPLATE_TITLE_MAX,
  fromDateTimeLocal,
  isCampaignDraftValid,
  isTemplateValid,
  toDateTimeLocal,
  validateCampaignDraft,
  validateCampaignName,
  validateChannels,
  validateContent,
  validateRate,
  validateRecipients,
  validateSchedule,
  validateTemplateForm
} from '../lib/marketingValidation';
import type { CampaignDraft } from '../lib/marketingValidation';
import { CHANNEL_BODY_LIMIT, DEFAULT_SEND_SETTINGS, RATE_LIMITS } from '../types';
import type { MarketingContent, SendSettings } from '../types';

/* ------------------------------------------------------------------- csv */

describe('lib/csv', () => {
  it('quotes only the values that need it', () => {
    expect(escapeCsvValue('plain')).toBe('plain');
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
    expect(escapeCsvValue(42)).toBe('42');
    expect(escapeCsvValue(true)).toBe('true');
  });

  it('builds a CRLF document and pads short rows', () => {
    const csv = toCsv(['id', 'name', 'status'], [
      ['r1', 'Amina, Juma', 'sent'],
      ['r2']
    ]);
    expect(csv).toBe('id,name,status\r\nr1,"Amina, Juma",sent\r\nr2,,\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('names the file after the local day and strips unsafe characters', () => {
    const now = new Date(2026, 8, 7, 13, 30).getTime();
    expect(isoDay(now)).toBe('2026-09-07');
    expect(buildCsvFilename('kili social/history', now)).toBe('kilisocialhistory-2026-09-07.csv');
    expect(buildCsvFilename('kili-social-history', now)).toBe('kili-social-history-2026-09-07.csv');
    expect(buildCsvFilename('///', now)).toBe('export-2026-09-07.csv');
  });

  it('downloads through the browser hooks and reports success', () => {
    const click = vi.fn();
    const created: string[] = [];
    const revoked: string[] = [];
    const link = { style: {} as Record<string, string>, click, href: '', download: '' };
    const env: CsvDownloadEnv = {
      createObjectURL: (blob: Blob) => {
        created.push(blob.type);
        return 'blob:fake';
      },
      revokeObjectURL: (url: string) => revoked.push(url),
      document: {
        createElement: () => link,
        body: { appendChild: vi.fn(), removeChild: vi.fn() }
      } as unknown as Document
    };

    const ok = downloadCsv('out.csv', 'a,b\r\n', env);

    expect(ok).toBe(true);
    expect(created[0]).toContain('text/csv');
    expect(link.download).toBe('out.csv');
    expect(link.href).toBe('blob:fake');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoked).toEqual(['blob:fake']);
  });

  it('returns false when the host cannot create object urls', () => {
    const env: CsvDownloadEnv = {
      createObjectURL: undefined,
      revokeObjectURL: undefined,
      document: null
    };
    expect(downloadCsv('out.csv', 'a', env)).toBe(false);
  });

  it('returns false when the blob write throws', () => {
    const env: CsvDownloadEnv = {
      createObjectURL: () => {
        throw new Error('blocked');
      },
      document: { createElement: () => ({ style: {}, click: vi.fn() }) } as unknown as Document
    };
    expect(downloadCsv('out.csv', 'a', env)).toBe(false);
  });

  it('exposes the bom excel needs', () => {
    expect(CSV_BOM).toBe('\uFEFF');
  });
});

/* ------------------------------------------------------------- sendQueue */

interface Item extends SendQueueItem {
  id: string;
  name: string;
}

function items(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 'r' + (index + 1),
    name: 'Recipient ' + (index + 1)
  }));
}

describe('lib/sendQueue', () => {
  it('clamps the rate and never lets the gap undercut the ceiling', () => {
    expect(clampRate(10, 2000)).toEqual({ perMinute: 10, intervalMs: 6000 });
    expect(clampRate(1000, 10)).toEqual({ perMinute: RATE_LIMITS.maxPerMinute, intervalMs: 1000 });
    expect(clampRate(0, Number.NaN)).toEqual({
      perMinute: RATE_LIMITS.minPerMinute,
      intervalMs: RATE_LIMITS.maxIntervalMs
    });
    expect(clampRate(30, 500).intervalMs).toBe(2000);
  });

  it('estimates the wall clock time of a batch', () => {
    expect(estimateDurationMs(0, { perMinute: 10, intervalMs: 6000 })).toBe(0);
    expect(estimateDurationMs(1, { perMinute: 10, intervalMs: 6000 })).toBe(0);
    expect(estimateDurationMs(5, { perMinute: 10, intervalMs: 6000 })).toBe(24000);
  });

  it('formats a duration for the wizard', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-10)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(3600000)).toBe('1h 0m');
  });

  it('delivers every item and reports progress after each send', async () => {
    const seen: number[] = [];
    const queue = createSendQueue<Item>(items(3), { perMinute: 60, intervalMs: 1000 }, {
      send: async () => undefined,
      onProgress: (progress) => seen.push(progress.done),
      delay: async () => undefined,
      now: (() => {
        let clock = 1000;
        return () => (clock += 1000);
      })()
    });

    const summary = await queue.start();

    expect(summary).toMatchObject({ total: 3, sent: 3, failed: 0, skipped: 0, cancelled: false });
    expect(summary.elapsedMs).toBeGreaterThan(0);
    /* One emit before the loop plus one per item. */
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(queue.progress().percent).toBe(100);
    expect(queue.progress().running).toBe(false);
  });

  it('collects failures without stopping the batch', async () => {
    const queue = createSendQueue<Item>(items(3), { perMinute: 60, intervalMs: 1000 }, {
      send: async (item) => {
        if (item.id === 'r2') throw new Error('channel rate limited');
      },
      onProgress: () => undefined,
      delay: async () => undefined
    });

    const summary = await queue.start();

    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.failures).toEqual([
      { id: 'r2', name: 'Recipient 2', reason: 'channel rate limited' }
    ]);
    expect(retryableItems(items(3), summary.failures)).toEqual([
      { id: 'r2', name: 'Recipient 2' }
    ]);
  });

  it('stringifies a non Error rejection', async () => {
    const queue = createSendQueue<Item>(items(1), { perMinute: 60, intervalMs: 1000 }, {
      send: async () => {
        throw 'boom';
      },
      onProgress: () => undefined,
      delay: async () => undefined
    });
    const summary = await queue.start();
    expect(summary.failures[0].reason).toBe('boom');
  });

  it('stops at the next gap once cancelled and counts the rest as skipped', async () => {
    const delays: number[] = [];
    const queue = createSendQueue<Item>(items(4), { perMinute: 60, intervalMs: 1000 }, {
      send: async () => undefined,
      onProgress: () => undefined,
      delay: async (ms) => {
        delays.push(ms);
        queue.cancel();
      }
    });

    const summary = await queue.start();

    expect(summary.cancelled).toBe(true);
    expect(summary.sent).toBe(1);
    expect(summary.skipped).toBe(3);
    expect(delays).toEqual([1000]);
    expect(queue.progress().running).toBe(false);
  });

  it('waits while paused and continues after resume', async () => {
    const delays: number[] = [];
    let calls = 0;
    const queue = createSendQueue<Item>(items(3), { perMinute: 60, intervalMs: 1000 }, {
      send: async () => undefined,
      onProgress: () => undefined,
      delay: async (ms) => {
        delays.push(ms);
        calls += 1;
        if (calls === 1) queue.pause();
        if (calls === 2) queue.resume();
      }
    });

    expect(queue.isPaused()).toBe(false);
    const summary = await queue.start();

    expect(summary.sent).toBe(3);
    expect(delays).toContain(100);
    expect(queue.isPaused()).toBe(false);
  });

  it('cancel clears a pending pause so the loop can exit', () => {
    const queue = createSendQueue<Item>(items(1), { perMinute: 60, intervalMs: 1000 }, {
      send: async () => undefined,
      onProgress: () => undefined,
      delay: async () => undefined
    });
    queue.pause();
    expect(queue.isPaused()).toBe(true);
    queue.cancel();
    expect(queue.isPaused()).toBe(false);
  });

  it('halves the rate on a channel back off', () => {
    expect(backOffRate({ perMinute: 10, intervalMs: 6000 })).toEqual({
      perMinute: 5,
      intervalMs: 12000
    });
    expect(backOffRate({ perMinute: 1, intervalMs: 60000 })).toEqual({
      perMinute: 1,
      intervalMs: RATE_LIMITS.maxIntervalMs
    });
  });
});

/* ------------------------------------------------------- marketingContent */

function draft(patch: Partial<DraftRequest> = {}): DraftRequest {
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

const NOW = new Date(2026, 8, 7, 9, 0).getTime();

describe('lib/marketingContent', () => {
  it('hashes a prompt into a stable 8 char digest', () => {
    expect(hashPrompt('hello')).toBe(hashPrompt('hello'));
    expect(hashPrompt('hello')).not.toBe(hashPrompt('hello!'));
    expect(hashPrompt('')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashPrompt('swahili text')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('composes deterministic content per length', () => {
    const short = composeContent(draft({ length: 'short' }), NOW);
    const standard = composeContent(draft(), NOW);
    const detailed = composeContent(draft({ length: 'detailed' }), NOW);

    expect(standard.id).toBe(contentIdFor(draft()));
    expect(standard.id.startsWith('mc-')).toBe(true);
    expect(standard.createdAt).toBe(NOW);
    expect(standard.title).toContain('Nairobi denim buyers');
    expect(short.title).toContain('Nairobi denim buyers');
    expect(standard.body.length).toBeGreaterThan(0);
    expect(short.hashtags).toEqual([]);
    expect(short.imageSuggestion).toBe('');
    expect(standard.hashtags.length).toBeGreaterThan(0);
    expect(detailed.imageSuggestion.length).toBeGreaterThan(0);
    expect(detailed.body.length).toBeGreaterThan(standard.body.length);
  });

  it('keeps the id stable for the same inputs so the cache can hit', () => {
    expect(contentIdFor(draft())).toBe(contentIdFor(draft()));
    expect(contentIdFor(draft())).not.toBe(contentIdFor(draft({ tone: 'urgent' })));
    expect(composeContent(draft(), NOW).body).toBe(composeBody(draft()));
  });

  it('falls back to a localized audience when none is given', () => {
    const fr = composeContent(draft({ language: 'fr', audience: '  ' }), NOW);
    const sw = composeContent(draft({ language: 'sw', audience: '' }), NOW);
    expect(fr.title).toContain('nos clients');
    expect(sw.title).toContain('wateja wetu');
    expect(composeContent(draft({ language: 'en', audience: '' }), NOW).title).toContain('our customers');
  });

  it('refines a draft from recognised feedback', () => {
    const source = composeContent(draft(), NOW);
    const playful = refineContent(source, 'make it more playful', NOW + 1);
    expect(playful.content.tone).toBe('playful');
    expect(playful.content.id).toBe(source.id);
    expect(playful.content.title).toBe(source.title);
    expect(playful.applied.some((rule) => rule.action === 'tone')).toBe(true);

    const longer = refineContent(source, 'longer with more detail', NOW + 2);
    expect(longer.content.length).toBe('detailed');

    const discount = refineContent(source, 'add the discount price', NOW + 3);
    expect(discount.notes).toHaveLength(1);
    expect(discount.content.body).toContain(discount.notes[0]);

    const cta = refineContent(source, 'add a cta button', NOW + 4);
    expect(cta.content.cta).not.toBe(source.cta);
    expect(cta.content.body).toContain(cta.notes[0]);
  });

  it('keeps unrecognised feedback visible instead of dropping it', () => {
    const source = composeContent(draft(), NOW);
    const result = refineContent(source, 'zzz qqq', NOW + 5);
    expect(result.applied).toEqual([]);
    expect(result.notes).toEqual(['"zzz qqq"']);
    expect(result.content.body).toContain('"zzz qqq"');
    expect(result.content.tone).toBe(source.tone);
  });

  it('ignores blank feedback and exposes the rule table', () => {
    const source = composeContent(draft(), NOW);
    expect(refineContent(source, '   ', NOW).notes).toEqual([]);
    expect(FEEDBACK_RULES.length).toBeGreaterThan(0);
    expect(FEEDBACK_RULES.every((rule) => rule.matches.length > 0)).toBe(true);
  });

  it('summarizes a body to one line', () => {
    expect(summarizeContent({ body: 'short  body ' })).toBe('short body');
    const long = summarizeContent({ body: 'x'.repeat(300) }, 120);
    expect(long.length).toBe(120);
    expect(long.endsWith('\u2026')).toBe(true);
  });

  it('renders a channel preview with the platform limit', () => {
    const content = composeContent(draft(), NOW);
    const whatsapp = renderPreview('whatsapp', content);
    expect(whatsapp.limit).toBe(CHANNEL_BODY_LIMIT.whatsapp);
    expect(whatsapp.truncated).toBe(false);
    expect(whatsapp.body).toBe(content.body);

    const instagram = renderPreview('instagram', content);
    expect(instagram.body).toContain(content.hashtags.join(' '));
    expect(instagram.charCount).toBe(instagram.body.length);

    expect(renderPreviews(['whatsapp', 'tiktok'], content).map((item) => item.platform)).toEqual([
      'whatsapp',
      'tiktok'
    ]);
  });

  it('truncates a caption that exceeds the platform limit', () => {
    const content: MarketingContent = {
      ...composeContent(draft(), NOW),
      body: 'a'.repeat(3000),
      hashtags: []
    };
    const preview = renderPreview('instagram', content);
    expect(preview.truncated).toBe(true);
    expect(preview.charCount).toBe(3000);
    expect(preview.body.length).toBe(CHANNEL_BODY_LIMIT.instagram);
    expect(preview.body.endsWith('\u2026')).toBe(true);
  });

  it('knows when a draft can be sent', () => {
    const content = composeContent(draft(), NOW);
    expect(isContentSendable(content)).toBe(true);
    expect(isContentSendable(null)).toBe(false);
    expect(isContentSendable({ ...content, title: '  ' })).toBe(false);
    expect(isContentSendable({ ...content, body: '' })).toBe(false);
  });

  it('exposes the copy bank behind a goal', () => {
    const parts = copyPartsFor('en', 'winback');
    expect(parts.title.length).toBeGreaterThan(0);
    expect(parts.benefits.length).toBeGreaterThan(0);
    expect(parts.cta.length).toBeGreaterThan(0);
  });
});

/* ----------------------------------------------------- marketingValidation */

function settings(patch: Partial<SendSettings> = {}): SendSettings {
  return { ...DEFAULT_SEND_SETTINGS, ...patch };
}

describe('lib/marketingValidation', () => {
  it('validates the campaign name', () => {
    expect(validateCampaignName('')).toBe('marketing.error.nameRequired');
    expect(validateCampaignName('   ')).toBe('marketing.error.nameRequired');
    expect(validateCampaignName('a')).toBe('marketing.error.nameLength');
    expect(validateCampaignName('x'.repeat(CAMPAIGN_NAME_MAX + 1))).toBe('marketing.error.nameLength');
    expect(validateCampaignName('Flash sale')).toBeNull();
  });

  it('validates content, recipients and channels', () => {
    expect(validateContent(null)).toBe('marketing.error.contentRequired');
    expect(validateContent(composeContent(draft(), NOW))).toBeNull();
    expect(validateRecipients([])).toBe('marketing.error.recipientsRequired');
    expect(validateRecipients(['r1'])).toBeNull();
    expect(validateChannels([])).toBe('marketing.error.channelsRequired');
    expect(validateChannels(['whatsapp'])).toBeNull();
  });

  it('requires a future timestamp for a scheduled send', () => {
    const now = NOW;
    expect(validateSchedule(settings(), now)).toBeNull();
    expect(validateSchedule(settings({ mode: 'scheduled', scheduledAt: null }), now)).toBe(
      'marketing.error.scheduleRequired'
    );
    expect(validateSchedule(settings({ mode: 'scheduled', scheduledAt: now - 1 }), now)).toBe(
      'marketing.error.schedulePast'
    );
    expect(validateSchedule(settings({ mode: 'scheduled', scheduledAt: now + 60000 }), now)).toBeNull();
  });

  it('keeps the rate inside the product limits', () => {
    expect(validateRate(settings())).toEqual({});
    expect(validateRate(settings({ perMinute: 0 }))).toEqual({
      perMinute: 'marketing.error.rateRange'
    });
    expect(validateRate(settings({ perMinute: RATE_LIMITS.maxPerMinute + 1 }))).toEqual({
      perMinute: 'marketing.error.rateRange'
    });
    expect(validateRate(settings({ perMinute: Number.NaN }))).toEqual({
      perMinute: 'marketing.error.rateRange'
    });
    expect(validateRate(settings({ intervalMs: 10 }))).toEqual({
      intervalMs: 'marketing.error.intervalRange'
    });
    expect(validateRate(settings({ intervalMs: RATE_LIMITS.maxIntervalMs + 1 }))).toEqual({
      intervalMs: 'marketing.error.intervalRange'
    });
  });

  it('runs every wizard rule at once', () => {
    const empty: CampaignDraft = {
      name: '',
      content: null,
      recipientIds: [],
      settings: settings({ channels: [] })
    };
    const errors = validateCampaignDraft(empty, NOW);
    expect(Object.keys(errors).sort()).toEqual([
      'channels',
      'content',
      'name',
      'recipientIds'
    ]);
    expect(isCampaignDraftValid(empty, NOW)).toBe(false);

    const good: CampaignDraft = {
      name: 'September denim push',
      content: composeContent(draft(), NOW),
      recipientIds: ['r1'],
      settings: settings()
    };
    expect(validateCampaignDraft(good, NOW)).toEqual({});
    expect(isCampaignDraftValid(good, NOW)).toBe(true);
  });

  it('validates the template form', () => {
    expect(Object.keys(validateTemplateForm({
      name: '',
      category: 'promotion',
      title: '',
      content: '',
      cta: ''
    })).sort()).toEqual(['content', 'name', 'title']);

    expect(validateTemplateForm({
      name: 'x'.repeat(TEMPLATE_NAME_MAX + 1),
      category: 'promotion',
      title: 'x'.repeat(TEMPLATE_TITLE_MAX + 1),
      content: 'x'.repeat(TEMPLATE_BODY_MAX + 1),
      cta: ''
    })).toEqual({
      name: 'marketing.error.templateNameLength',
      title: 'marketing.error.templateTitleTooLong',
      content: 'marketing.error.templateBodyTooLong'
    });

    const good = {
      name: 'Flash sale',
      category: 'promotion' as const,
      title: 'Two days only',
      content: 'Everything at half price.',
      cta: 'Shop now'
    };
    expect(validateTemplateForm(good)).toEqual({});
    expect(isTemplateValid(good)).toBe(true);
  });

  it('round trips the datetime input', () => {
    const text = toDateTimeLocal(NOW, 30);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const parsed = fromDateTimeLocal(text);
    expect(parsed).not.toBeNull();
    /* Seconds are dropped by the input, so allow up to a minute of slack. */
    expect(Math.abs((parsed as number) - (NOW + 30 * 60000))).toBeLessThan(60000);
    expect(toDateTimeLocal(NOW, 0)).toMatch(/T\d{2}:\d{2}$/);
    expect(fromDateTimeLocal('')).toBeNull();
    expect(fromDateTimeLocal('   ')).toBeNull();
    expect(fromDateTimeLocal('not-a-date')).toBeNull();
  });
});
