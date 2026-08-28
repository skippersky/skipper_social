<script setup lang="ts">
import { computed } from 'vue';
import KsAvatar from './KsAvatar.vue';
import { relativeTime } from '../lib/relativeTime';
import type { Conversation } from '../types';

const props = defineProps<{
  conversations: Conversation[];
  selectedId?: string | null;
}>();

const emit = defineEmits<{ (event: 'select', conversation: Conversation): void }>();

const PREVIEW_LIMIT = 30;

function preview(conversation: Conversation): string {
  const text = conversation.lastMessage ?? '';
  return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text;
}

function badge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

const sorted = computed(() =>
  [...props.conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime)
);
</script>

<template>
  <ul class="conv-list" role="listbox" aria-label="会话列表">
    <li
      v-for="conversation in sorted"
      :key="conversation.id"
      class="conv-item"
      :class="{ 'conv-item--selected': conversation.id === selectedId }"
      role="option"
      :aria-selected="conversation.id === selectedId"
      tabindex="0"
      @click="emit('select', conversation)"
      @keydown.enter="emit('select', conversation)"
    >
      <KsAvatar :name="conversation.contactName" :src="conversation.avatarUrl" :size="48" />
      <div class="conv-item__body">
        <div class="conv-item__row">
          <span class="conv-item__name">{{ conversation.contactName }}</span>
          <span class="conv-item__time">{{ relativeTime(conversation.lastMessageTime) }}</span>
        </div>
        <div class="conv-item__row">
          <span class="conv-item__preview">{{ preview(conversation) }}</span>
          <span v-if="conversation.unreadCount > 0" class="conv-item__badge">
            {{ badge(conversation.unreadCount) }}
          </span>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.conv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}
.conv-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.conv-item:hover {
  background: var(--ks-bg-elevated);
}
.conv-item--selected {
  background: rgba(232, 163, 61, 0.1);
  border-left-color: var(--ks-primary);
}
.conv-item__body {
  flex: 1;
  min-width: 0;
}
.conv-item__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.conv-item__name {
  font-weight: 500;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-item__time {
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  flex-shrink: 0;
}
.conv-item__preview {
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-item__badge {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ks-primary);
  color: var(--ks-primary-ink);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  text-align: center;
}
</style>