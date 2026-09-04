import { computed, watch, type Ref } from 'vue';
import { useConversationStore } from '../stores/conversation';
import { useMessageStore } from '../stores/message';
import type { MessageType } from '../types';

/** Single-conversation operations: load, page, send, retry, read. */
export function useConversation(conversationId: Ref<string | null>) {
  const conversationStore = useConversationStore();
  const messageStore = useMessageStore();

  const messages = computed(() =>
    conversationId.value ? messageStore.currentMessages(conversationId.value) : []
  );
  const loading = computed(() =>
    conversationId.value ? messageStore.isLoading(conversationId.value) : false
  );
  const hasMore = computed(() =>
    conversationId.value ? messageStore.hasMore(conversationId.value) : false
  );
  const error = computed(() => messageStore.error);

  watch(
    conversationId,
    (id) => {
      if (!id) return;
      void conversationStore.selectConversation(id);
      void messageStore.fetchMessages(id);
    },
    { immediate: true }
  );

  async function loadMore(): Promise<void> {
    if (conversationId.value) await messageStore.loadMore(conversationId.value);
  }

  async function send(content: string, type: MessageType = 'text', mediaUrl?: string): Promise<boolean> {
    if (!conversationId.value) return false;
    return messageStore.sendMessage(conversationId.value, { content, type, mediaUrl });
  }

  async function retry(messageId: string): Promise<boolean> {
    if (!conversationId.value) return false;
    return messageStore.retryMessage(conversationId.value, messageId);
  }

  return { messages, loading, hasMore, error, loadMore, send, retry };
}