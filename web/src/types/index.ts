/**
 * Client-side mirror of the Sprint 3 backend DTO contract (see API_CONTRACT.md).
 * Until the backend exposes these endpoints the client degrades to mock data.
 */
export interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  avatarUrl?: string;
  /** Platform the contact wrote from; absent for legacy/local data. */
  platform?: ChannelPlatform;
  archived?: boolean;
  assignedTo?: string | null;
  /** True when the row comes from the offline demo directory. */
  demo?: boolean;
}

export type MessageType = 'text' | 'image' | 'location' | 'file' | 'audio';
export type MessageSender = 'user' | 'contact';
export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: MessageType;
  sender: MessageSender;
  timestamp: number;
  status: MessageStatus;
  /** Present for image/location messages (image URL or map link). */
  mediaUrl?: string;
}

export interface PagedMessages {
  messages: Message[];
  hasMore: boolean;
}

export interface ConversationFilters {
  query: string;
  status: 'all' | 'unread' | 'archived';
  platform: 'all' | ChannelPlatform;
}

export interface AiReplySuggestion {
  id: string;
  text: string;
}

export interface QuickReplyTemplate {
  id: string;
  title: string;
  text: string;
}

export interface UploadResult {
  url: string;
}
export type SubscriptionTier = 'free' | 'basic' | 'pro';

export interface User {
  id: string;
  email: string;
  phone?: string;
  nickname: string;
  avatarUrl?: string;
  company?: string;
  timezone: string;
  language: string;
  subscriptionTier: SubscriptionTier;
  createdAt: number;
}

export interface AuthResponse {
  user: User;
  /** Cookie-based sessions may omit tokens; the httpOnly cookie carries them. */
  accessToken?: string;
  refreshToken?: string;
  /** True when served by the on-device demo directory (backend auth absent). */
  demo?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
  phone?: string;
}

export interface OAuthRequest {
  provider: 'google';
  token: string;
}

export type UpdateMeRequest = Partial<
  Pick<User, 'nickname' | 'phone' | 'avatarUrl' | 'company' | 'timezone' | 'language'>
>;
/* Sprint 5 billing types (see API_CONTRACT.md). */
export interface PlanQuotas {
  aiGenerations: number;
  messages: number;
  /** Number of connected channels; -1 means unlimited. */
  channels: number;
  scheduledPosts: number;
}

export interface Plan {
  id: SubscriptionTier;
  name: string;
  priceUsd: number;
  quotas: PlanQuotas;
  featured?: boolean;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

export interface Subscription {
  id: string;
  planId: SubscriptionTier;
  status: SubscriptionStatus;
  /** Epoch milliseconds of the next billing (or access end) date. */
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  /** True when served by the on-device demo directory (backend billing absent). */
  demo?: boolean;
}

export interface CheckoutSession {
  checkoutUrl: string;
  demo?: boolean;
}

export interface UsageSnapshot {
  aiGenerations: number;
  messages: number;
  scheduledPosts: number;
  periodEnd: number;
  demo?: boolean;
}

export interface UsageRecord {
  /** ISO day, YYYY-MM-DD. */
  date: string;
  aiGenerations: number;
  messages: number;
  scheduledPosts: number;
}
/* Sprint 5b channel connection types (see API_CONTRACT.md). */
export type ChannelPlatform = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';
export type ChannelStatus = 'connected' | 'needs_reauth' | 'disconnected';

export const CHANNEL_PLATFORMS: ChannelPlatform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok'];

export interface Channel {
  id: string;
  platform: ChannelPlatform;
  accountName: string;
  status: ChannelStatus;
  connectedAt: number;
  tokenExpiresAt: number;
  demo?: boolean;
}

export interface AuthResult {
  /** Platform OAuth consent URL, or the in-app demo callback offline. */
  authUrl: string;
  demo?: boolean;
  /** Present when manual credentials were accepted without a redirect. */
  channel?: Channel;
}

export interface TokenResult {
  channelId: string;
  tokenExpiresAt: number;
}

export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  /** Manual credential mode: values keyed by CredentialField.key. */
  credentials?: Record<string, string>;
}

export interface ConnectResult {
  authUrl?: string;
  channel?: Channel;
}

export interface WebhookStatus {
  platform: ChannelPlatform;
  registered: boolean;
  url?: string;
  updatedAt?: number;
}

/* Sprint 7: customer management */

export interface Tag {
  id: string;
  name: string;
  /** One of TAG_COLORS. */
  color: string;
}

/** Preset tag palette derived from the design system. */
export const TAG_COLORS = [
  '#B45309',
  '#F4633A',
  '#FFB238',
  '#5B5BD6',
  '#15803D',
  '#DC2626'
] as const;

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  avatarUrl?: string;
  tags: Tag[];
  /** Channels this customer has conversed through. */
  channels: ChannelPlatform[];
  conversationCount: number;
  lastContactAt: number | null;
  createdAt: number;
  /** True when the row comes from the offline demo directory. */
  demo?: boolean;
}

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  tagIds?: string[];
}

export interface CustomerStats {
  conversationCount: number;
  messageCount: number;
  firstContactAt: number | null;
  lastContactAt: number | null;
  activeChannels: ChannelPlatform[];
}

export interface CustomerFilters {
  query: string;
  tagId: string | 'all';
  channel: 'all' | ChannelPlatform;
}

export interface PagedCustomers {
  customers: Customer[];
  hasMore: boolean;
  total: number;
}

/* Sprint 8: analytics dashboard */

export type TrendGranularity = 'day' | 'week' | 'month';
export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRange {
  /** Inclusive window start, epoch ms at local midnight. */
  from: number;
  /** Inclusive window end, epoch ms. */
  to: number;
  preset: DateRangePreset;
}

export interface OverviewStats {
  totalCustomers: number;
  /** Conversations with at least one message inside the range. */
  totalConversations: number;
  totalMessages: number;
  /** Unread is a "right now" metric and is not range scoped. */
  unreadCount: number;
  averageResponseMs: number | null;
  /** Period-over-period change in percent, null when the previous window is empty. */
  customersChange: number | null;
  conversationsChange: number | null;
  messagesChange: number | null;
  /** True when the numbers came from the offline demo aggregator. */
  demo?: boolean;
}

export interface TrendPoint {
  /** Bucket id: 2026-09-08 (day), 2026-09-07w (week), 2026-09 (month). */
  bucket: string;
  /** Bucket start, epoch ms. */
  timestamp: number;
  count: number;
  /** Message trends only: split by direction. */
  inbound?: number;
  outbound?: number;
}

export interface ChannelSlice {
  platform: ChannelPlatform;
  conversations: number;
  /** Share of all ranged conversations, 0..100 with one decimal. */
  percent: number;
}

export interface ResponseTimeStats {
  averageMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  samples: number;
  /** Service target the gauge is scaled against, in minutes. */
  targetMinutes: number;
}

export interface AgentPerformance {
  agentId: string;
  name: string;
  conversations: number;
  messages: number;
  averageResponseMs: number | null;
  /** 0..5, null when there is no feedback yet. */
  satisfaction: number | null;
}

export interface TopCustomer {
  id: string;
  name: string;
  avatarUrl?: string;
  conversations: number;
  messages: number;
  lastContactAt: number | null;
}

/* Sprint 9: notification and message centre */

export type NotificationType = 'message' | 'conversation' | 'customer' | 'system';
export type NotificationTypeFilter = 'all' | NotificationType;
export type NotificationReadFilter = 'all' | 'read' | 'unread';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'message',
  'conversation',
  'customer',
  'system'
];

/**
 * A single business event surfaced to the user. Named AppNotification because
 * the browser push API already owns the global Notification identifier.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Route the click handler navigates to; omitted for purely informational rows. */
  link?: string;
  /** Identifier of the entity the notification refers to. */
  refId?: string;
  /** True when the row comes from the offline demo directory. */
  demo?: boolean;
}

export interface NotificationFilters {
  type: NotificationTypeFilter;
  status: NotificationReadFilter;
}

export interface PagedNotifications {
  notifications: AppNotification[];
  hasMore: boolean;
  total: number;
}

/** Per-category delivery switches; in-app delivery is always on. */
export interface NotificationPreferences {
  message: boolean;
  conversation: boolean;
  customer: boolean;
  system: boolean;
  browserPush: boolean;
  sound: boolean;
}

export type NotificationConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/* Sprint 10: settings and account */

/** Theme selection. Dark is offered but disabled until a dark palette exists. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Resolved theme actually painted on the document. */
export type ResolvedTheme = 'light' | 'dark';

/** Editable identity block shown on the settings profile tab. */
export interface SettingsProfile {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatarUrl: string;
  company: string;
  timezone: string;
  language: string;
}

/** Subset of the profile the user is allowed to change. */
export interface ProfileUpdateRequest {
  name?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  company?: string;
  timezone?: string;
  language?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** A session that can be signed out remotely from the security tab. */
export interface LoginDevice {
  id: string;
  name: string;
  location: string;
  /** Epoch milliseconds of the last seen request. */
  lastActiveAt: number;
  /** True for the session issuing the request. */
  current: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  /** Opaque secret/otpauth payload rendered as a QR placeholder while demo-only. */
  twoFactorQr?: string;
  lastPasswordChangedAt?: number;
  devices: LoginDevice[];
}

export interface SecurityUpdateRequest {
  twoFactorEnabled: boolean;
  /** Six digit code required when turning two-factor authentication on. */
  twoFactorCode?: string;
}

export interface SystemPreferences {
  language: string;
  timezone: string;
  theme: ThemeMode;
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

/**
 * Settings channel rows are Sprint 5b channels: one registry, two surfaces, so
 * /dashboard/channels and the settings tab can never disagree.
 */
export type ChannelAccount = Channel;

export interface ChannelTestResult {
  channelId: string;
  ok: boolean;
  /** Round trip time of the probe in milliseconds. */
  latencyMs: number;
  checkedAt: number;
  /** Failure detail when ok is false. */
  message?: string;
}

export interface BindChannelRequest {
  platform: ChannelPlatform;
  credentials: Record<string, string>;
}

export type SettingsTab = 'profile' | 'security' | 'preferences' | 'channels';

/* Sprint 11: AI marketing */

/** Marketing intent the AI copy is written for. */
export type MarketingGoal = 'promotion' | 'new_arrival' | 'festival' | 'winback' | 'custom';
export type ContentLanguage = 'en' | 'fr' | 'sw';
export type ContentTone = 'professional' | 'friendly' | 'playful' | 'urgent';
export type ContentLength = 'short' | 'standard' | 'detailed';
export type TemplateCategory = MarketingGoal;
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type SendMode = 'immediate' | 'scheduled';
export type SendStatus = 'pending' | 'sent' | 'failed';
/** Why a selected recipient cannot receive the campaign. */
export type RecipientInvalidReason = 'no_channel_account' | 'missing_handle' | 'opted_out';

export const MARKETING_GOALS: MarketingGoal[] = [
  'promotion',
  'new_arrival',
  'festival',
  'winback',
  'custom'
];

export const CONTENT_LANGUAGES: ContentLanguage[] = ['en', 'fr', 'sw'];
export const CONTENT_TONES: ContentTone[] = ['professional', 'friendly', 'playful', 'urgent'];
export const CONTENT_LENGTHS: ContentLength[] = ['short', 'standard', 'detailed'];
export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled'
];

/** Channel body limits used by the preview pane; WhatsApp has no hard cap. */
export const CHANNEL_BODY_LIMIT: Record<ChannelPlatform, number> = {
  whatsapp: 4096,
  facebook: 8000,
  instagram: 2200,
  tiktok: 2200
};

/** One generated marketing message, editable before it is sent. */
export interface MarketingContent {
  id: string;
  title: string;
  body: string;
  cta: string;
  /** Visual brief for the suggested image, never rendered as a claim. */
  imageSuggestion: string;
  hashtags: string[];
  goal: MarketingGoal;
  language: ContentLanguage;
  tone: ContentTone;
  length: ContentLength;
  createdAt: number;
}

export interface AIContentRequest {
  prompt: string;
  goal: MarketingGoal;
  audience: string;
  language: ContentLanguage;
  tone: ContentTone;
  length: ContentLength;
  /** Refinement hint such as "more playful" or "add the discount". */
  feedback?: string;
  /** Set when regenerating or refining an earlier draft. */
  sourceId?: string;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  title: string;
  content: string;
  cta: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  title: string;
  content: string;
  cta: string;
}

/** Activity buckets used by the recipient selector. */
export type RecipientActivity = 'all' | 'active' | 'inactive';

export interface RecipientFilters {
  tagIds: string[];
  channels: ChannelPlatform[];
  activity: RecipientActivity;
  query: string;
}

export interface Recipient {
  id: string;
  name: string;
  channel: ChannelPlatform;
  /** Phone or handle the message is delivered to. */
  handle: string;
  tags: string[];
  valid: boolean;
  invalidReason?: RecipientInvalidReason;
}

export const DEFAULT_SEND_SETTINGS: SendSettings = {
  mode: 'immediate',
  scheduledAt: null,
  perMinute: 10,
  intervalMs: 2000,
  channels: ['whatsapp']
};

export interface SendSettings {
  mode: SendMode;
  /** Epoch ms; null for immediate delivery. */
  scheduledAt: number | null;
  perMinute: number;
  intervalMs: number;
  channels: ChannelPlatform[];
}

/** Hard product limits so a user setting can never trip a channel ban. */
export const RATE_LIMITS = {
  maxPerMinute: 60,
  minPerMinute: 1,
  minIntervalMs: 1000,
  maxIntervalMs: 60000
} as const;

export interface CampaignProgress {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  /** 0..100 integer. */
  percent: number;
  /** Measured delivery speed, messages per minute. */
  ratePerMinute: number;
}

export interface CampaignStats {
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  converted: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  conversionRate: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  content: MarketingContent;
  templateId?: string;
  recipientCount: number;
  channels: ChannelPlatform[];
  settings: SendSettings;
  progress: CampaignProgress;
  stats: CampaignStats;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  demo?: boolean;
}

export interface CampaignInput {
  name: string;
  content: MarketingContent;
  templateId?: string;
  recipientIds: string[];
  filters: RecipientFilters;
  settings: SendSettings;
}

export interface SendRecord {
  id: string;
  campaignId: string;
  campaignName: string;
  recipientId: string;
  recipientName: string;
  channel: ChannelPlatform;
  status: SendStatus;
  failureReason?: string;
  sentAt: number | null;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
}

export interface PagedSendHistory {
  records: SendRecord[];
  hasMore: boolean;
  total: number;
}

export interface MarketingOverview {
  monthSent: number;
  monthOpenRate: number;
  monthConversionRate: number;
  activeCampaigns: number;
}

/** Per-platform rendering of one message, used by the preview pane. */
export interface ContentPreview {
  platform: ChannelPlatform;
  title: string;
  body: string;
  cta: string;
  charCount: number;
  limit: number;
  truncated: boolean;
}

export interface CampaignListParams {
  query?: string;
  status?: CampaignStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface PagedCampaigns {
  campaigns: Campaign[];
  hasMore: boolean;
  total: number;
}

export interface SendHistoryParams {
  from?: number;
  to?: number;
  campaignId?: string;
  limit?: number;
  offset?: number;
}

/** Live view of the throttled delivery loop, driven by lib/sendQueue. */
export interface BatchSendProgress {
  total: number;
  done: number;
  failed: number;
  running: boolean;
  percent: number;
  /** Milliseconds until the queue drains at the current rate. */
  etaMs: number;
  currentName: string;
  /** Measured delivery speed while the loop runs, messages per minute. */
  ratePerMinute: number;
}

/** Sprint 12 automation workflow domain types. */
export * from './workflow';
