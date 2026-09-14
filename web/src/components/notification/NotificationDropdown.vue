<script setup lang="ts">
import { useI18nStore } from '../../i18n';
import NotificationItem from './NotificationItem.vue';
import type { AppNotification } from '../../types';

withDefaults(
  defineProps<{
    notifications: AppNotification[];
    unreadCount: number;
    loading?: boolean;
  }>(),
  { loading: false }
);

const emit = defineEmits<{
  (e: 'select', notification: AppNotification): void;
  (e: 'viewAll'): void;
  (e: 'preferences'): void;
  (e: 'markAll'): void;
}>();

const i18n = useI18nStore();
</script>

<template>
  <div class="ntf-drop" role="dialog" :aria-label="i18n.t('notifications.recent')">
    <header class="ntf-drop__head">
      <p class="ntf-drop__title">{{ i18n.t('notifications.recent') }}</p>
      <span v-if="unreadCount > 0" class="ntf-drop__badge">
        {{ i18n.t('notifications.unreadCount', { n: unreadCount }) }}
      </span>
      <span v-else class="ntf-drop__badge ntf-drop__badge--clear">
        {{ i18n.t('notifications.allRead') }}
      </span>
      <button
        class="ntf-drop__mark"
        type="button"
        :disabled="unreadCount === 0"
        @click="emit('markAll')"
      >{{ i18n.t('notifications.markAllRead') }}</button>
    </header>

    <div class="ntf-drop__list">
      <p v-if="loading" class="ntf-drop__hint">&hellip;</p>
      <p v-else-if="!notifications.length" class="ntf-drop__hint">
        {{ i18n.t('notifications.noRecent') }}
      </p>
      <template v-else>
        <NotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          compact
          :notification="notification"
          @select="emit('select', notification)"
        />
      </template>
    </div>

    <footer class="ntf-drop__foot">
      <button class="ntf-drop__all" type="button" @click="emit('viewAll')">
        {{ i18n.t('notifications.viewAll') }}
        <span aria-hidden="true">&rarr;</span>
      </button>
      <button class="ntf-drop__prefs" type="button" @click="emit('preferences')">
        {{ i18n.t('notifications.openPreferences') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.ntf-drop {
  width: 360px;
  max-width: calc(100vw - 24px);
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ntf-drop__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ks-border-default);
  background: var(--ks-grad-soft);
}
.ntf-drop__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ntf-drop__badge {
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ks-primary-text);
  color: var(--ks-bg-surface);
  font-variant-numeric: tabular-nums;
}
.ntf-drop__badge--clear {
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
}
.ntf-drop__mark {
  margin-left: auto;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.ntf-drop__mark:hover:not(:disabled) {
  border-color: var(--ks-primary);
  color: var(--ks-primary-text);
}
.ntf-drop__mark:disabled {
  opacity: 0.45;
  cursor: default;
}
.ntf-drop__list {
  max-height: 400px;
  overflow-y: auto;
}
.ntf-drop__hint {
  margin: 0;
  padding: 26px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.ntf-drop__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--ks-border-default);
  background: var(--ks-bg-base);
}
.ntf-drop__all {
  flex: 1;
  height: 32px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.ntf-drop__all:hover {
  filter: brightness(1.05);
}
.ntf-drop__prefs {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ntf-drop__prefs:hover {
  border-color: var(--ks-primary);
  color: var(--ks-primary-text);
}
</style>
