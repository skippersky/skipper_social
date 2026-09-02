<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ConversationList from '../components/ConversationList.vue';
import ChatWindow from '../components/ChatWindow.vue';
import { fetchConversations, fetchMessages } from '../api/conversations';
import { useI18nStore } from '../i18n';
import { ConversationSocket, defaultWsUrl, type ConversationUpdate, type MessageStatusUpdate, type SocketState } from '../lib/websocket';
import type { Conversation, Message } from '../types';

const router = useRouter();
const i18n = useI18nStore();

const conversations = ref<Conversation[]>([]);
const conversationsLoading = ref(true);
const conversationsDegraded = ref(false);

const selected = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);
const messagesLoading = ref(false);
const messagesDegraded = ref(false);

const wsState = ref<SocketState>('closed');
let socket: ConversationSocket | null = null;
const isMobile = ref(false);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(max-width: 767px)');
  isMobile.value = query.matches;
  query.addEventListener?.('change', (event: MediaQueryListEvent) => {
    isMobile.value = event.matches;
  });
}

const wsLabelKey = { open: 'chat.wsOpen', connecting: 'chat.wsConnecting', closed: 'chat.wsClosed' } as const;

async function loadConversations(): Promise<void> {
  conversationsLoading.value = true;
  const result = await fetchConversations();
  conversations.value = result.data;
  conversationsDegraded.value = result.degraded;
  conversationsLoading.value = false;
}

async function loadMessages(conversationId: string): Promise<void> {
  messagesLoading.value = true;
  const result = await fetchMessages(conversationId);
  if (selected.value?.id === conversationId) {
    messages.value = result.data;
    messagesDegraded.value = result.degraded;
  }
  messagesLoading.value = false;
}

function onSelect(conversation: Conversation): void {
  selected.value = conversation;
  messages.value = [];
  messagesDegraded.value = false;
  void loadMessages(conversation.id);
}

function applyUpdate(update: ConversationUpdate): void {
  conversations.value = conversations.value.map((c) =>
    c.id === update.conversationId
      ? {
          ...c,
          lastMessage: update.lastMessage,
          lastMessageTime: update.lastMessageTime,
          unreadCount: update.unreadCount ?? c.unreadCount
        }
      : c
  );
  if (selected.value?.id === update.conversationId) {
    selected.value = { ...selected.value, lastMessage: update.lastMessage, lastMessageTime: update.lastMessageTime };
  }
}

function applyNewMessage(message: Message): void {
  if (selected.value?.id === message.conversationId && !messages.value.some((m) => m.id === message.id)) {
    messages.value = [...messages.value, message];
  }
}

function applyStatus(update: MessageStatusUpdate): void {
  messages.value = messages.value.map((m) => (m.id === update.messageId ? { ...m, status: update.status } : m));
}

onMounted(async () => {
  await loadConversations();
  socket = new ConversationSocket({
    url: defaultWsUrl(),
    onStateChange: (state) => {
      wsState.value = state;
    },
    onUpdate: applyUpdate,
    onNewMessage: applyNewMessage,
    onMessageStatus: applyStatus
  });
});

onUnmounted(() => {
  socket?.close();
});

function backToList(): void {
  selected.value = null;
}
</script>

<template>
  <div class="chat-page">
    <aside class="chat-page__sidebar" :class="{ 'is-hidden-mobile': selected && isMobile }">
      <div class="chat-page__sidebar-head">
        <button class="chat-page__home" type="button" :aria-label="i18n.t('chat.homeAria')" @click="router.push('/home')">
          ←
        </button>
        <h2 class="chat-page__title">{{ i18n.t('chat.title') }}</h2>
        <span class="chat-page__ws" :class="`chat-page__ws--${wsState}`" :title="i18n.t(wsLabelKey[wsState])">
          <span class="chat-page__ws-dot" aria-hidden="true"></span>
          {{ i18n.t(wsLabelKey[wsState]) }}
        </span>
        <span class="chat-page__count">{{ conversations.length }}</span>
      </div>
      <div v-if="conversationsDegraded && !conversationsLoading" class="chat-page__notice">
        <span>{{ i18n.t('api.network') }}</span>
        <button type="button" @click="loadConversations">{{ i18n.t('common.retry') }}</button>
      </div>
      <div v-if="conversationsLoading" class="chat-page__loading">
        <van-skeleton title :row="6" />
      </div>
      <van-empty v-else-if="conversations.length === 0" :description="i18n.t('chat.empty')" />
      <ConversationList
        v-else
        :conversations="conversations"
        :selected-id="selected?.id ?? null"
        @select="onSelect"
      />
    </aside>
    <main class="chat-page__main" :class="{ 'is-hidden-mobile': !selected && isMobile }">
      <button
        v-if="isMobile && selected"
        class="chat-page__back"
        type="button"
        @click="backToList"
      >
        ← {{ i18n.t('chat.back') }}
      </button>
      <ChatWindow
        :conversation="selected"
        :messages="messages"
        :loading="messagesLoading"
        :degraded="messagesDegraded"
        @retry="selected && loadMessages(selected.id)"
      />
    </main>
  </div>
</template>

<style scoped>
.chat-page {
  flex: 1;
  display: flex;
  min-height: 0;
  height: calc(100dvh - 57px);
  background: var(--ks-bg-base);
}
.chat-page__sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ks-bg-surface);
  border-right: 1px solid var(--ks-border-default);
}
.chat-page__sidebar-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ks-border-default);
}
.chat-page__home {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  cursor: pointer;
}
.chat-page__home:hover {
  background: var(--ks-bg-muted);
}
.chat-page__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.chat-page__ws {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.chat-page__ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ks-text-tertiary);
}
.chat-page__ws--open .chat-page__ws-dot {
  background: var(--ks-success);
}
.chat-page__ws--connecting .chat-page__ws-dot {
  background: var(--ks-warning);
}
.chat-page__count {
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 2px 10px;
}
.chat-page__notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.08);
  border-bottom: 1px solid var(--ks-border-default);
}
.chat-page__notice button {
  border: none;
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.chat-page__loading {
  padding: 16px;
}
.chat-page__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.chat-page__back {
  align-self: flex-start;
  margin: 8px 12px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 14px;
  cursor: pointer;
}
@media (min-width: 768px) and (max-width: 1024px) {
  .chat-page__sidebar {
    width: 280px;
  }
}
@media (max-width: 767px) {
  .chat-page__sidebar {
    width: 100%;
  }
  .is-hidden-mobile {
    display: none;
  }
}
</style>