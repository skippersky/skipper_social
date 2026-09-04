import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiErrorI18nKey } from '../api/http';
import * as messageApi from '../api/message';
import type { SendMessagePayload } from '../api/message';
import { SOCKET_MESSAGE_READ, SOCKET_NEW_MESSAGE, socketBus } from '../events/socket';
import type { Message } from '../types';

const PAGE_LIMIT = 20;

export const useMessageStore = defineStore('message', () => {
  const messagesMap = ref<Record<string, Message[]>>({});
  const hasMoreMap = ref<Record<string, boolean>>({});
  const loadingMap = ref<Record<string, boolean>>({});
  const sending = ref(false);
  const error = ref<string | null>(null);

  function messagesOf(conversationId: string): Message[] {
    return messagesMap.value[conversationId] ?? [];
  }

  const currentMessages = computed(() => (conversationId: string) => messagesOf(conversationId));
  const hasMore = computed(() => (conversationId: string) => hasMoreMap.value[conversationId] ?? false);
  const isLoading = computed(() => (conversationId: string) => loadingMap.value[conversationId] ?? false);
  const isSending = computed(() => sending.value);

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function setList(conversationId: string, list: Message[], hasMore: boolean): void {
    messagesMap.value = { ...messagesMap.value, [conversationId]: list };
    hasMoreMap.value = { ...hasMoreMap.value, [conversationId]: hasMore };
  }

  async function fetchMessages(conversationId: string): Promise<void> {
    loadingMap.value = { ...loadingMap.value, [conversationId]: true };
    error.value = null;
    try {
      const page = await messageApi.getMessages(conversationId, { limit: PAGE_LIMIT });
      setList(conversationId, page.messages, page.hasMore);
    } catch (err) {
      fail(err);
    } finally {
      loadingMap.value = { ...loadingMap.value, [conversationId]: false };
    }
  }

  async function loadMore(conversationId: string): Promise<void> {
    const list = messagesOf(conversationId);
    if (!list.length || loadingMap.value[conversationId]) return;
    const oldest = Math.min(...list.map((m) => m.timestamp));
    loadingMap.value = { ...loadingMap.value, [conversationId]: true };
    try {
      const page = await messageApi.getMessages(conversationId, { before: oldest, limit: PAGE_LIMIT });
      const known = new Set(list.map((m) => m.id));
      const older = page.messages.filter((m) => !known.has(m.id));
      setList(conversationId, [...older, ...list], page.hasMore);
    } catch (err) {
      fail(err);
    } finally {
      loadingMap.value = { ...loadingMap.value, [conversationId]: false };
    }
  }

  function replaceMessage(conversationId: string, localId: string, next: Message): void {
    setList(
      conversationId,
      messagesOf(conversationId).map((m) => (m.id === localId ? next : m)),
      hasMoreMap.value[conversationId] ?? false
    );
  }

  async function sendMessage(conversationId: string, payload: SendMessagePayload): Promise<boolean> {
    sending.value = true;
    error.value = null;
    const localId = `local-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const optimistic: Message = {
      id: localId,
      conversationId,
      content: payload.content,
      type: payload.type,
      sender: 'user',
      timestamp: Date.now(),
      status: 'sending',
      mediaUrl: payload.mediaUrl
    };
    setList(conversationId, [...messagesOf(conversationId), optimistic], hasMoreMap.value[conversationId] ?? false);
    try {
      const saved = await messageApi.sendMessage(conversationId, payload);
      replaceMessage(conversationId, localId, { ...saved, status: saved.status === 'sending' ? 'sent' : saved.status });
      return true;
    } catch (err) {
      const failedMessage: Message = { ...optimistic, status: 'failed' };
      replaceMessage(conversationId, localId, failedMessage);
      fail(err);
      return false;
    } finally {
      sending.value = false;
    }
  }

  async function retryMessage(conversationId: string, messageId: string): Promise<boolean> {
    const original = messagesOf(conversationId).find((m) => m.id === messageId);
    if (!original || original.status !== 'failed') return false;
    replaceMessage(conversationId, messageId, { ...original, status: 'sending' });
    try {
      const saved = await messageApi.sendMessage(conversationId, {
        content: original.content,
        type: original.type,
        mediaUrl: original.mediaUrl
      });
      replaceMessage(conversationId, messageId, saved);
      return true;
    } catch (err) {
      replaceMessage(conversationId, messageId, { ...original, status: 'failed' });
      fail(err);
      return false;
    }
  }

  async function deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    try {
      await messageApi.deleteMessage(messageId);
      setList(
        conversationId,
        messagesOf(conversationId).filter((m) => m.id !== messageId),
        hasMoreMap.value[conversationId] ?? false
      );
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  // Observer: live messages and read receipts from the WebSocket bus.
  socketBus.on((event) => {
    if (event.type === SOCKET_NEW_MESSAGE) {
      const list = messagesOf(event.message.conversationId);
      if (list.some((m) => m.id === event.message.id)) return;
      setList(event.message.conversationId, [...list, event.message], hasMoreMap.value[event.message.conversationId] ?? false);
    } else if (event.type === SOCKET_MESSAGE_READ) {
      const list = messagesOf(event.conversationId).map((m) =>
        m.sender === 'user' && (!event.messageId || m.id === event.messageId)
          ? { ...m, status: 'read' as const }
          : m
      );
      setList(event.conversationId, list, hasMoreMap.value[event.conversationId] ?? false);
    }
  });

  return {
    messagesMap,
    sending,
    error,
    currentMessages,
    hasMore,
    isLoading,
    isSending,
    fetchMessages,
    loadMore,
    sendMessage,
    retryMessage,
    deleteMessage
  };
});