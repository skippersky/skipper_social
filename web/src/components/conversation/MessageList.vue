<script setup lang="ts">
import { watch } from 'vue';
import MessageBubble from './MessageBubble.vue';
import TypingIndicator from './TypingIndicator.vue';
import { useMessageList } from '../../composables/useMessageList';
import type { MessageListItem } from '../../composables/messageGrouping';

const props = defineProps<{
  items: MessageListItem[];
  loading: boolean;
  hasMore: boolean;
  remoteTyping?: boolean;
}>();

const emit = defineEmits<{
  (e: 'loadMore'): void;
  (e: 'retry', messageId: string): void;
}>();

const { containerRef, onScroll, scrollToBottom, onNewMessage } = useMessageList(() => {
  if (props.hasMore && !props.loading) emit('loadMore');
});

watch(
  () => props.items.length,
  (length, previousLength) => {
    if (previousLength === 0 && length > 0) scrollToBottom();
    else if (length > (previousLength ?? 0)) onNewMessage();
  }
);
</script>

<template>
  <div ref="containerRef" class="msg-list" @scroll.passive="onScroll">
    <p v-if="loading && items.length === 0" class="msg-list__note">…</p>
    <button
      v-if="hasMore"
      class="msg-list__more"
      type="button"
      :disabled="loading"
      @click="emit('loadMore')"
    >↑</button>
    <template v-for="item in items" :key="item.key">
      <p v-if="item.kind === 'day'" class="msg-list__day">{{ item.label }}</p>
      <MessageBubble
        v-else-if="item.message"
        :message="item.message"
        :show-timestamp="item.showTimestamp"
        @retry="emit('retry', item.message.id)"
      />
    </template>
    <TypingIndicator v-if="remoteTyping" />
  </div>
</template>

<style scoped>
.msg-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  background: var(--ks-bg-base);
}
.msg-list__day {
  margin: 14px 0 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ks-text-tertiary);
  text-transform: uppercase;
}
.msg-list__more {
  align-self: center;
  margin-bottom: 8px;
  border: none;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  color: var(--ks-text-secondary);
  cursor: pointer;
}
.msg-list__more:disabled {
  opacity: 0.5;
}
.msg-list__note {
  margin: auto;
  color: var(--ks-text-tertiary);
  font-size: 13px;
}
</style>