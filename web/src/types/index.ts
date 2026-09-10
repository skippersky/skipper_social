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
