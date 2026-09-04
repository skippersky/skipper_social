import { apiBase, apiDelete, apiGet, apiPost, ApiError, REQUEST_TIMEOUT_MS } from './http';
import type { ApiResponse } from './http';
import {
  demoInboxDeleteMessage,
  demoInboxMessages,
  demoInboxSendMessage,
  demoUploadMedia,
  isMissingBackend
} from './demo';
import type { Message, MessageType, PagedMessages, UploadResult } from '../types';

export interface MessagePageParams {
  /** Load messages strictly older than this timestamp. */
  before?: number;
  limit?: number;
}

export interface SendMessagePayload {
  content: string;
  type: MessageType;
  mediaUrl?: string;
}

export async function getMessages(
  conversationId: string,
  params?: MessagePageParams
): Promise<PagedMessages> {
  const search = new URLSearchParams();
  if (params?.before) search.set('before', String(params.before));
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  try {
    return await apiGet<PagedMessages>(
      `/api/v1/conversations/${conversationId}/messages${query ? `?${query}` : ''}`
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInboxMessages(conversationId, params?.before, params?.limit);
  }
}

export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload
): Promise<Message> {
  try {
    return await apiPost<Message>(`/api/v1/conversations/${conversationId}/messages`, payload);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInboxSendMessage(conversationId, payload);
  }
}

/** Multipart upload; falls back to a local placeholder when backend is absent. */
export async function uploadMedia(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}/api/v1/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
      signal: controller.signal
    });
    const payload = (await response.json()) as ApiResponse<UploadResult>;
    if (!response.ok || !payload.success) {
      throw new ApiError(payload.code ?? `HTTP_${response.status}`, payload.message ?? response.statusText);
    }
    return payload.data;
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUploadMedia(file.name);
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  try {
    await apiDelete<void>(`/api/v1/messages/${messageId}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoInboxDeleteMessage(messageId);
  }
}