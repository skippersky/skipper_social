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
}

export type MessageType = 'text' | 'image' | 'location';
export type MessageSender = 'user' | 'contact';
export type MessageStatus = 'sending' | 'sent' | 'read';

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
}

export interface TokenResult {
  channelId: string;
  tokenExpiresAt: number;
}

export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
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