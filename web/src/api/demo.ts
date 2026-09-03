import { ApiError } from './http';
import type {
  Channel,
  ChannelPlatform,
  ConnectResult,
  OAuthCallbackParams,
  Plan,
  Subscription,
  SubscriptionTier,
  TokenResult,
  UsageRecord,
  UsageSnapshot,
  WebhookStatus
} from '../types';

const MODE_KEY = 'ks-demo-mode';
const SUB_KEY = 'ks-demo-subscription';
const PENDING_KEY = 'ks-demo-pending-plan';
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Backend billing endpoints are considered absent on network errors, timeouts and 404s. */
export function isMissingBackend(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'TIMEOUT' || error.code === 'HTTP_404' || error.code === 'NOT_FOUND';
  }
  return true;
}

function enterDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode */
  }
}

export const TIER_ORDER: Record<SubscriptionTier, number> = { free: 0, basic: 1, pro: 2 };

export const DEMO_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    quotas: { aiGenerations: 30, messages: 200, channels: 1, scheduledPosts: 0 }
  },
  {
    id: 'basic',
    name: 'Basic',
    priceUsd: 9,
    featured: true,
    quotas: { aiGenerations: 500, messages: 5000, channels: 3, scheduledPosts: 60 }
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 29,
    quotas: { aiGenerations: 5000, messages: 50000, channels: -1, scheduledPosts: 600 }
  }
];

export function demoPlans(): Plan[] {
  enterDemoMode();
  return DEMO_PLANS.map((plan) => ({ ...plan, quotas: { ...plan.quotas } }));
}

interface DemoSubscriptionRecord {
  planId: SubscriptionTier;
  status: 'active' | 'canceled';
  currentPeriodEnd: number;
}

function defaultRecord(): DemoSubscriptionRecord {
  return { planId: 'free', status: 'active', currentPeriodEnd: Date.now() + PERIOD_MS };
}

export function readDemoSubscriptionRecord(): DemoSubscriptionRecord {
  try {
    const parsed = JSON.parse(localStorage.getItem(SUB_KEY) ?? 'null') as DemoSubscriptionRecord | null;
    if (parsed && TIER_ORDER[parsed.planId] !== undefined) return parsed;
  } catch {
    /* corrupted state falls back to defaults */
  }
  return defaultRecord();
}

function writeRecord(record: DemoSubscriptionRecord): void {
  try {
    localStorage.setItem(SUB_KEY, JSON.stringify(record));
  } catch {
    /* private mode */
  }
}
function toSubscription(record: DemoSubscriptionRecord): Subscription {
  return {
    id: 'demo-sub',
    planId: record.planId,
    status: record.status,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.status === 'canceled',
    demo: true
  };
}

export function readDemoSubscription(): Subscription {
  enterDemoMode();
  return toSubscription(readDemoSubscriptionRecord());
}

export function demoChangePlan(planId: SubscriptionTier): Subscription {
  enterDemoMode();
  const record = readDemoSubscriptionRecord();
  writeRecord({ planId, status: 'active', currentPeriodEnd: record.currentPeriodEnd });
  return toSubscription({ planId, status: 'active', currentPeriodEnd: record.currentPeriodEnd });
}

export function demoCancel(): Subscription {
  enterDemoMode();
  const next = { ...readDemoSubscriptionRecord(), status: 'canceled' as const };
  writeRecord(next);
  return toSubscription(next);
}

export function demoResume(): Subscription {
  enterDemoMode();
  const next = { ...readDemoSubscriptionRecord(), status: 'active' as const };
  writeRecord(next);
  return toSubscription(next);
}

export function demoCreateCheckout(planId: SubscriptionTier): { checkoutUrl: string; demo: true } {
  enterDemoMode();
  try {
    localStorage.setItem(PENDING_KEY, planId);
  } catch {
    /* private mode */
  }
  return { checkoutUrl: '/checkout/demo', demo: true };
}

export function demoPendingPlan(): SubscriptionTier | null {
  try {
    const stored = localStorage.getItem(PENDING_KEY) as SubscriptionTier | null;
    return stored && TIER_ORDER[stored] !== undefined ? stored : null;
  } catch {
    return null;
  }
}

export function demoCompleteCheckout(): Subscription {
  enterDemoMode();
  const pending = demoPendingPlan() ?? 'basic';
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  const next: DemoSubscriptionRecord = {
    planId: pending,
    status: 'active',
    currentPeriodEnd: Date.now() + PERIOD_MS
  };
  writeRecord(next);
  return toSubscription(next);
}

/** Deterministic ratios (~86% AI, ~66% messages, ~40% posts) so warning states stay visible. */
export function demoUsage(planId: SubscriptionTier): UsageSnapshot {
  enterDemoMode();
  const plan = DEMO_PLANS.find((p) => p.id === planId) ?? DEMO_PLANS[0];
  const q = plan.quotas;
  return {
    aiGenerations: Math.floor((q.aiGenerations * 86) / 100),
    messages: Math.floor((q.messages * 66) / 100),
    scheduledPosts: Math.floor((Math.max(q.scheduledPosts, 0) * 40) / 100),
    periodEnd: readDemoSubscriptionRecord().currentPeriodEnd,
    demo: true
  };
}

export function demoUsageHistory(planId: SubscriptionTier): UsageRecord[] {
  enterDemoMode();
  const plan = DEMO_PLANS.find((p) => p.id === planId) ?? DEMO_PLANS[0];
  const q = plan.quotas;
  const day = 24 * 60 * 60 * 1000;
  const records: UsageRecord[] = [];
  for (let i = 13; i >= 0; i--) {
    const wave = ((13 - i) % 7) / 6;
    records.push({
      date: new Date(Date.now() - i * day).toISOString().slice(0, 10),
      aiGenerations: Math.max(1, Math.round((q.aiGenerations / 30) * (1 + wave))),
      messages: Math.max(2, Math.round((q.messages / 30) * (1 + wave))),
      scheduledPosts: q.scheduledPosts > 0 ? Math.round((q.scheduledPosts / 30) * wave) : 0
    });
  }
  return records;
}
/* Sprint 5b: demo channel directory (OAuth loop simulated in-app). */
const CHANNELS_KEY = 'ks-demo-channels';
const WEBHOOKS_KEY = 'ks-demo-webhooks';
const CHANNEL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const DEMO_ACCOUNT_NAMES: Record<ChannelPlatform, string> = {
  whatsapp: '+255 700 100 200',
  facebook: 'Kili Demo Shop',
  instagram: '@kili.demo',
  tiktok: '@kilisocial_demo'
};

interface DemoChannelRecord {
  id: string;
  platform: ChannelPlatform;
  accountName: string;
  status: 'connected' | 'needs_reauth';
  connectedAt: number;
  tokenExpiresAt: number;
}

function readChannelRecords(): DemoChannelRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHANNELS_KEY) ?? '[]') as DemoChannelRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeChannelRecords(records: DemoChannelRecord[]): void {
  try {
    localStorage.setItem(CHANNELS_KEY, JSON.stringify(records));
  } catch {
    /* private mode */
  }
}

function toChannel(record: DemoChannelRecord): Channel {
  const expired = record.tokenExpiresAt < Date.now();
  return {
    id: record.id,
    platform: record.platform,
    accountName: record.accountName,
    status: record.status === 'connected' && expired ? 'needs_reauth' : record.status,
    connectedAt: record.connectedAt,
    tokenExpiresAt: record.tokenExpiresAt,
    demo: true
  };
}

export function demoChannels(): Channel[] {
  enterDemoMode();
  return readChannelRecords().map(toChannel);
}

export function demoChannelById(id: string): Channel | null {
  enterDemoMode();
  const record = readChannelRecords().find((r) => r.id === id);
  return record ? toChannel(record) : null;
}
/** Without a code this starts the demo OAuth loop; with a code it finalizes it. */
export function demoConnect(platform: ChannelPlatform, params: OAuthCallbackParams): ConnectResult {
  enterDemoMode();
  if (params.code) {
    const record: DemoChannelRecord = {
      id: `demo-${platform}`,
      platform,
      accountName: DEMO_ACCOUNT_NAMES[platform],
      status: 'connected',
      connectedAt: Date.now(),
      tokenExpiresAt: Date.now() + CHANNEL_PERIOD_MS
    };
    writeChannelRecords([...readChannelRecords().filter((r) => r.id !== record.id), record]);
    return { channel: toChannel(record) };
  }
  return { authUrl: `/auth/callback/${platform}?code=demo-code&state=demo-state` };
}

export function demoDisconnect(id: string): void {
  enterDemoMode();
  writeChannelRecords(readChannelRecords().filter((r) => r.id !== id));
}

export function demoRefreshToken(id: string): TokenResult {
  enterDemoMode();
  const records = readChannelRecords();
  const record = records.find((r) => r.id === id);
  if (!record) throw new ApiError('NOT_FOUND', 'channel not found');
  record.status = 'connected';
  record.tokenExpiresAt = Date.now() + CHANNEL_PERIOD_MS;
  writeChannelRecords(records);
  return { channelId: id, tokenExpiresAt: record.tokenExpiresAt };
}

function readWebhooks(): Partial<Record<ChannelPlatform, WebhookStatus>> {
  try {
    return JSON.parse(localStorage.getItem(WEBHOOKS_KEY) ?? '{}') as Partial<
      Record<ChannelPlatform, WebhookStatus>
    >;
  } catch {
    return {};
  }
}

export function demoWebhookStatus(platform: ChannelPlatform): WebhookStatus {
  enterDemoMode();
  return readWebhooks()[platform] ?? { platform, registered: false };
}

export function demoRegisterWebhook(platform: ChannelPlatform, url: string): WebhookStatus {
  enterDemoMode();
  const webhooks = readWebhooks();
  const status: WebhookStatus = { platform, registered: true, url, updatedAt: Date.now() };
  webhooks[platform] = status;
  try {
    localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(webhooks));
  } catch {
    /* private mode */
  }
  return status;
}