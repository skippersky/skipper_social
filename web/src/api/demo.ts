import { ApiError } from './http';
import type {
  AiReplySuggestion,
  Channel,
  ChannelPlatform,
  ConnectResult,
  Conversation,
  Message,
  MessageType,
  OAuthCallbackParams,
  PagedMessages,
  Plan,
  QuickReplyTemplate,
  Subscription,
  SubscriptionTier,
  TokenResult,
  UploadResult,
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
/* Sprint 6: demo inbox dataset (conversations + paginated history). */
const INBOX_KEY = 'ks-demo-inbox';

interface InboxState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
}

function demoMediaUrl(label: string): string {
  return (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' rx='12' fill='%23FFB238'/%3E%3Ctext x='120' y='88' font-size='16' text-anchor='middle' fill='%23221507'%3E" +
    encodeURIComponent(label) +
    '%3C/text%3E%3C/svg%3E'
  );
}

function seedInbox(): InboxState {
  const now = Date.now();
  const conversations: Conversation[] = [
    { id: 'i-1', contactName: 'Amani Juma', contactPhone: '+255 712 345 678', platform: 'whatsapp', lastMessage: 'Ningependa kujua zaidi kuhusu vifurushi.', lastMessageTime: now - 4 * 60_000, unreadCount: 2 },
    { id: 'i-2', contactName: 'Neema Wanjiru', contactPhone: '+254 723 456 789', platform: 'whatsapp', lastMessage: 'Asante kwa majibu ya haraka, nitarudi kesho.', lastMessageTime: now - 55 * 60_000, unreadCount: 0 },
    { id: 'i-3', contactName: 'Grace Adeyemi', contactPhone: '+234 803 555 0107', platform: 'facebook', lastMessage: 'Do you ship to Lagos?', lastMessageTime: now - 3 * 3_600_000, unreadCount: 1 },
    { id: 'i-4', contactName: 'Zuri Abebe', contactPhone: '+251 911 223 344', platform: 'instagram', lastMessage: 'Picha ya bidhaa imefika vizuri sana, asante!', lastMessageTime: now - 26 * 3_600_000, unreadCount: 0 },
    { id: 'i-5', contactName: 'Kofi Mensah', contactPhone: '+233 24 555 0199', platform: 'tiktok', lastMessage: 'Saw the video, price please?', lastMessageTime: now - 2 * 86_400_000, unreadCount: 0 },
    { id: 'i-6', contactName: 'Baraka Okonkwo', contactPhone: '+256 701 234 567', platform: 'whatsapp', lastMessage: 'Nitapita dukani kesho alasiri kuchukua oda yangu.', lastMessageTime: now - 6 * 86_400_000, unreadCount: 0, archived: true }
  ];
  const history: Message[] = [];
  for (let i = 0; i < 26; i += 1) {
    const fromContact = i % 2 === 0;
    history.push({
      id: `i-1-m-${i}`,
      conversationId: 'i-1',
      content: fromContact ? `Habari, nauliza kuhusu oda yangu #${100 + i}.` : `Karibu! Oda #${100 + i} imeshatunwa leo.`,
      type: 'text',
      sender: fromContact ? 'contact' : 'user',
      timestamp: now - (26 - i) * 3 * 3_600_000,
      status: 'read'
    });
  }
  history.push({ id: 'i-1-m-img', conversationId: 'i-1', content: 'product-catalog.jpg', type: 'image', sender: 'user', timestamp: now - 8 * 60_000, status: 'read', mediaUrl: demoMediaUrl('Catalog') });
  history.push({ id: 'i-1-m-last', conversationId: 'i-1', content: 'Ningependa kujua zaidi kuhusu vifurushi.', type: 'text', sender: 'contact', timestamp: now - 4 * 60_000, status: 'read' });
  const messages: Record<string, Message[]> = {
    'i-1': history,
    'i-2': [
      { id: 'i-2-m-1', conversationId: 'i-2', content: 'Je, stock ya wiki hii imefika?', type: 'text', sender: 'contact', timestamp: now - 70 * 60_000, status: 'read' },
      { id: 'i-2-m-2', conversationId: 'i-2', content: 'Ndiyo, imefika jana. Nikutumie picha?', type: 'text', sender: 'user', timestamp: now - 60 * 60_000, status: 'read' },
      { id: 'i-2-m-3', conversationId: 'i-2', content: 'Asante kwa majibu ya haraka, nitarudi kesho.', type: 'text', sender: 'contact', timestamp: now - 55 * 60_000, status: 'read' }
    ],
    'i-3': [
      { id: 'i-3-m-1', conversationId: 'i-3', content: 'Hello! I saw your page via a friend.', type: 'text', sender: 'contact', timestamp: now - 4 * 3_600_000, status: 'read' },
      { id: 'i-3-m-2', conversationId: 'i-3', content: 'Do you ship to Lagos?', type: 'text', sender: 'contact', timestamp: now - 3 * 3_600_000, status: 'read' }
    ],
    'i-4': [
      { id: 'i-4-m-1', conversationId: 'i-4', content: 'product-photo.jpg', type: 'image', sender: 'user', timestamp: now - 27 * 3_600_000, status: 'read', mediaUrl: demoMediaUrl('Product') },
      { id: 'i-4-m-2', conversationId: 'i-4', content: 'Picha ya bidhaa imefika vizuri sana, asante!', type: 'text', sender: 'contact', timestamp: now - 26 * 3_600_000, status: 'read' }
    ],
    'i-5': [
      { id: 'i-5-m-1', conversationId: 'i-5', content: 'Saw the video, price please?', type: 'text', sender: 'contact', timestamp: now - 2 * 86_400_000, status: 'read' }
    ],
    'i-6': [
      { id: 'i-6-m-1', conversationId: 'i-6', content: 'Nitapita dukani kesho alasiri kuchukua oda yangu.', type: 'text', sender: 'contact', timestamp: now - 6 * 86_400_000, status: 'read' }
    ]
  };
  return { conversations, messages };
}
function readInbox(): InboxState {
  try {
    const parsed = JSON.parse(localStorage.getItem(INBOX_KEY) ?? 'null') as InboxState | null;
    if (parsed && Array.isArray(parsed.conversations) && parsed.messages) return parsed;
  } catch {
    /* corrupted state falls back to a fresh seed */
  }
  const seeded = seedInbox();
  writeInbox(seeded);
  return seeded;
}

function writeInbox(state: InboxState): void {
  try {
    localStorage.setItem(INBOX_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function demoInboxConversations(): Conversation[] {
  enterDemoMode();
  return [...readInbox().conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime);
}

export function demoInboxMessages(
  conversationId: string,
  before?: number,
  limit = 20
): PagedMessages {
  enterDemoMode();
  const all = readInbox().messages[conversationId] ?? [];
  const visible = before ? all.filter((m) => m.timestamp < before) : all;
  const slice = visible.slice(-limit);
  return { messages: slice, hasMore: visible.length > slice.length };
}

export function demoInboxSendMessage(
  conversationId: string,
  payload: { content: string; type: MessageType; mediaUrl?: string }
): Message {
  enterDemoMode();
  const state = readInbox();
  const message: Message = {
    id: `demo-m-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    conversationId,
    content: payload.content,
    type: payload.type,
    sender: 'user',
    timestamp: Date.now(),
    status: 'sent',
    mediaUrl: payload.mediaUrl
  };
  state.messages[conversationId] = [...(state.messages[conversationId] ?? []), message];
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.lastMessage = payload.content;
    conversation.lastMessageTime = message.timestamp;
  }
  writeInbox(state);
  return message;
}

export function demoInboxMarkRead(conversationId: string): void {
  enterDemoMode();
  const state = readInbox();
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.unreadCount = 0;
    writeInbox(state);
  }
}

export function demoInboxSetArchived(conversationId: string, archived: boolean): void {
  enterDemoMode();
  const state = readInbox();
  const conversation = state.conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.archived = archived;
    writeInbox(state);
  }
}

export function demoInboxDeleteMessage(messageId: string): void {
  enterDemoMode();
  const state = readInbox();
  for (const key of Object.keys(state.messages)) {
    state.messages[key] = state.messages[key].filter((m) => m.id !== messageId);
  }
  writeInbox(state);
}

export function demoUploadMedia(fileName: string): UploadResult {
  enterDemoMode();
  return { url: demoMediaUrl(fileName.slice(0, 12) || 'file') };
}
export const DEMO_QUICK_TEMPLATES: QuickReplyTemplate[] = [
  { id: 't-greet', title: 'Greeting', text: 'Habari! Karibu KiliSocial. Nikusaidieje leo?' },
  { id: 't-price', title: 'Price quote', text: 'Bei ya bidhaa hii ni TSh 25,000. Tuna punguzo kwa oda kubwa.' },
  { id: 't-thanks', title: 'Thanks', text: 'Asante sana kwa kuwasiliana nasi! Karibu tena.' },
  { id: 't-follow', title: 'Follow-up', text: 'Habari! Tulituma maelezo jana. Je, umepata nafasi ya kuyapitia?' }
];

export function demoQuickTemplates(): QuickReplyTemplate[] {
  enterDemoMode();
  return DEMO_QUICK_TEMPLATES.map((t) => ({ ...t }));
}

export function demoApplyTemplate(templateId: string): { text: string } {
  enterDemoMode();
  const template = DEMO_QUICK_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new ApiError('NOT_FOUND', 'template not found');
  return { text: template.text };
}

/** Canned bilingual suggestion echoing the latest contact message. */
export function demoGenerateReply(conversationId: string): AiReplySuggestion {
  enterDemoMode();
  const list = readInbox().messages[conversationId] ?? [];
  const last = [...list].reverse().find((m) => m.sender === 'contact');
  const snippet = (last?.content ?? 'ujumbe wako').slice(0, 40);
  return {
    id: `demo-ai-${Date.now()}`,
    text: `Asante kwa ujumbe wako kuhusu "${snippet}". Karibu! Tunapendekeza bei nafuu na usafirishaji haraka. Thanks for your message - we offer fair prices and fast delivery.`
  };
}