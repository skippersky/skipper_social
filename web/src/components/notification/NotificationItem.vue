<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { AppNotification } from '../../types';

const props = withDefaults(
  defineProps<{
    notification: AppNotification;
    /** Dropdown variant: one-line body and no per-row actions. */
    compact?: boolean;
    busy?: boolean;
  }>(),
  { compact: false, busy: false }
);

const emit = defineEmits<{
  (e: 'select', notification: AppNotification): void;
  (e: 'read', id: string): void;
  (e: 'delete', id: string): void;
}>();

const i18n = useI18nStore();

/* Row height is fixed at NOTIFICATION_ROW_HEIGHT so the windowing maths holds. */
const time = computed(() => relativeTime(props.notification.createdAt, Date.now(), i18n.locale));
const typeLabel = computed(() => i18n.t('notifications.type.' + props.notification.type));
</script>

<template>
  <article
    class="ntf-item"
    :class="{ 'ntf-item--unread': !notification.read, 'ntf-item--compact': compact }"
    :data-type="notification.type"
    :data-read="notification.read ? 'true' : 'false'"
    :data-id="notification.id"
  >
    <button class="ntf-item__main" type="button" @click="emit('select', notification)">
      <span class="ntf-item__icon" role="img" :aria-label="typeLabel"></span>
      <span class="ntf-item__body">
        <span class="ntf-item__head">
          <span class="ntf-item__title">{{ notification.title }}</span>
          <span class="ntf-item__time">{{ time }}</span>
        </span>
        <span class="ntf-item__text">{{ notification.body }}</span>
      </span>
      <span
        v-if="!notification.read"
        class="ntf-item__dot"
        :aria-label="i18n.t('notifications.statusUnread')"
      ></span>
    </button>
    <div v-if="!compact" class="ntf-item__actions">
      <button
        v-if="!notification.read"
        class="ntf-item__action"
        type="button"
        :disabled="busy"
        :aria-label="i18n.t('notifications.markRead')"
        @click="emit('read', notification.id)"
      >
        <span class="ntf-item__glyph" aria-hidden="true">&#10003;</span>
        <span class="ntf-item__label">{{ i18n.t('notifications.markRead') }}</span>
      </button>
      <button
        class="ntf-item__action ntf-item__action--warn"
        type="button"
        :disabled="busy"
        :aria-label="i18n.t('notifications.delete')"
        @click="emit('delete', notification.id)"
      >
        <span class="ntf-item__glyph" aria-hidden="true">&times;</span>
        <span class="ntf-item__label">{{ i18n.t('notifications.delete') }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.ntf-item {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 10px;
  height: 76px;
  box-sizing: border-box;
  padding: 0 12px 0 16px;
  background: var(--ks-bg-surface);
  border-bottom: 1px solid var(--ks-border-default);
}
.ntf-item--unread::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--ks-grad-brand);
}
.ntf-item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.ntf-item__main:hover .ntf-item__title {
  color: var(--ks-primary-text);
}
.ntf-item__icon {
  position: relative;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--ks-grad-soft);
}
.ntf-item__icon::after {
  content: '';
  position: absolute;
  inset: 9px;
}
.ntf-item[data-type='message'] .ntf-item__icon::after {
  background: var(--ks-primary);
  border-radius: 6px 6px 1px 6px;
}
.ntf-item[data-type='conversation'] .ntf-item__icon::after {
  background: var(--ks-accent);
  clip-path: polygon(0 32%, 58% 32%, 58% 8%, 100% 50%, 58% 92%, 58% 68%, 0 68%);
}
.ntf-item[data-type='customer'] .ntf-item__icon::after {
  inset: 8px 10px 9px 10px;
  background: var(--ks-success);
  border-radius: 50% 50% 3px 3px;
}
.ntf-item[data-type='system'] .ntf-item__icon::after {
  background: var(--ks-warning);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.ntf-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ntf-item__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ntf-item__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--ks-motion-fast) var(--ks-ease);
}
.ntf-item--unread .ntf-item__title {
  font-weight: 700;
}
.ntf-item__time {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.ntf-item__text {
  font-size: 12px;
  line-height: 17px;
  color: var(--ks-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ntf-item__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ks-primary);
}
.ntf-item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.ntf-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.ntf-item__action:hover {
  background: var(--ks-bg-muted);
  border-color: var(--ks-border-strong);
}
.ntf-item__action:disabled {
  opacity: 0.5;
  cursor: default;
}
.ntf-item__action--warn:hover {
  color: var(--ks-error);
  border-color: var(--ks-error);
  background: var(--ks-bg-surface);
}
.ntf-item__glyph {
  display: none;
  font-size: 14px;
  line-height: 1;
}

.ntf-item--compact {
  height: auto;
  padding: 10px 14px;
}
.ntf-item--compact .ntf-item__text {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

@media (max-width: 767px) {
  .ntf-item {
    padding: 0 8px 0 12px;
    gap: 4px;
  }
  .ntf-item__actions {
    gap: 4px;
  }
  .ntf-item__action {
    padding: 0;
  }
  .ntf-item__label {
    display: none;
  }
  .ntf-item__glyph {
    display: inline;
  }
}
</style>
