import { ApiError } from './http';
import type {
  AgentPerformance,
  AiReplySuggestion,
  Channel,
  ChannelSlice,
  Customer,
  CustomerInput,
  CustomerStats,
  ChannelPlatform,
  ConnectResult,
  Conversation,
  DateRange,
  Message,
  MessageType,
  OverviewStats,
  OAuthCallbackParams,
  PagedMessages,
  Plan,
  PagedCustomers,
  QuickReplyTemplate,
  ResponseTimeStats,
  Subscription,
  SubscriptionTier,
  Tag,
  TokenResult,
  TopCustomer,
  TrendGranularity,
  TrendPoint,
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

/* Sprint 7: demo tag palette + customer directory (linked to the demo inbox by phone). */
const TAGS_KEY = 'ks-demo-tags';
const CUSTOMERS_KEY = 'ks-demo-customers';

interface CustomerRecord extends Omit<Customer, 'tags'> {
  tagIds: string[];
}

const SEED_TAGS: Tag[] = [
  { id: 'tag-vip', name: 'VIP', color: '#B45309' },
  { id: 'tag-lead', name: 'New lead', color: '#5B5BD6' },
  { id: 'tag-wholesale', name: 'Wholesale', color: '#15803D' },
  { id: 'tag-followup', name: 'Follow-up', color: '#F4633A' }
];

function writeTags(tags: Tag[]): void {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch {
    /* private mode */
  }
}

function readTags(): Tag[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TAGS_KEY) ?? 'null') as Tag[] | null;
    if (parsed && Array.isArray(parsed)) return parsed;
  } catch {
    /* corrupted state falls back to a fresh seed */
  }
  const seeded = SEED_TAGS.map((tag) => ({ ...tag }));
  writeTags(seeded);
  return seeded;
}

function seedCustomers(): CustomerRecord[] {
  const now = Date.now();
  return [
    { id: 'u-1', name: 'Amani Juma', phone: '+255 712 345 678', email: 'amani@example.com', address: 'Dar es Salaam, TZ', notes: 'Prefers Swahili; wholesale interest.', tagIds: ['tag-vip', 'tag-wholesale'], channels: ['whatsapp'], conversationCount: 1, lastContactAt: now - 4 * 60_000, createdAt: now - 40 * 86_400_000 },
    { id: 'u-2', name: 'Neema Wanjiru', phone: '+254 723 456 789', email: 'neema@example.com', address: 'Nairobi, KE', notes: '', tagIds: ['tag-followup'], channels: ['whatsapp'], conversationCount: 1, lastContactAt: now - 55 * 60_000, createdAt: now - 30 * 86_400_000 },
    { id: 'u-3', name: 'Grace Adeyemi', phone: '+234 803 555 0107', email: 'grace@example.com', address: 'Lagos, NG', notes: '', tagIds: ['tag-lead'], channels: ['facebook'], conversationCount: 1, lastContactAt: now - 3 * 3_600_000, createdAt: now - 12 * 86_400_000 },
    { id: 'u-4', name: 'Zuri Abebe', phone: '+251 911 223 344', email: '', address: 'Addis Ababa, ET', notes: '', tagIds: [], channels: ['instagram'], conversationCount: 1, lastContactAt: now - 26 * 3_600_000, createdAt: now - 26 * 86_400_000 },
    { id: 'u-5', name: 'Kofi Mensah', phone: '+233 24 555 0199', email: 'kofi@example.com', address: 'Accra, GH', notes: 'Found us on TikTok.', tagIds: ['tag-lead'], channels: ['tiktok'], conversationCount: 1, lastContactAt: now - 2 * 86_400_000, createdAt: now - 20 * 86_400_000 },
    { id: 'u-6', name: 'Baraka Okonkwo', phone: '+256 701 234 567', email: '', address: 'Kampala, UG', notes: '', tagIds: [], channels: ['whatsapp'], conversationCount: 1, lastContactAt: now - 6 * 86_400_000, createdAt: now - 60 * 86_400_000 },
    { id: 'u-7', name: 'Salma Hassan', phone: '+255 754 118 220', email: 'salma@example.com', address: 'Zanzibar, TZ', notes: 'Met at the trade fair.', tagIds: ['tag-wholesale'], channels: [], conversationCount: 0, lastContactAt: null, createdAt: now - 3 * 86_400_000 },
    { id: 'u-8', name: 'Daniel Kimaro', phone: '', email: 'daniel.k@example.com', address: '', notes: '', tagIds: [], channels: [], conversationCount: 0, lastContactAt: null, createdAt: now - 86_400_000 }
  ];
}

function writeCustomers(list: CustomerRecord[]): void {
  try {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

function readCustomers(): CustomerRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) ?? 'null') as CustomerRecord[] | null;
    if (parsed && Array.isArray(parsed)) return parsed;
  } catch {
    /* corrupted state falls back to a fresh seed */
  }
  const seeded = seedCustomers();
  writeCustomers(seeded);
  return seeded;
}

function hydrateCustomer(record: CustomerRecord, tags: Tag[]): Customer {
  const { tagIds, ...rest } = record;
  const known = tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => Boolean(tag));
  return { ...rest, tags: known.map((tag) => ({ ...tag })), demo: true };
}

export interface DemoCustomerListParams {
  query?: string;
  tagId?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

export function demoTags(): Tag[] {
  enterDemoMode();
  return readTags().map((tag) => ({ ...tag }));
}

export function demoCustomers(params?: DemoCustomerListParams): PagedCustomers {
  enterDemoMode();
  const tags = readTags();
  const query = (params?.query ?? '').trim().toLowerCase();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  const matches = readCustomers()
    .filter((record) => {
      if (params?.tagId && !record.tagIds.includes(params.tagId)) return false;
      if (params?.channel && params.channel !== 'all' && !record.channels.includes(params.channel as ChannelPlatform)) return false;
      if (query) {
        const haystack = `${record.name} ${record.phone ?? ''} ${record.email ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.lastContactAt ?? 0) - (a.lastContactAt ?? 0) || b.createdAt - a.createdAt);
  const slice = matches.slice(offset, offset + limit);
  return {
    customers: slice.map((record) => hydrateCustomer(record, tags)),
    hasMore: offset + slice.length < matches.length,
    total: matches.length
  };
}

export function demoCustomerById(id: string): Customer {
  enterDemoMode();
  const tags = readTags();
  const record = readCustomers().find((candidate) => candidate.id === id);
  if (!record) throw new ApiError('NOT_FOUND', 'customer not found');
  return hydrateCustomer(record, tags);
}

export function demoCreateCustomer(input: CustomerInput): Customer {
  enterDemoMode();
  const list = readCustomers();
  const record: CustomerRecord = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
    name: input.name.trim(),
    phone: input.phone?.trim() || '',
    email: input.email?.trim() || '',
    address: input.address?.trim() || '',
    notes: input.notes?.trim() || '',
    tagIds: input.tagIds ?? [],
    channels: [],
    conversationCount: 0,
    lastContactAt: null,
    createdAt: Date.now()
  };
  list.push(record);
  writeCustomers(list);
  return hydrateCustomer(record, readTags());
}

export function demoUpdateCustomer(id: string, input: CustomerInput): Customer {
  enterDemoMode();
  const list = readCustomers();
  const record = list.find((candidate) => candidate.id === id);
  if (!record) throw new ApiError('NOT_FOUND', 'customer not found');
  record.name = input.name.trim() || record.name;
  record.phone = input.phone?.trim() ?? record.phone ?? '';
  record.email = input.email?.trim() ?? record.email ?? '';
  record.address = input.address?.trim() ?? record.address ?? '';
  record.notes = input.notes?.trim() ?? record.notes ?? '';
  if (input.tagIds) record.tagIds = input.tagIds;
  writeCustomers(list);
  return hydrateCustomer(record, readTags());
}

export function demoDeleteCustomer(id: string): void {
  enterDemoMode();
  writeCustomers(readCustomers().filter((candidate) => candidate.id !== id));
}

/** Links customers to demo inbox conversations by phone number. */
export function demoCustomerConversations(id: string): Conversation[] {
  enterDemoMode();
  const record = readCustomers().find((candidate) => candidate.id === id);
  if (!record || !record.phone) return [];
  return readInbox()
    .conversations.filter((conversation) => conversation.contactPhone === record.phone)
    .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
}

export function demoCustomerStats(id: string): CustomerStats {
  enterDemoMode();
  const record = readCustomers().find((candidate) => candidate.id === id);
  if (!record) throw new ApiError('NOT_FOUND', 'customer not found');
  const inbox = readInbox();
  const conversations = record.phone
    ? inbox.conversations.filter((conversation) => conversation.contactPhone === record.phone)
    : [];
  const timestamps: number[] = [];
  let messageCount = 0;
  for (const conversation of conversations) {
    const thread = inbox.messages[conversation.id] ?? [];
    messageCount += thread.length;
    for (const item of thread) timestamps.push(item.timestamp);
  }
  timestamps.sort((a, b) => a - b);
  return {
    conversationCount: conversations.length,
    messageCount,
    firstContactAt: timestamps.length ? timestamps[0] : null,
    lastContactAt: timestamps.length ? timestamps[timestamps.length - 1] : record.lastContactAt,
    activeChannels: [...new Set(conversations.map((c) => c.platform).filter((p): p is ChannelPlatform => Boolean(p)))]
  };
}

export function demoCreateTag(name: string, color: string): Tag {
  enterDemoMode();
  const tags = readTags();
  const tag: Tag = { id: `tag-${Date.now()}`, name: name.trim(), color };
  tags.push(tag);
  writeTags(tags);
  return { ...tag };
}

export function demoUpdateTag(id: string, patch: { name?: string; color?: string }): Tag {
  enterDemoMode();
  const tags = readTags();
  const tag = tags.find((candidate) => candidate.id === id);
  if (!tag) throw new ApiError('NOT_FOUND', 'tag not found');
  if (patch.name !== undefined) tag.name = patch.name.trim() || tag.name;
  if (patch.color !== undefined) tag.color = patch.color;
  writeTags(tags);
  return { ...tag };
}

export function demoDeleteTag(id: string): void {
  enterDemoMode();
  writeTags(readTags().filter((tag) => tag.id !== id));
  const list = readCustomers();
  for (const record of list) {
    record.tagIds = record.tagIds.filter((tagId) => tagId !== id);
  }
  writeCustomers(list);
}

export function demoAssignTag(customerId: string, tagId: string): void {
  enterDemoMode();
  const list = readCustomers();
  const record = list.find((candidate) => candidate.id === customerId);
  if (!record) throw new ApiError('NOT_FOUND', 'customer not found');
  if (!readTags().some((tag) => tag.id === tagId)) throw new ApiError('NOT_FOUND', 'tag not found');
  if (!record.tagIds.includes(tagId)) record.tagIds.push(tagId);
  writeCustomers(list);
}

export function demoRemoveTag(customerId: string, tagId: string): void {
  enterDemoMode();
  const list = readCustomers();
  const record = list.find((candidate) => candidate.id === customerId);
  if (!record) throw new ApiError('NOT_FOUND', 'customer not found');
  record.tagIds = record.tagIds.filter((id) => id !== tagId);
  writeCustomers(list);
}

/* Sprint 8: demo analytics, aggregated from the demo inbox and customer directory. */

const RESPONSE_TARGET_MINUTES = 240;
const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isoDay(ts: number): string {
  const d = new Date(ts);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Calendar bucket a timestamp belongs to: day, ISO-ish week (Monday first) or month. */
function bucketOf(ts: number, granularity: TrendGranularity): { key: string; start: number } {
  const day = startOfDay(ts);
  if (granularity === 'day') return { key: isoDay(day), start: day };
  if (granularity === 'week') {
    const weekday = (new Date(day).getDay() + 6) % 7;
    const start = day - weekday * DAY_MS;
    return { key: `${isoDay(start)}w`, start };
  }
  const d = new Date(day);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return { key: isoDay(start).slice(0, 7), start };
}

/** Continuous bucket axis so charts never show gaps for quiet days. */
function buildBuckets(range: DateRange, granularity: TrendGranularity): { key: string; timestamp: number }[] {
  const buckets: { key: string; timestamp: number }[] = [];
  const seen = new Set<string>();
  const end = startOfDay(range.to);
  for (let cursor = startOfDay(range.from); cursor <= end; cursor += DAY_MS) {
    const bucket = bucketOf(cursor, granularity);
    if (seen.has(bucket.key)) continue;
    seen.add(bucket.key);
    buckets.push({ key: bucket.key, timestamp: bucket.start });
  }
  return buckets.sort((a, b) => a.timestamp - b.timestamp);
}

function rangedMessages(inbox: InboxState, range: DateRange): Message[] {
  const out: Message[] = [];
  for (const list of Object.values(inbox.messages)) {
    for (const message of list) {
      if (message.timestamp >= range.from && message.timestamp <= range.to) out.push(message);
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function previousWindow(range: DateRange): DateRange {
  const span = Math.max(1, range.to - range.from);
  return { from: range.from - span - 1, to: range.from - 1, preset: range.preset };
}

/** Null when the previous window has no baseline, so the UI can show a dash. */
function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/** Contact-to-staff reply latencies; the reply must land inside the range. */
function replyLatencies(inbox: InboxState, range: DateRange, only?: Set<string>): number[] {
  const out: number[] = [];
  for (const [conversationId, list] of Object.entries(inbox.messages)) {
    if (only && !only.has(conversationId)) continue;
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
    let waiting: number | null = null;
    for (const message of sorted) {
      if (message.sender === 'contact') {
        if (waiting === null) waiting = message.timestamp;
      } else if (waiting !== null) {
        if (message.timestamp >= range.from && message.timestamp <= range.to) {
          out.push(message.timestamp - waiting);
        }
        waiting = null;
      }
    }
  }
  return out;
}

function activeConversationIds(inbox: InboxState, range: DateRange): Set<string> {
  const ids = new Set<string>();
  for (const message of rangedMessages(inbox, range)) ids.add(message.conversationId);
  return ids;
}

export function demoAnalyticsOverview(range: DateRange): OverviewStats {
  enterDemoMode();
  const inbox = readInbox();
  const previous = previousWindow(range);
  const customers = readCustomers();
  const createdIn = (window: DateRange): number =>
    customers.filter((c) => c.createdAt >= window.from && c.createdAt <= window.to).length;
  const active = activeConversationIds(inbox, range).size;
  const activeBefore = activeConversationIds(inbox, previous).size;
  const messages = rangedMessages(inbox, range).length;
  const messagesBefore = rangedMessages(inbox, previous).length;
  return {
    totalCustomers: customers.length,
    totalConversations: active,
    totalMessages: messages,
    unreadCount: inbox.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    averageResponseMs: mean(replyLatencies(inbox, range)),
    customersChange: changePercent(createdIn(range), createdIn(previous)),
    conversationsChange: changePercent(active, activeBefore),
    messagesChange: changePercent(messages, messagesBefore),
    demo: true
  };
}

export function demoConversationTrend(range: DateRange, granularity: TrendGranularity): TrendPoint[] {
  enterDemoMode();
  const inbox = readInbox();
  const perBucket = new Map<string, Set<string>>();
  for (const message of rangedMessages(inbox, range)) {
    const key = bucketOf(message.timestamp, granularity).key;
    const set = perBucket.get(key) ?? new Set<string>();
    set.add(message.conversationId);
    perBucket.set(key, set);
  }
  return buildBuckets(range, granularity).map((bucket) => ({
    bucket: bucket.key,
    timestamp: bucket.timestamp,
    count: perBucket.get(bucket.key)?.size ?? 0
  }));
}

export function demoMessageTrend(range: DateRange, granularity: TrendGranularity): TrendPoint[] {
  enterDemoMode();
  const inbox = readInbox();
  const perBucket = new Map<string, TrendPoint>();
  for (const bucket of buildBuckets(range, granularity)) {
    perBucket.set(bucket.key, { bucket: bucket.key, timestamp: bucket.timestamp, count: 0, inbound: 0, outbound: 0 });
  }
  for (const message of rangedMessages(inbox, range)) {
    const point = perBucket.get(bucketOf(message.timestamp, granularity).key);
    if (!point) continue;
    point.count += 1;
    if (message.sender === 'contact') point.inbound = (point.inbound ?? 0) + 1;
    else point.outbound = (point.outbound ?? 0) + 1;
  }
  return [...perBucket.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function demoChannelDistribution(range: DateRange): ChannelSlice[] {
  enterDemoMode();
  const inbox = readInbox();
  const active = activeConversationIds(inbox, range);
  const counts = new Map<ChannelPlatform, number>();
  let total = 0;
  for (const conversation of inbox.conversations) {
    if (!active.has(conversation.id) || !conversation.platform) continue;
    counts.set(conversation.platform, (counts.get(conversation.platform) ?? 0) + 1);
    total += 1;
  }
  return [...counts.entries()]
    .map(([platform, conversations]) => ({
      platform,
      conversations,
      percent: total ? Math.round((conversations / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.conversations - a.conversations || a.platform.localeCompare(b.platform));
}

export function demoResponseTime(range: DateRange): ResponseTimeStats {
  enterDemoMode();
  const inbox = readInbox();
  const sorted = replyLatencies(inbox, range).sort((a, b) => a - b);
  return {
    averageMs: mean(sorted),
    medianMs: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
    p95Ms: percentile(sorted, 95),
    samples: sorted.length,
    targetMinutes: RESPONSE_TARGET_MINUTES
  };
}

const DEMO_AGENTS = [
  { agentId: 'agent-1', name: 'Neema K.' },
  { agentId: 'agent-2', name: 'Joseph M.' }
];

/** Deterministic split of the ranged conversations across two demo staff members. */
export function demoAgentPerformance(range: DateRange): AgentPerformance[] {
  enterDemoMode();
  const inbox = readInbox();
  const active = [...activeConversationIds(inbox, range)].sort();
  const messages = rangedMessages(inbox, range);
  return DEMO_AGENTS.map((agent, index) => {
    const owned = new Set(active.filter((_, position) => position % 2 === index));
    return {
      agentId: agent.agentId,
      name: agent.name,
      conversations: owned.size,
      messages: messages.filter((message) => owned.has(message.conversationId)).length,
      averageResponseMs: mean(replyLatencies(inbox, range, owned)),
      satisfaction: owned.size ? (index === 0 ? 4.8 : 4.6) : null
    };
  });
}

export function demoTopCustomers(range: DateRange, limit = 5): TopCustomer[] {
  enterDemoMode();
  const inbox = readInbox();
  const messages = rangedMessages(inbox, range);
  const rows: TopCustomer[] = [];
  for (const record of readCustomers()) {
    const ids = new Set(
      record.phone ? inbox.conversations.filter((c) => c.contactPhone === record.phone).map((c) => c.id) : []
    );
    if (!ids.size) continue;
    const own = messages.filter((message) => ids.has(message.conversationId));
    if (!own.length) continue;
    const timestamps = own.map((message) => message.timestamp).sort((a, b) => a - b);
    rows.push({
      id: record.id,
      name: record.name,
      conversations: ids.size,
      messages: own.length,
      lastContactAt: timestamps[timestamps.length - 1] ?? null
    });
  }
  return rows
    .sort((a, b) => b.messages - a.messages || b.conversations - a.conversations || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, limit));
}