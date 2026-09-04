<script setup lang="ts">
import ConversationItem from './ConversationItem.vue';
import type { Conversation } from '../../types';

defineProps<{ conversations: Conversation[]; selectedId: string | null }>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'archive', id: string): void;
  (e: 'read', id: string): void;
}>();
</script>

<template>
  <div class="conv-list">
    <ConversationItem
      v-for="conversation in conversations"
      :key="conversation.id"
      :conversation="conversation"
      :selected="conversation.id === selectedId"
      @select="emit('select', conversation.id)"
      @archive="emit('archive', conversation.id)"
      @read="emit('read', conversation.id)"
    />
  </div>
</template>

<style scoped>
.conv-list {
  flex: 1;
  overflow-y: auto;
}
</style>