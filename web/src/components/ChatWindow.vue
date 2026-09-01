<script setup lang="ts">
import KsAvatar from './KsAvatar.vue';
import { useI18nStore } from '../i18n';
import { relativeTime } from '../lib/relativeTime';
import type { Conversation, Message, MessageStatus } from '../types';

defineProps<{
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  degraded: boolean;
}>();

defineEmits<{ (event: 'retry'): void }>();

const i18n = useI18nStore();

function statusGlyph(status: MessageStatus): string {
  if (status === 'sending') return '...';
  if (status === 'sent') return '✓';
  return '✓✓';
}
</script>

<template>
  <div class="chat-window">
    <div v-if="!conversation" class="chat-window__empty">
      <h3 class="chat-window__empty-title">{{ i18n.t('chat.emptyTitle') }}</h3>
      <p class="chat-window__empty-hint">{{ i18n.t('chat.emptyHint') }}</p>
    </div>
    <template v-else>
      <header class="chat-window__header">
        <KsAvatar :name="conversation.contactName" :src="conversation.avatarUrl" :size="40" />
        <div class="chat-window__contact">
          <h4 class="chat-window__contact-name">{{ conversation.contactName }}</h4>
          <p class="chat-window__contact-phone">{{ conversation.contactPhone }}</p>
        </div>
      </header>
      <div v-if="degraded && !loading" class="chat-window__notice">
        <span>{{ i18n.t('api.network') }}</span>
        <button type="button" @click="$emit('retry')">{{ i18n.t('common.retry') }}</button>
      </div>
      <div class="chat-window__messages">
        <van-skeleton v-if="loading" title :row="4" class="chat-window__skeleton" />
        <p v-else-if="messages.length === 0" class="chat-window__messages-hint">
          {{ i18n.t('chat.messagesHint') }}
        </p>
        <div v-else class="chat-window__thread">
          <div
            v-for="message in messages"
            :key="message.id"
            class="msg"
            :class="message.sender === 'user' ? 'msg--user' : 'msg--contact'"
          >
            <div class="msg__bubble">
              <img
                v-if="message.type === 'image' && message.mediaUrl"
                :src="message.mediaUrl"
                :alt="message.content"
                class="msg__image"
              />
              <a
                v-else-if="message.type === 'location' && message.mediaUrl"
                class="msg__location"
                :href="message.mediaUrl"
                target="_blank"
                rel="noopener"
              >
                <span class="msg__location-label">{{ i18n.t('msg.location') }}</span>
                <span class="msg__location-name">{{ message.content }}</span>
              </a>
              <span v-else class="msg__text">{{ message.content }}</span>
            </div>
            <p class="msg__meta">
              {{ relativeTime(message.timestamp, Date.now(), i18n.locale) }}
              <span v-if="message.sender === 'user'" class="msg__status" :title="message.status">
                {{ statusGlyph(message.status) }}
              </span>
            </p>
          </div>
        </div>
      </div>
      <footer class="chat-window__composer">
        <input
          class="chat-window__input"
          type="text"
          :placeholder="i18n.t('chat.composerPlaceholder')"
          disabled
          aria-disabled="true"
        />
        <button class="chat-window__send" type="button" disabled>{{ i18n.t('chat.send') }}</button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}
.chat-window__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}
.chat-window__empty-title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
}
.chat-window__empty-hint {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 14px;
  line-height: 21px;
}
.chat-window__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--ks-bg-surface);
  border-bottom: 1px solid var(--ks-border-default);
}
.chat-window__contact-name {
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}
.chat-window__contact-phone {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.chat-window__notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 20px;
  font-size: 12px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.08);
  border-bottom: 1px solid var(--ks-border-default);
}
.chat-window__notice button {
  border: none;
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.chat-window__messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.chat-window__skeleton {
  max-width: 480px;
}
.chat-window__messages-hint {
  margin: auto;
  color: var(--ks-text-tertiary);
  font-size: 14px;
  line-height: 21px;
}
.chat-window__thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg {
  display: flex;
  flex-direction: column;
  max-width: 76%;
}
.msg--contact {
  align-self: flex-start;
}
.msg--user {
  align-self: flex-end;
  align-items: flex-end;
}
.msg__bubble {
  padding: 10px 14px;
  font-size: 15px;
  line-height: 23px;
}
.msg--contact .msg__bubble {
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
  border-radius: 16px 16px 16px 4px;
}
.msg--user .msg__bubble {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  border-radius: 16px 16px 4px 16px;
}
.msg__image {
  display: block;
  max-width: 240px;
  border-radius: 10px;
}
.msg__location {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-decoration: none;
  color: inherit;
}
.msg__location-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
}
.msg__location-name {
  text-decoration: underline;
}
.msg__meta {
  margin: 4px 2px 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  display: flex;
  gap: 6px;
  align-items: center;
}
.msg__status {
  color: var(--ks-success);
  font-size: 11px;
}
.chat-window__composer {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  background: var(--ks-bg-surface);
  border-top: 1px solid var(--ks-border-default);
}
.chat-window__input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 15px;
}
.chat-window__input::placeholder {
  color: var(--ks-text-tertiary);
}
.chat-window__input:disabled {
  background: var(--ks-bg-muted);
  opacity: 0.8;
}
.chat-window__send {
  height: 44px;
  padding: 0 20px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.chat-window__send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>