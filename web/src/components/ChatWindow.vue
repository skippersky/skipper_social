<script setup lang="ts">
import KsAvatar from './KsAvatar.vue';
import type { Conversation } from '../types';

defineProps<{ conversation: Conversation | null }>();
</script>

<template>
  <div class="chat-window">
    <div v-if="!conversation" class="chat-window__empty">
      <h3 class="chat-window__empty-title">选择一个对话开始聊天</h3>
      <p class="chat-window__empty-hint">从会话列表中挑选一位联系人</p>
    </div>
    <template v-else>
      <header class="chat-window__header">
        <KsAvatar :name="conversation.contactName" :src="conversation.avatarUrl" :size="40" />
        <div class="chat-window__contact">
          <h4 class="chat-window__contact-name">{{ conversation.contactName }}</h4>
          <p class="chat-window__contact-phone">{{ conversation.contactPhone }}</p>
        </div>
      </header>
      <div class="chat-window__messages">
        <p class="chat-window__messages-hint">暂无消息记录，收发功能将在下一阶段开放</p>
      </div>
      <footer class="chat-window__composer">
        <input
          class="chat-window__input"
          type="text"
          placeholder="消息功能开发中，敬请期待"
          disabled
          aria-disabled="true"
        />
        <button class="chat-window__send" type="button" disabled>发送</button>
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
.chat-window__messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.chat-window__messages-hint {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 14px;
  line-height: 21px;
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
  border: 1px solid var(--ks-border-input);
  background: var(--ks-bg-input);
  color: var(--ks-text-primary);
  font-size: 15px;
}
.chat-window__input::placeholder {
  color: var(--ks-text-tertiary);
}
.chat-window__input:disabled {
  opacity: 0.6;
}
.chat-window__send {
  height: 44px;
  padding: 0 20px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-primary);
  color: var(--ks-primary-ink);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.chat-window__send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>