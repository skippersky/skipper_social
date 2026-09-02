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