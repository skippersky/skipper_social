<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { Message } from '../../types';

const props = defineProps<{ message: Message; showTimestamp?: boolean }>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const i18n = useI18nStore();

const outgoing = computed(() => props.message.sender === 'user');

const timeLabel = computed(() =>
  new Date(props.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
);

const chipLabel = computed(() => {
  if (props.message.type === 'location') return i18n.t('inbox.location');
  if (props.message.type === 'file') return i18n.t('inbox.file');
  if (props.message.type === 'audio') return i18n.t('inbox.audio');
  return '';
});
</script>

<template>
  <div class="msg" :class="outgoing ? 'msg--out' : 'msg--in'">
    <p v-if="showTimestamp" class="msg__time">{{ timeLabel }}</p>
    <div class="msg__bubble">
      <img
        v-if="message.type === 'image' && message.mediaUrl"
        :src="message.mediaUrl"
        :alt="message.content"
        class="msg__image"
      />
      <a
        v-else-if="message.mediaUrl && chipLabel"
        class="msg__chip"
        :href="message.mediaUrl"
        target="_blank"
        rel="noopener"
      >{{ chipLabel }}</a>
      <p v-else class="msg__text">{{ message.content }}</p>
      <span v-if="outgoing" class="msg__status" :class="`msg__status--${message.status}`">
        {{ message.status === 'sending' ? '…' : message.status === 'read' ? '✓✓' : '✓' }}
      </span>
    </div>
    <button
      v-if="message.status === 'failed'"
      class="msg__retry"
      type="button"
      :title="i18n.t('inbox.sendFailed')"
      :aria-label="i18n.t('inbox.sendFailed')"
      @click="emit('retry')"
    >!</button>
  </div>
</template>

<style scoped>
.msg {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 6px;
  margin: 2px 0;
}
.msg--out {
  justify-content: flex-end;
}
.msg__time {
  width: 100%;
  margin: 10px 0 4px;
  text-align: center;
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.msg__bubble {
  max-width: 78%;
  padding: 9px 13px;
  font-size: 14px;
  line-height: 21px;
  position: relative;
}
.msg--in .msg__bubble {
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
  border-radius: 16px 16px 16px 4px;
}
.msg--out .msg__bubble {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  border-radius: 16px 16px 4px 16px;
}
.msg__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg__image {
  display: block;
  max-width: 220px;
  border-radius: 10px;
}
.msg__chip {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(23, 26, 33, 0.08);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.msg__status {
  position: absolute;
  right: 8px;
  bottom: 2px;
  font-size: 10px;
  opacity: 0.75;
}
.msg__retry {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: var(--ks-error);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}
</style>