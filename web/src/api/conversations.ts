import { apiGet, apiPost } from './http';
import type { Conversation, Message } from '../types';

const now = Date.now();

export interface FallbackResult<T> {
  data: T;
  /** True when the backend was unreachable and mock data is shown. */
  degraded: boolean;
}

/** Fallback data used until GET /api/v1/conversations exists (Sprint 3). */
export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c-1',
    contactName: 'Amani Juma',
    contactPhone: '+255 712 345 678',
    lastMessage: 'Habari! Bei ya bidhaa mpya ni ngapi? Ningependa kujua zaidi kuhusu vifurushi.',
    lastMessageTime: now - 4 * 60_000,
    unreadCount: 2
  },
  {
    id: 'c-2',
    contactName: 'Neema Wanjiru',
    contactPhone: '+254 723 456 789',
    lastMessage: 'Asante kwa majibu ya haraka, nitarudi kesho.',
    lastMessageTime: now - 55 * 60_000,
    unreadCount: 0
  },
  {
    id: 'c-3',
    contactName: 'Baraka Okonkwo',
    contactPhone: '+256 701 234 567',
    lastMessage: 'Nitapita dukani kesho alasiri kuchukua oda yangu.',
    lastMessageTime: now - 5 * 3_600_000,
    unreadCount: 1
  },
  {
    id: 'c-4',
    contactName: 'Zuri Abebe',
    contactPhone: '+251 911 223 344',
    lastMessage: 'Picha ya bidhaa imefika vizuri sana, asante!',
    lastMessageTime: now - 3 * 86_400_000,
    unreadCount: 0
  }
];

const MOCK_IMAGE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' rx='12' fill='%23FFB238'/%3E%3Ctext x='120' y='88' font-size='20' text-anchor='middle' fill='%23221507'%3EProduct%3C/text%3E%3C/svg%3E";

/** Fallback messages (text / image / location) until the backend arrives. */
export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm-1',
    conversationId: 'c-1',
    content: 'Habari! Bei ya bidhaa mpya ni ngapi?',
    type: 'text',
    sender: 'contact',
    timestamp: now - 9 * 60_000,
    status: 'read'
  },
  {
    id: 'm-2',
    conversationId: 'c-1',
    content: 'Karibu! Hii ndiyo bei ya wiki hii.',
    type: 'text',
    sender: 'user',
    timestamp: now - 8 * 60_000,
    status: 'read'
  },
  {
    id: 'm-3',
    conversationId: 'c-1',
    content: 'product-catalog.jpg',
    type: 'image',
    sender: 'user',
    timestamp: now - 7 * 60_000,
    status: 'sent',
    mediaUrl: MOCK_IMAGE_URL
  },
  {
    id: 'm-4',
    conversationId: 'c-1',
    content: 'Kariakoo Market, Dar es Salaam',
    type: 'location',
    sender: 'contact',
    timestamp: now - 6 * 60_000,
    status: 'read',
    mediaUrl: 'https://example.com/map/kariakoo'
  },
  {
    id: 'm-5',
    conversationId: 'c-1',
    content: 'Ningependa kujua zaidi kuhusu vifurushi.',
    type: 'text',
    sender: 'contact',
    timestamp: now - 4 * 60_000,
    status: 'read'
  }
];

/**
 * Loads conversations from the backend; degrades to mock data while the
 * endpoint does not exist yet. Never rejects.
 */
export async function fetchConversations(): Promise<FallbackResult<Conversation[]>> {
  try {
    return { data: await apiGet<Conversation[]>('/api/v1/conversations'), degraded: false };
  } catch {
    return { data: MOCK_CONVERSATIONS, degraded: true };
  }
}

/** Loads messages of one conversation; degrades to mock data. Never rejects. */
export async function fetchMessages(conversationId: string): Promise<FallbackResult<Message[]>> {
  try {
    return {
      data: await apiGet<Message[]>(`/api/v1/conversations/${conversationId}/messages`),
      degraded: false
    };
  } catch {
    return {
      data: MOCK_MESSAGES.filter((m) => m.conversationId === conversationId),
      degraded: true
    };
  }
}

/**
 * Sends a message. The backend endpoint lands in Sprint 3; the composer stays
 * disabled in the UI until then, but the client contract is ready.
 */
export function sendMessage(conversationId: string, content: string, type: string): Promise<Message> {
  return apiPost<Message>(`/api/v1/conversations/${conversationId}/messages`, { content, type });
}