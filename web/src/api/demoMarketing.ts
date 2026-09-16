/**
 * Offline demo backend for the AI marketing module (Sprint 11).
 *
 * api/marketing.ts falls back to these functions whenever the real endpoint is
 * missing, so the whole module stays usable without a server. Recipients are
 * derived from the Sprint 7 customer directory and channels from the Sprint 10
 * account registry, which keeps one source of truth: connecting a channel or
 * tagging a customer immediately changes who a campaign can reach.
 *
 * Everything is deterministic. Seeds hash their own ids instead of calling
 * Math.random, so a test that renders the same list twice sees the same rows.
 */
import { ApiError } from './http';
import { demoCustomers, demoSettingsChannels, demoTags } from './demo';
import {
  composeContent,
  hashPrompt,
  refineContent,
  renderPreviews
} from '../lib/marketingContent';
import type {
  AIContentRequest,
  Campaign,
  CampaignInput,
  CampaignListParams,
  CampaignProgress,
  CampaignStats,
  ChannelPlatform,
  ContentPreview,
  MarketingContent,
  MarketingOverview,
  MarketingTemplate,
  PagedCampaigns,
  PagedSendHistory,
  Recipient,
  RecipientFilters,
  RecipientInvalidReason,
  SendHistoryParams,
  SendRecord,
  SendStatus,
  TemplateInput
} from '../types';
import { DEFAULT_SEND_SETTINGS } from '../types';

const MODE_KEY = 'ks-demo-mode';
const CAMPAIGN_KEY = 'ks-marketing-campaigns';
const TEMPLATE_KEY = 'ks-marketing-templates';
const HISTORY_KEY = 'ks-marketing-history';
const SEQ_KEY = 'ks-marketing-content-seq';
const CACHE_KEY = 'ks-marketing-content-cache';

/** A recipient counts as active when they spoke to us inside this window. */
export const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 20;

function enterDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/** Stable 0..1 pseudo-random value derived from a string seed. */
export function seeded(seed: string): number {
  const digest = parseInt(hashPrompt(seed), 16);
  return (digest % 10000) / 10000;
}

function nextSeq(prefix: string): string {
  const current = readJson<number>(SEQ_KEY) ?? 0;
  const next = current + 1;
  writeJson(SEQ_KEY, next);
  return prefix + '-' + next.toString(36) + '-' + hashPrompt(String(next));
}

/* ---------------------------------------------------------------- templates */

const TEMPLATE_SEEDS: Array<{
  id: string;
  name: string;
  category: MarketingTemplate['category'];
  title: string;
  content: string;
  cta: string;
  usageCount: number;
}> = [
  {
    id: 'tpl-promo',
    name: 'Weekend promotion',
    category: 'promotion',
    title: 'Weekend offer inside',
    content:
      'Hello {audience}, this weekend only we take 15 percent off every kitenge and kanga in the shop.\n\nStock is limited and the offer closes on Sunday evening.\n\nReply STOP to opt out.',
    cta: 'Shop the weekend sale',
    usageCount: 12
  },
  {
    id: 'tpl-arrival',
    name: 'New arrival alert',
    category: 'new_arrival',
    title: 'The new collection just landed',
    content:
      'Hi {audience}, the new handwoven collection is now in store.\n\nEleven new patterns, small batches, and free delivery inside the city this week.',
    cta: 'See what is new',
    usageCount: 7
  },
  {
    id: 'tpl-festival',
    name: 'Festival greeting',
    category: 'festival',
    title: 'Happy holidays from our team',
    content:
      'Happy holidays {audience}. Thank you for shopping with us this year.\n\nWe stay open every day of the festival except the first morning.',
    cta: 'View holiday hours',
    usageCount: 4
  },
  {
    id: 'tpl-winback',
    name: 'We miss you',
    category: 'winback',
    title: 'It has been a while',
    content:
      'Hello {audience}, we have not seen you in a while.\n\nHere is a personal code, WELCOME10, for ten percent off your next order.',
    cta: 'Use my code',
    usageCount: 9
  },
  {
    id: 'tpl-custom',
    name: 'Blank canvas',
    category: 'custom',
    title: 'A note for {audience}',
    content: 'Write your own message here, then let the assistant polish it.',
    cta: 'Learn more',
    usageCount: 0
  }
];

function seedTemplates(now: number): MarketingTemplate[] {
  return TEMPLATE_SEEDS.map((seed, index) => ({
    id: seed.id,
    name: seed.name,
    category: seed.category,
    title: seed.title,
    content: seed.content,
    cta: seed.cta,
    usageCount: seed.usageCount,
    createdAt: now - (TEMPLATE_SEEDS.length - index) * 86400000,
    updatedAt: now - (TEMPLATE_SEEDS.length - index) * 43200000,
    demo: true
  }));
}

function readTemplates(): MarketingTemplate[] {
  const stored = readJson<MarketingTemplate[]>(TEMPLATE_KEY);
  if (stored && stored.length > 0) return stored;
  const seededList = seedTemplates(Date.now());
  writeJson(TEMPLATE_KEY, seededList);
  return seededList;
}

function writeTemplates(list: MarketingTemplate[]): void {
  writeJson(TEMPLATE_KEY, list);
}

/** Sorted by usefulness: the most applied template comes first. */
export function demoTemplates(category?: MarketingTemplate['category']): MarketingTemplate[] {
  enterDemoMode();
  const list = readTemplates();
  const filtered = category ? list.filter((item) => item.category === category) : list;
  return filtered
    .slice()
    .sort((a, b) => b.usageCount - a.usageCount || b.updatedAt - a.updatedAt);
}

export function demoTemplateById(id: string): MarketingTemplate {
  enterDemoMode();
  const found = readTemplates().find((item) => item.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'template not found');
  return { ...found };
}

export function demoCreateTemplate(input: TemplateInput, now = Date.now()): MarketingTemplate {
  enterDemoMode();
  const record: MarketingTemplate = {
    id: nextSeq('tpl'),
    name: input.name.trim(),
    category: input.category,
    title: input.title.trim(),
    content: input.content,
    cta: input.cta.trim(),
    usageCount: 0,
    createdAt: now,
    updatedAt: now
  };
  const list = readTemplates();
  list.unshift(record);
  writeTemplates(list);
  return { ...record };
}

export function demoUpdateTemplate(
  id: string,
  patch: Partial<TemplateInput>,
  now = Date.now()
): MarketingTemplate {
  enterDemoMode();
  const list = readTemplates();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) throw new ApiError('NOT_FOUND', 'template not found');
  const current = list[index];
  const next: MarketingTemplate = {
    ...current,
    name: patch.name?.trim() || current.name,
    category: patch.category ?? current.category,
    title: patch.title?.trim() || current.title,
    content: patch.content ?? current.content,
    cta: patch.cta?.trim() ?? current.cta,
    updatedAt: now
  };
  list[index] = next;
  writeTemplates(list);
  return { ...next };
}

export function demoDeleteTemplate(id: string): void {
  enterDemoMode();
  writeTemplates(readTemplates().filter((item) => item.id !== id));
}

/** Applying a template to a campaign counts as one use. */
export function demoUseTemplate(id: string, now = Date.now()): MarketingTemplate {
  enterDemoMode();
  const list = readTemplates();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) throw new ApiError('NOT_FOUND', 'template not found');
  const next = { ...list[index], usageCount: list[index].usageCount + 1, updatedAt: now };
  list[index] = next;
  writeTemplates(list);
  return { ...next };
}

/* ----------------------------------------------------------------- content */

/** Keeps recent drafts so a refinement can find the draft it refines. */
function rememberContent(content: MarketingContent): void {
  const list = readJson<MarketingContent[]>(CACHE_KEY) ?? [];
  const next = list.filter((item) => item.id !== content.id);
  next.unshift(content);
  writeJson(CACHE_KEY, next.slice(0, CACHE_LIMIT));
}

export function demoCachedContent(id: string): MarketingContent | null {
  const list = readJson<MarketingContent[]>(CACHE_KEY) ?? [];
  return list.find((item) => item.id === id) ?? null;
}

/**
 * Offline stand-in for the Qwen call. The copy bank in lib/marketingContent is
 * deterministic, so the Sprint 0 semantic cache rule still holds: the same
 * prompt, goal, language, tone and length always produce the same draft id.
 */
export function demoGenerateContent(request: AIContentRequest, now = Date.now()): MarketingContent {
  enterDemoMode();
  if (request.sourceId && request.feedback && request.feedback.trim()) {
    const source = demoCachedContent(request.sourceId);
    if (source) {
      const refined = refineContent(source, request.feedback, now).content;
      rememberContent(refined);
      return refined;
    }
  }
  const content = composeContent(
    {
      prompt: request.prompt,
      goal: request.goal,
      audience: request.audience,
      language: request.language,
      tone: request.tone,
      length: request.length
    },
    now
  );
  rememberContent(content);
  return content;
}

export function demoPreviewContent(
  content: MarketingContent,
  platforms: ChannelPlatform[]
): ContentPreview[] {
  return renderPreviews(platforms.length > 0 ? platforms : ['whatsapp'], content);
}

/* -------------------------------------------------------------- recipients */

export const DEFAULT_RECIPIENT_FILTERS: RecipientFilters = {
  tagIds: [],
  channels: ['whatsapp'],
  activity: 'all',
  query: ''
};

/** Merchant accounts that can actually carry a campaign, Sprint 10 registry. */
export function demoMarketingChannels(): ChannelPlatform[] {
  const connected = demoSettingsChannels()
    .filter((account) => account.status === 'connected')
    .map((account) => account.platform);
  return connected.length > 0 ? Array.from(new Set(connected)) : ['whatsapp'];
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
}

/** WhatsApp delivers to a phone number; the social platforms deliver to a handle. */
function handleFor(platform: ChannelPlatform, phone: string, email: string, name: string): string {
  if (platform === 'whatsapp') return phone;
  if (platform === 'facebook') return email || 'fb.' + slug(name);
  return '@' + slug(name);
}

function invalidReasonFor(
  channels: ChannelPlatform[],
  platform: ChannelPlatform,
  handle: string,
  optedOut: boolean
): RecipientInvalidReason | null {
  if (channels.length === 0 || !channels.includes(platform)) return 'no_channel_account';
  if (!handle) return 'missing_handle';
  return optedOut ? 'opted_out' : null;
}

/**
 * Builds the reachable audience from the customer directory. The channel the
 * recipient is listed under is the first one the campaign asks for that the
 * customer actually uses, so a multi-channel send does not double-count people.
 */
export function demoRecipients(filters?: Partial<RecipientFilters>, now = Date.now()): Recipient[] {
  enterDemoMode();
  const merged: RecipientFilters = { ...DEFAULT_RECIPIENT_FILTERS, ...(filters ?? {}) };
  const wanted: ChannelPlatform[] =
    merged.channels.length > 0 ? merged.channels : ['whatsapp'];
  const query = merged.query.trim().toLowerCase();
  const tagNames = new Map(demoTags().map((tag) => [tag.id, tag.name]));
  const customers = demoCustomers({ limit: 500 }).customers;
  const out: Recipient[] = [];

  for (const customer of customers) {
    if (merged.tagIds.length > 0) {
      const owned = new Set(customer.tags.map((tag) => tag.id));
      if (!merged.tagIds.some((id) => owned.has(id))) continue;
    }
    if (query) {
      const haystack = (customer.name + ' ' + (customer.phone ?? '') + ' ' + (customer.email ?? '')).toLowerCase();
      if (!haystack.includes(query)) continue;
    }
    const isActive =
      customer.lastContactAt !== null && now - customer.lastContactAt <= ACTIVE_WINDOW_MS;
    if (merged.activity === 'active' && !isActive) continue;
    if (merged.activity === 'inactive' && isActive) continue;

    const platform = wanted.find((item) => customer.channels.includes(item)) ?? wanted[0];
    const handle = handleFor(platform, customer.phone?.trim() ?? '', customer.email?.trim() ?? '', customer.name);
    const optedOut = seeded(customer.id + ':optout') < 0.06;
    const reason = invalidReasonFor(customer.channels, platform, handle, optedOut);
    out.push({
      id: customer.id,
      name: customer.name,
      channel: platform,
      handle,
      tags: customer.tags.map((tag) => tagNames.get(tag.id) ?? tag.name),
      valid: reason === null,
      invalidReason: reason ?? undefined
    });
  }
  return out;
}

export function demoRecipientById(id: string): Recipient | null {
  return demoRecipients().find((item) => item.id === id) ?? null;
}

export interface RecipientValidation {
  valid: Recipient[];
  invalid: Recipient[];
}

/** The send loop only ever receives the valid half of this split. */
export function demoValidateRecipients(recipients: readonly Recipient[]): RecipientValidation {
  const valid: Recipient[] = [];
  const invalid: Recipient[] = [];
  for (const item of recipients) (item.valid ? valid : invalid).push(item);
  return { valid, invalid };
}

export interface RecipientSummary {
  total: number;
  valid: number;
  invalid: number;
  byReason: Record<string, number>;
  byChannel: Record<string, number>;
}

export function demoRecipientSummary(recipients: readonly Recipient[]): RecipientSummary {
  const byReason: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  let valid = 0;
  for (const item of recipients) {
    if (item.valid) valid += 1;
    else if (item.invalidReason) byReason[item.invalidReason] = (byReason[item.invalidReason] ?? 0) + 1;
    byChannel[item.channel] = (byChannel[item.channel] ?? 0) + 1;
  }
  return { total: recipients.length, valid, invalid: recipients.length - valid, byReason, byChannel };
}

/* ---------------------------------------------------------------- campaigns */

function emptyProgress(total: number): CampaignProgress {
  return { total, sent: 0, failed: 0, pending: total, percent: 0, ratePerMinute: 0 };
}

function emptyStats(): CampaignStats {
  return {
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    converted: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    conversionRate: 0
  };
}

function rateOf(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Engagement flags are hashed from the record id so a reload shows the same numbers. */
export function statsFrom(records: readonly SendRecord[]): CampaignStats {
  const delivered = records.filter((r) => r.status === 'sent').length;
  const opened = records.filter((r) => r.opened).length;
  const clicked = records.filter((r) => r.clicked).length;
  const replied = records.filter((r) => r.replied).length;
  const converted = records.filter((r) => r.clicked && r.replied).length;
  return {
    delivered,
    opened,
    clicked,
    replied,
    converted,
    openRate: rateOf(opened, delivered),
    clickRate: rateOf(clicked, delivered),
    replyRate: rateOf(replied, delivered),
    conversionRate: rateOf(converted, delivered)
  };
}

/** Measured speed from the first to the last delivery, not the configured rate. */
function measuredRate(records: readonly SendRecord[]): number {
  const stamps = records
    .filter((r) => r.status === 'sent' && r.sentAt !== null)
    .map((r) => r.sentAt as number);
  if (stamps.length < 2) return 0;
  const first = Math.min(...stamps);
  const last = Math.max(...stamps);
  const span = last - first;
  return span > 0 ? Math.round((stamps.length / span) * 60000) : 0;
}

export function progressFrom(
  total: number,
  records: readonly SendRecord[]
): CampaignProgress {
  const sent = records.filter((r) => r.status === 'sent').length;
  const failed = records.filter((r) => r.status === 'failed').length;
  const done = sent + failed;
  return {
    total,
    sent,
    failed,
    pending: Math.max(0, total - done),
    percent: total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0,
    ratePerMinute: measuredRate(records)
  };
}

function draftFor(goal: MarketingContent['goal'], prompt: string, now: number): MarketingContent {
  return composeContent(
    { prompt, goal, audience: '', language: 'en', tone: 'friendly', length: 'standard' },
    now
  );
}

const STATUS_RANK: Record<Campaign['status'], number> = {
  running: 0,
  paused: 1,
  draft: 2,
  completed: 3,
  cancelled: 4
};

function seedCampaigns(now: number): Campaign[] {
  const runningContent = draftFor('promotion', 'Weekend kitenge sale', now - 3600000);
  const doneContent = draftFor('new_arrival', 'Handwoven bags', now - 2 * 86400000);
  const draftContent = draftFor('festival', 'Festival greeting', now - 7200000);
  const base = { ...DEFAULT_SEND_SETTINGS, channels: ['whatsapp'] as ChannelPlatform[] };
  return [
    {
      id: 'cmp-running',
      name: 'Weekend kitenge sale',
      status: 'running',
      content: runningContent,
      templateId: 'tpl-promo',
      recipientCount: 12,
      channels: ['whatsapp'],
      settings: { ...base, mode: 'immediate', scheduledAt: null, perMinute: 10, intervalMs: 2000 },
      progress: emptyProgress(12),
      stats: emptyStats(),
      createdAt: now - 3600000,
      startedAt: now - 240000,
      finishedAt: null,
      demo: true
    },
    {
      id: 'cmp-done',
      name: 'New arrival: handwoven bags',
      status: 'completed',
      content: doneContent,
      templateId: 'tpl-arrival',
      recipientCount: 14,
      channels: ['whatsapp', 'instagram'],
      settings: { ...base, channels: ['whatsapp', 'instagram'], perMinute: 20, intervalMs: 3000 },
      progress: emptyProgress(14),
      stats: emptyStats(),
      createdAt: now - 2 * 86400000,
      startedAt: now - 2 * 86400000 + 60000,
      finishedAt: now - 2 * 86400000 + 660000,
      demo: true
    },
    {
      id: 'cmp-draft',
      name: 'Festival greeting',
      status: 'draft',
      content: draftContent,
      templateId: 'tpl-festival',
      recipientCount: 8,
      channels: ['whatsapp'],
      settings: { ...base, mode: 'scheduled', scheduledAt: now + 86400000, perMinute: 10 },
      progress: emptyProgress(8),
      stats: emptyStats(),
      createdAt: now - 7200000,
      startedAt: null,
      finishedAt: null,
      demo: true
    }
  ];
}

function seedHistory(now: number, campaigns: Campaign[]): SendRecord[] {
  const audience = demoRecipients({ channels: ['whatsapp', 'instagram'] }, now);
  const records: SendRecord[] = [];
  const running = campaigns.find((item) => item.id === 'cmp-running');
  const done = campaigns.find((item) => item.id === 'cmp-done');

  audience.slice(0, 7).forEach((recipient, index) => {
    if (!running) return;
    const failed = index === 6;
    records.push(makeRecord(running, recipient, failed ? 'failed' : 'sent', now - 240000 + index * 20000, failed ? 'channel rate limited' : undefined));
  });

  audience.slice(7, 21).forEach((recipient, index) => {
    if (!done) return;
    records.push(makeRecord(done, recipient, 'sent', now - 2 * 86400000 + 60000 + index * 30000));
  });

  return records;
}

function makeRecord(
  campaign: Campaign,
  recipient: Recipient,
  status: SendStatus,
  sentAt: number | null,
  failureReason?: string
): SendRecord {
  const id = 'rec-' + hashPrompt(campaign.id + recipient.id + String(sentAt));
  const delivered = status === 'sent';
  return {
    id,
    campaignId: campaign.id,
    campaignName: campaign.name,
    recipientId: recipient.id,
    recipientName: recipient.name,
    channel: recipient.channel,
    status,
    failureReason,
    sentAt: delivered ? sentAt : null,
    opened: delivered && seeded(id + ':open') < 0.62,
    clicked: delivered && seeded(id + ':click') < 0.28,
    replied: delivered && seeded(id + ':reply') < 0.17
  };
}

function readCampaigns(now = Date.now()): Campaign[] {
  const stored = readJson<Campaign[]>(CAMPAIGN_KEY);
  if (stored && stored.length > 0) return stored;
  const seededList = seedCampaigns(now);
  writeJson(CAMPAIGN_KEY, seededList);
  writeJson(HISTORY_KEY, seedHistory(now, seededList));
  return seededList;
}

function writeCampaigns(list: Campaign[]): void {
  writeJson(CAMPAIGN_KEY, list);
}

function readHistory(): SendRecord[] {
  return readJson<SendRecord[]>(HISTORY_KEY) ?? [];
}

function writeHistory(records: SendRecord[]): void {
  writeJson(HISTORY_KEY, records);
}

/** Recomputes progress, stats and completion for one campaign, then persists it. */
function sync(campaign: Campaign, now = Date.now()): Campaign {
  const records = readHistory().filter((item) => item.campaignId === campaign.id);
  const progress = progressFrom(campaign.recipientCount, records);
  const stats = statsFrom(records);
  const drained = progress.total > 0 && progress.pending === 0;
  const status =
    drained && (campaign.status === 'running' || campaign.status === 'paused')
      ? 'completed'
      : campaign.status;
  const next: Campaign = {
    ...campaign,
    progress,
    stats,
    status,
    finishedAt: status === 'completed' ? campaign.finishedAt ?? now : campaign.finishedAt
  };
  const list = readCampaigns(now);
  const index = list.findIndex((item) => item.id === next.id);
  if (index >= 0) list[index] = next;
  writeCampaigns(list);
  return next;
}

function sortCampaigns(list: Campaign[]): Campaign[] {
  return list
    .slice()
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt - a.createdAt
    );
}

export function demoCampaigns(params?: CampaignListParams): PagedCampaigns {
  enterDemoMode();
  const now = Date.now();
  const query = (params?.query ?? '').trim().toLowerCase();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  const matches = sortCampaigns(readCampaigns(now)).filter((item) => {
    if (params?.status && params.status !== 'all' && item.status !== params.status) return false;
    if (!query) return true;
    return (item.name + ' ' + item.content.title).toLowerCase().includes(query);
  });
  const slice = matches.slice(offset, offset + limit);
  return {
    campaigns: slice.map((item) => ({ ...item })),
    hasMore: offset + slice.length < matches.length,
    total: matches.length
  };
}

export function demoCampaignById(id: string): Campaign {
  enterDemoMode();
  const found = readCampaigns().find((item) => item.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'campaign not found');
  return sync(found);
}

export function demoCreateCampaign(input: CampaignInput, now = Date.now()): Campaign {
  enterDemoMode();
  const record: Campaign = {
    id: nextSeq('cmp'),
    name: input.name.trim(),
    status: 'draft',
    content: { ...input.content },
    templateId: input.templateId,
    recipientCount: input.recipientIds.length,
    channels: input.settings.channels.slice(),
    settings: { ...input.settings },
    progress: emptyProgress(input.recipientIds.length),
    stats: emptyStats(),
    createdAt: now,
    startedAt: null,
    finishedAt: null
  };
  const list = readCampaigns(now);
  list.unshift(record);
  writeCampaigns(list);
  if (input.templateId) demoUseTemplate(input.templateId, now);
  return { ...record };
}

function transition(
  id: string,
  status: Campaign['status'],
  now = Date.now()
): Campaign {
  const found = readCampaigns(now).find((item) => item.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'campaign not found');
  const next: Campaign = {
    ...found,
    status,
    startedAt: status === 'running' ? found.startedAt ?? now : found.startedAt,
    finishedAt: status === 'cancelled' ? now : found.finishedAt
  };
  const list = readCampaigns(now);
  list[list.findIndex((item) => item.id === id)] = next;
  writeCampaigns(list);
  return sync(next, now);
}

export function demoStartCampaign(id: string, now = Date.now()): Campaign {
  return transition(id, 'running', now);
}

export function demoPauseCampaign(id: string, now = Date.now()): Campaign {
  return transition(id, 'paused', now);
}

export function demoCancelCampaign(id: string, now = Date.now()): Campaign {
  return transition(id, 'cancelled', now);
}

export function demoCampaignStats(id: string): CampaignStats {
  return demoCampaignById(id).stats;
}

/** One delivery from the throttled loop; drives the live progress bar. */
export function demoRecordSend(
  campaignId: string,
  recipient: Recipient,
  status: SendStatus,
  failureReason?: string,
  now = Date.now()
): SendRecord {
  enterDemoMode();
  const campaign = readCampaigns(now).find((item) => item.id === campaignId);
  if (!campaign) throw new ApiError('NOT_FOUND', 'campaign not found');
  const record = makeRecord(
    campaign,
    recipient,
    status,
    status === 'sent' ? now : null,
    failureReason
  );
  const history = readHistory();
  history.unshift(record);
  writeHistory(history);
  sync(campaign, now);
  return record;
}

export function demoCampaignRecords(campaignId: string, limit = 50): SendRecord[] {
  enterDemoMode();
  readCampaigns();
  return readHistory()
    .filter((item) => item.campaignId === campaignId)
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
    .slice(0, limit)
    .map((item) => ({ ...item }));
}

export function demoSendHistory(params?: SendHistoryParams): PagedSendHistory {
  enterDemoMode();
  readCampaigns();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  const matches = readHistory()
    .filter((item) => {
      if (params?.campaignId && item.campaignId !== params.campaignId) return false;
      const stamp = item.sentAt;
      if (params?.from && (stamp === null || stamp < params.from)) return false;
      if (params?.to && (stamp === null || stamp > params.to)) return false;
      return true;
    })
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
  const slice = matches.slice(offset, offset + limit);
  return {
    records: slice.map((item) => ({ ...item })),
    hasMore: offset + slice.length < matches.length,
    total: matches.length
  };
}

/** Puts every failed delivery back in the queue and returns how many. */
export function demoRetryFailed(campaignId: string, now = Date.now()): number {
  enterDemoMode();
  const campaign = readCampaigns(now).find((item) => item.id === campaignId);
  if (!campaign) throw new ApiError('NOT_FOUND', 'campaign not found');
  const history = readHistory();
  let count = 0;
  const next = history.map((item) => {
    if (item.campaignId !== campaignId || item.status !== 'failed') return item;
    count += 1;
    return { ...item, status: 'pending' as SendStatus, failureReason: undefined, sentAt: null };
  });
  writeHistory(next);
  sync({ ...campaign, status: count > 0 ? 'running' : campaign.status }, now);
  return count;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function demoMarketingOverview(now = Date.now()): MarketingOverview {
  enterDemoMode();
  const campaigns = readCampaigns(now);
  const recent = readHistory().filter(
    (item) => item.sentAt !== null && now - item.sentAt <= MONTH_MS
  );
  const stats = statsFrom(recent);
  return {
    monthSent: stats.delivered,
    monthOpenRate: stats.openRate,
    monthConversionRate: stats.replyRate,
    activeCampaigns: campaigns.filter(
      (item) => item.status === 'running' || item.status === 'paused'
    ).length
  };
}

/** Test/demo helper: forgets every marketing record but keeps other modules. */
export function demoResetMarketing(): void {
  writeJson(CAMPAIGN_KEY, []);
  writeJson(TEMPLATE_KEY, []);
  writeJson(HISTORY_KEY, []);
  writeJson(CACHE_KEY, []);
  writeJson(SEQ_KEY, 0);
}
