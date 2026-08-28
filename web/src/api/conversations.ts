import { apiGet } from './http';
import type { Conversation } from '../types';

const now = Date.now();

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

/**
 * Loads conversations from the backend; falls back to mock data while the
 * endpoint does not exist yet. Never rejects.
 */
export async function fetchConversations(): Promise<Conversation[]> {
  try {
    return await apiGet<Conversation[]>('/api/v1/conversations');
  } catch {
    return MOCK_CONVERSATIONS;
  }
}