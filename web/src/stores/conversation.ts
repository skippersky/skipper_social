import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as conversationApi from '../api/conversation';
import { apiErrorI18nKey } from '../api/http';
import { SOCKET_CONVERSATION_UPDATED, SOCKET_NEW_MESSAGE, socketBus } from '../events/socket';
import type { Conversation, ConversationFilters } from '../types';

const DEFAULT_FILTERS: ConversationFilters = { query: '', status: 'all', platform: 'all' };

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<ConversationFilters>({ ...DEFAULT_FILTERS });

  const currentConversation = computed(
    () => conversations.value.find((c) => c.id === currentConversationId.value) ?? null
  );

  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.archived ? 0 : c.unreadCount), 0)
  );

  const hasDemoData = computed(() => conversations.value.some((c) => c.demo));

  const filteredConversations = computed(() => {
    const query = filters.value.query.trim().toLowerCase();
    return conversations.value.filter((conversation) => {
      if (filters.value.status === 'archived') {
        if (!conversation.archived) return false;
      } else if (conversation.archived) {
        return false;
      } else if (filters.value.status === 'unread' && conversation.unreadCount === 0) {
        return false;
      }
      if (filters.value.platform !== 'all' && conversation.platform !== filters.value.platform) {
        return false;
      }
      if (query) {
        const haystack = `${conversation.contactName} ${conversation.contactPhone}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  });

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  async function fetchConversations(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      conversations.value = await conversationApi.getConversations();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  function moveToTop(conversation: Conversation): void {
    conversations.value = [
      conversation,
      ...conversations.value.filter((c) => c.id !== conversation.id)
    ];
  }

  async function selectConversation(id: string): Promise<void> {
    currentConversationId.value = id;
    await markAsRead(id);
  }

  async function markAsRead(id: string): Promise<void> {
    const conversation = conversations.value.find((c) => c.id === id);
    if (conversation && conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
    }
    try {
      await conversationApi.markAsRead(id);
    } catch (err) {
      fail(err);
    }
  }

  async function archive(id: string): Promise<boolean> {
    try {
      await conversationApi.archiveConversation(id);
      const conversation = conversations.value.find((c) => c.id === id);
      if (conversation) conversation.archived = true;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function unarchive(id: string): Promise<boolean> {
    try {
      await conversationApi.unarchiveConversation(id);
      const conversation = conversations.value.find((c) => c.id === id);
      if (conversation) conversation.archived = false;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  function setFilters(patch: Partial<ConversationFilters>): void {
    filters.value = { ...filters.value, ...patch };
  }

  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS };
  }

  // Observer: live updates from the WebSocket bus.
  socketBus.on((event) => {
    if (event.type === SOCKET_NEW_MESSAGE) {
      const conversation = conversations.value.find((c) => c.id === event.message.conversationId);
      if (!conversation) return;
      conversation.lastMessage = event.message.content;
      conversation.lastMessageTime = event.message.timestamp;
      if (event.message.sender === 'contact' && currentConversationId.value !== conversation.id) {
        conversation.unreadCount += 1;
      }
      moveToTop(conversation);
    } else if (event.type === SOCKET_CONVERSATION_UPDATED) {
      const conversation = conversations.value.find((c) => c.id === event.conversationId);
      if (conversation) Object.assign(conversation, event.patch);
    }
  });

  return {
    conversations,
    currentConversationId,
    currentConversation,
    loading,
    error,
    filters,
    filteredConversations,
    hasDemoData,
    totalUnread,
    fetchConversations,
    selectConversation,
    markAsRead,
    archive,
    unarchive,
    setFilters,
    resetFilters
  };
});