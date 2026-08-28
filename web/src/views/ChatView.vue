<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ConversationList from '../components/ConversationList.vue';
import ChatWindow from '../components/ChatWindow.vue';
import { fetchConversations } from '../api/conversations';
import type { Conversation } from '../types';

const router = useRouter();
const conversations = ref<Conversation[]>([]);
const selected = ref<Conversation | null>(null);
const isMobile = ref(false);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(max-width: 767px)');
  isMobile.value = query.matches;
  query.addEventListener?.('change', (event: MediaQueryListEvent) => {
    isMobile.value = event.matches;
  });
}

onMounted(async () => {
  conversations.value = await fetchConversations();
});

function onSelect(conversation: Conversation): void {
  selected.value = conversation;
}

function backToList(): void {
  selected.value = null;
}
</script>

<template>
  <div class="chat-page">
    <aside class="chat-page__sidebar" :class="{ 'is-hidden-mobile': selected && isMobile }">
      <div class="chat-page__sidebar-head">
        <button class="chat-page__home" type="button" aria-label="返回首页" @click="router.push('/')">
          ←
        </button>
        <h2 class="chat-page__title">会话</h2>
        <span class="chat-page__count">{{ conversations.length }}</span>
      </div>
      <ConversationList
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
        ← 返回列表
      </button>
      <ChatWindow :conversation="selected" />
    </main>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: 100dvh;
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
  background: var(--ks-bg-elevated);
}
.chat-page__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.chat-page__count {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
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
  color: var(--ks-primary);
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