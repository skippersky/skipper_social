<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import NotificationDropdown from './NotificationDropdown.vue';
import { getNotifications } from '../../api/notification';
import { useNotification } from '../../composables/useNotification';
import { useI18nStore } from '../../i18n';
import { useNotificationStore } from '../../stores/notification';
import type { AppNotification } from '../../types';

/** Rows shown before the user has to open the full notification centre. */
const DROPDOWN_LIMIT = 5;

const i18n = useI18nStore();
const router = useRouter();
const store = useNotificationStore();
const { handleNotificationClick } = useNotification();

const open = ref(false);
const loading = ref(false);
const recent = ref<AppNotification[]>([]);
const root = ref<HTMLElement | null>(null);

const unreadCount = computed(() => store.unreadCount);
const badgeText = computed(() => {
  if (store.unreadCount <= 0) return '';
  return store.unreadCount > 99 ? '99+' : String(store.unreadCount);
});

/* The dropdown keeps its own page so the centre's filters are never clobbered. */
async function refresh(): Promise<void> {
  loading.value = true;
  try {
    const page = await getNotifications({ limit: DROPDOWN_LIMIT });
    recent.value = page.notifications.slice(0, DROPDOWN_LIMIT);
  } catch {
    recent.value = [];
  } finally {
    loading.value = false;
  }
  await store.fetchUnreadCount();
}

function close(): void {
  open.value = false;
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) void refresh();
}

function onDocumentPointerDown(event: MouseEvent): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (target && root.value && !root.value.contains(target)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown);
  document.addEventListener('keydown', onKeydown);
  void refresh();
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown);
  document.removeEventListener('keydown', onKeydown);
});

async function onSelect(notification: AppNotification): Promise<void> {
  close();
  await handleNotificationClick(notification);
  recent.value = recent.value.map((item) =>
    item.id === notification.id ? { ...item, read: true } : item
  );
}

function onViewAll(): void {
  close();
  void router.push('/dashboard/notifications');
}

function onPreferences(): void {
  close();
  void router.push('/dashboard/notifications/preferences');
}

async function onMarkAll(): Promise<void> {
  if (await store.markAllAsRead()) {
    recent.value = recent.value.map((item) => ({ ...item, read: true }));
    showToast(i18n.t('notifications.markedAllToast'));
  } else if (store.error) {
    showToast(i18n.t(store.error));
  }
}
</script>

<template>
  <div ref="root" class="ntf-bell">
    <button
      class="ntf-bell__trigger"
      type="button"
      :aria-label="i18n.t('notifications.bell')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="ntf-bell__icon" aria-hidden="true"></span>
      <span v-if="badgeText" class="ntf-bell__badge">{{ badgeText }}</span>
    </button>
    <NotificationDropdown
      v-if="open"
      class="ntf-bell__panel"
      :notifications="recent"
      :unread-count="unreadCount"
      :loading="loading"
      @select="onSelect"
      @view-all="onViewAll"
      @preferences="onPreferences"
      @mark-all="onMarkAll"
    />
  </div>
</template>

<style scoped>
.ntf-bell {
  position: relative;
}
.ntf-bell__trigger {
  position: relative;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--ks-border-default);
  border-radius: 50%;
  background: var(--ks-bg-surface);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    background var(--ks-motion-fast) var(--ks-ease);
}
.ntf-bell__trigger:hover {
  border-color: var(--ks-primary);
  background: var(--ks-grad-soft);
}
.ntf-bell__icon {
  width: 16px;
  height: 16px;
  background: var(--ks-text-secondary);
  clip-path: polygon(50% 0, 60% 5%, 64% 16%, 78% 36%, 84% 68%, 96% 78%, 96% 86%, 4% 86%, 4% 78%, 16% 68%, 22% 36%, 36% 16%, 40% 5%);
}
.ntf-bell__trigger:hover .ntf-bell__icon {
  background: var(--ks-primary-text);
}
.ntf-bell__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--ks-primary-text);
  color: var(--ks-bg-surface);
  font-size: 10px;
  line-height: 17px;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.ntf-bell__panel {
  position: absolute;
  right: 0;
  top: 42px;
  z-index: 130;
}
@media (max-width: 767px) {
  .ntf-bell__panel {
    position: fixed;
    left: 12px;
    right: 12px;
    top: 58px;
    width: auto;
  }
}
</style>
