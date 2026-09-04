import { apiGet, apiPost } from './http';
import {
  demoInboxConversations,
  demoInboxMarkRead,
  demoInboxSetArchived,
  isMissingBackend
} from './demo';
import type { Conversation } from '../types';

const CONVERSATIONS = '/api/v1/conversations';

export interface ConversationListParams {
  query?: string;
  status?: 'all' | 'unread' | 'archived';
  platform?: string;
}

function toQuery(params?: ConversationListParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.platform && params.platform !== 'all') search.set('platform', params.platform);
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function getConversations(params?: ConversationListParams): Promise<Conversation[]> {
  try {
    return await apiGet<Conversation[]>(`${CONVERSATIONS}${toQuery(params)}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInboxConversations().map((conversation) => ({ ...conversation, demo: true }));
  }
}

export async function getConversationById(id: string): Promise<Conversation> {
  return apiGet<Conversation>(`${CONVERSATIONS}/${id}`);
}

export async function markAsRead(conversationId: string): Promise<void> {
  try {
    await apiPost<void>(`${CONVERSATIONS}/${conversationId}/read`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoInboxMarkRead(conversationId);
  }
}

export async function archiveConversation(id: string): Promise<void> {
  try {
    await apiPost<void>(`${CONVERSATIONS}/${id}/archive`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoInboxSetArchived(id, true);
  }
}

export async function unarchiveConversation(id: string): Promise<void> {
  try {
    await apiPost<void>(`${CONVERSATIONS}/${id}/unarchive`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoInboxSetArchived(id, false);
  }
}

export async function assignConversation(id: string, agentId?: string): Promise<void> {
  await apiPost<void>(`${CONVERSATIONS}/${id}/assign`, { agentId: agentId ?? null });
}