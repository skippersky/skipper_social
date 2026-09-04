<script setup lang="ts">
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { Conversation } from '../../types';

defineProps<{ conversation: Conversation; selected: boolean }>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'archive'): void;
  (e: 'read'): void;
}>();

const i18n = useI18nStore();

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  facebook: '#1877F2',
  instagram: '#DD2A7B',
  tiktok: '#010101'
};
</script>

<template>
  <van-swipe-cell>
    <button
      class="conv-item"
      :class="{ 'is-selected': selected, 'is-archived': conversation.archived }"
      type="button"
      @click="emit('select')"
    >
      <span class="conv-item__avatar">
        <KsAvatar :name="conversation.contactName" :size="44" />
        <span
          v-if="conversation.platform"
          class="conv-item__platform"
          :style="{ background: PLATFORM_COLORS[conversation.platform] }"
          :title="conversation.platform"
          aria-hidden="true"
        ></span>
      </span>
      <span class="conv-item__body">
        <span class="conv-item__row">
          <span class="conv-item__name">{{ conversation.contactName }}</span>
          <span class="conv-item__time">
            {{ relativeTime(conversation.lastMessageTime, Date.now(), i18n.locale) }}
          </span>
        </span>
        <span class="conv-item__row">
          <span class="conv-item__preview">{{ conversation.lastMessage }}</span>
          <span v-if="conversation.unreadCount > 0" class="conv-item__badge">
            {{ conversation.unreadCount }}
          </span>
        </span>
      </span>
    </button>
    <template #right>
      <button class="conv-item__swipe" type="button" @click="emit('read')">
        {{ i18n.t('inbox.markRead') }}
      </button>
      <button class="conv-item__swipe conv-item__swipe--warn" type="button" @click="emit('archive')">
        {{ i18n.t('inbox.archive') }}
      </button>
    </template>
  </van-swipe-cell>
</template>

<style scoped>
.conv-item {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.conv-item.is-selected {
  background: var(--ks-grad-soft);
}
.conv-item.is-archived .conv-item__name,
.conv-item.is-archived .conv-item__preview {
  color: var(--ks-text-tertiary);
}
.conv-item__avatar {
  position: relative;
  flex-shrink: 0;
}
.conv-item__platform {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--ks-bg-surface);
}
.conv-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.conv-item__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.conv-item__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-item__time {
  font-size: 11px;
  color: var(--ks-text-tertiary);
  flex-shrink: 0;
}
.conv-item__preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ks-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conv-item__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ks-primary);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.conv-item__swipe {
  height: 100%;
  border: none;
  padding: 0 18px;
  background: var(--ks-accent);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.conv-item__swipe--warn {
  background: var(--ks-warning);
}
</style>