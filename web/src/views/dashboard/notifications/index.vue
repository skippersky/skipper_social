<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import NotificationItem from '../../../components/notification/NotificationItem.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useNotification } from '../../../composables/useNotification';
import { useNotificationList } from '../../../composables/useNotificationList';
import { useI18nStore } from '../../../i18n';
import {
  NOTIFICATION_ROW_HEIGHT,
  VIRTUAL_THRESHOLD,
  computeVirtualWindow
} from '../../../lib/notificationWindow';
import { useNotificationStore } from '../../../stores/notification';
import { NOTIFICATION_TYPES } from '../../../types';
import type {
  AppNotification,
  NotificationReadFilter,
  NotificationTypeFilter
} from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const store = useNotificationStore();

usePageMeta(i18n.t('notifications.metaTitle'), i18n.t('notifications.metaDescription'));

const {
  notifications,
  loading,
  hasMore,
  total,
  unreadCount,
  filters,
  error,
  hasDemoData,
  filterByType,
  filterByReadStatus,
  loadMore,
  markAllAsRead,
  deleteReadNotifications,
  refresh
} = useNotificationList();
const { markAsRead, deleteNotification, handleNotificationClick } = useNotification();

const TYPE_CHIPS: NotificationTypeFilter[] = ['all', ...NOTIFICATION_TYPES];
const STATUS_CHIPS: NotificationReadFilter[] = ['all', 'read', 'unread'];

/* Sample-data disclosure, mirroring the customer directory. */
const DEMO_HIDDEN_KEY = 'ks-notifications-demo-hidden';
const demoHidden = ref(false);
const showDemoBar = computed(() => hasDemoData.value && !demoHidden.value);
const visible = computed(() =>
  hasDemoData.value && demoHidden.value ? [] : notifications.value
);

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

/* Fixed-height windowing. Named "view" because "window" shadows the global. */
const listEl = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(600);
const view = computed(() =>
  computeVirtualWindow(visible.value.length, scrollTop.value, {
    itemHeight: NOTIFICATION_ROW_HEIGHT,
    viewportHeight: viewportHeight.value
  })
);
const visibleRows = computed(() => visible.value.slice(view.value.start, view.value.end));
const isVirtual = computed(() => visible.value.length > VIRTUAL_THRESHOLD);

let resizeObserver: ResizeObserver | null = null;

function measure(): void {
  const height = listEl.value?.clientHeight ?? 0;
  if (height > 0) viewportHeight.value = height;
}

/** Scroll drives both the window offset and the near-bottom page fetch. */
function onScroll(event: Event): void {
  const el = event.target as HTMLElement;
  scrollTop.value = el.scrollTop;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) void loadMore();
}

const isEmpty = computed(() => !loading.value && visible.value.length === 0);
const filtersActive = computed(
  () => filters.value.type !== 'all' || filters.value.status !== 'all'
);
const connectionLabel = computed(() =>
  i18n.t('notifications.connection.' + store.connectionStatus)
);
const unreadLabel = computed(() =>
  unreadCount.value > 0
    ? i18n.t('notifications.unreadCount', { n: unreadCount.value })
    : i18n.t('notifications.allRead')
);

async function onRowSelect(notification: AppNotification): Promise<void> {
  await handleNotificationClick(notification);
}

async function onRowRead(id: string): Promise<void> {
  const ok = await markAsRead(id);
  if (!ok && store.error) showToast(i18n.t(store.error));
}

async function onRowDelete(id: string): Promise<void> {
  if (await deleteNotification(id)) showToast(i18n.t('notifications.deletedToast'));
  else if (store.error) showToast(i18n.t(store.error));
}

async function onMarkAll(): Promise<void> {
  if (await markAllAsRead()) showToast(i18n.t('notifications.markedAllToast'));
  else if (store.error) showToast(i18n.t(store.error));
}

async function onClearRead(): Promise<void> {
  if (await deleteReadNotifications()) showToast(i18n.t('notifications.deletedReadToast'));
  else if (store.error) showToast(i18n.t(store.error));
}

async function onRetry(): Promise<void> {
  await refresh();
}

onMounted(() => {
  try {
    demoHidden.value = localStorage.getItem(DEMO_HIDDEN_KEY) === '1';
  } catch {
    /* private mode */
  }
  measure();
  if (typeof ResizeObserver !== 'undefined' && listEl.value) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(listEl.value);
  }
  void refresh();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <section class="notifications">
    <header class="notifications__top">
      <button
        class="notifications__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <h1 class="notifications__title">{{ i18n.t('notifications.title') }}</h1>
      <span class="notifications__count">{{ total }}</span>
      <span
        class="notifications__live"
        :data-status="store.connectionStatus"
      >{{ connectionLabel }}</span>
    </header>

    <p class="notifications__subtitle">
      {{ i18n.t('notifications.subtitle') }}
      <strong :class="{ 'is-zero': unreadCount <= 0 }">{{ unreadLabel }}</strong>
    </p>

    <div class="notifications__toolbar">
      <div class="notifications__chips" role="group">
        <button
          v-for="chip in TYPE_CHIPS"
          :key="'type-' + chip"
          class="notifications__chip"
          :class="{ 'is-active': filters.type === chip }"
          type="button"
          @click="filterByType(chip)"
        >{{ chip === 'all' ? i18n.t('notifications.filterAll') : i18n.t('notifications.type.' + chip) }}</button>
      </div>
      <div class="notifications__chips" role="group">
        <button
          v-for="chip in STATUS_CHIPS"
          :key="'status-' + chip"
          class="notifications__chip"
          :class="{ 'is-active': filters.status === chip }"
          type="button"
          @click="filterByReadStatus(chip)"
        >{{ i18n.t(chip === 'all' ? 'notifications.statusAll' : chip === 'read' ? 'notifications.statusRead' : 'notifications.statusUnread') }}</button>
      </div>
      <div class="notifications__actions">
        <button class="notifications__btn" type="button" @click="onMarkAll">
          {{ i18n.t('notifications.markAllRead') }}
        </button>
        <button class="notifications__btn" type="button" @click="onClearRead">
          {{ i18n.t('notifications.deleteRead') }}
        </button>
        <router-link class="notifications__btn notifications__btn--primary" to="/dashboard/notifications/preferences">
          {{ i18n.t('notifications.openPreferences') }}
        </router-link>
      </div>
    </div>

    <div v-if="showDemoBar" class="notifications__demo" role="note">
      <span>{{ i18n.t('notifications.demoNotice') }}</span>
      <button
        type="button"
        :aria-label="i18n.t('notifications.demoHide')"
        @click="hideDemo"
      >&times;</button>
    </div>

    <div ref="listEl" class="notifications__scroll" @scroll.passive="onScroll">
      <div v-if="loading && !visible.length" class="notifications__skeleton">
        <div
          v-for="row in 6"
          :key="'sk-' + row"
          class="notifications__skeleton-row"
        ></div>
      </div>

      <div v-else-if="error && !visible.length" class="notifications__error">
        <p>{{ i18n.t(error) }}</p>
        <button class="notifications__btn" type="button" @click="onRetry">
          {{ i18n.t('common.retry') }}
        </button>
      </div>

      <div v-else-if="isEmpty" class="notifications__empty">
        <van-empty
          :description="i18n.t(filtersActive ? 'notifications.filteredEmpty' : 'notifications.empty')"
        >
          <template v-if="!filtersActive">
            <p class="notifications__empty-hint">{{ i18n.t('notifications.emptyHint') }}</p>
            <button
              class="notifications__empty-cta"
              type="button"
              @click="router.push('/dashboard/channels')"
            >{{ i18n.t('notifications.emptyChannels') }}</button>
          </template>
        </van-empty>
      </div>

      <template v-else>
        <div :style="{ height: view.offsetTop + 'px' }" aria-hidden="true"></div>
        <NotificationItem
          v-for="row in visibleRows"
          :key="row.id"
          :notification="row"
          @select="onRowSelect"
          @read="onRowRead"
          @delete="onRowDelete"
        />
        <div :style="{ height: view.offsetBottom + 'px' }" aria-hidden="true"></div>
        <p v-if="isVirtual" class="notifications__virtual">{{ total }}</p>
        <button
          v-if="hasMore"
          class="notifications__more"
          type="button"
          :disabled="loading"
          @click="loadMore"
        >{{ i18n.t('notifications.loadMore') }}</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.notifications {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 24px 40px;
  box-sizing: border-box;
  background: var(--ks-bg-base);
}
.notifications__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.notifications__home {
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.notifications__home:hover {
  background: var(--ks-bg-muted);
}
.notifications__title {
  margin: 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.notifications__count {
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 2px 10px;
}
.notifications__live {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  color: var(--ks-text-tertiary);
}
.notifications__live[data-status='connected'] {
  color: var(--ks-success);
  border-color: var(--ks-success);
  background: rgba(21, 128, 61, 0.1);
}
.notifications__live[data-status='connecting'] {
  color: var(--ks-accent);
  border-color: var(--ks-accent);
  background: rgba(91, 91, 214, 0.1);
}
.notifications__live[data-status='error'] {
  color: var(--ks-error);
  border-color: var(--ks-error);
  background: rgba(220, 38, 38, 0.1);
}
.notifications__subtitle {
  margin: 6px 0 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.notifications__subtitle strong {
  color: var(--ks-primary-text);
  font-weight: 700;
}
.notifications__subtitle strong.is-zero {
  color: var(--ks-text-tertiary);
  font-weight: 600;
}
.notifications__toolbar {
  display: flex;
  align-items: center;
  gap: 10px 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.notifications__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.notifications__chip {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.notifications__chip:hover {
  background: var(--ks-bg-muted);
}
.notifications__chip.is-active {
  background: var(--ks-grad-brand);
  border-color: transparent;
  color: var(--ks-ink-on-grad);
}
.notifications__actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
.notifications__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.notifications__btn:hover {
  background: var(--ks-bg-muted);
}
.notifications__btn--primary {
  background: var(--ks-grad-brand);
  border-color: transparent;
  color: var(--ks-ink-on-grad);
}
.notifications__btn--primary:hover {
  filter: brightness(1.05);
}
.notifications__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid rgba(180, 83, 9, 0.2);
  border-radius: var(--ks-radius-card);
}
.notifications__demo button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ks-warning);
  font-size: 14px;
  cursor: pointer;
}
.notifications__demo button:hover {
  background: rgba(180, 83, 9, 0.15);
}
.notifications__scroll {
  flex: 1;
  min-height: 240px;
  max-height: calc(100dvh - 250px);
  overflow-y: auto;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.notifications__skeleton {
  padding: 8px 0;
}
.notifications__skeleton-row {
  height: 76px;
  margin: 0 14px 8px;
  border-radius: var(--ks-radius-btn);
  background: linear-gradient(
    90deg,
    var(--ks-bg-muted) 0%,
    var(--ks-bg-surface) 50%,
    var(--ks-bg-muted) 100%
  );
  background-size: 200% 100%;
  animation: notifications-shimmer 1.4s var(--ks-ease) infinite;
}
@keyframes notifications-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
.notifications__error {
  padding: 40px 20px;
  text-align: center;
  color: var(--ks-text-secondary);
  font-size: 14px;
}
.notifications__error p {
  margin: 0 0 14px;
}
.notifications__empty {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.notifications__empty-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.notifications__empty-cta {
  height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
.notifications__empty-cta:hover {
  filter: brightness(1.05);
}
.notifications__virtual {
  margin: 0;
  padding: 8px 16px 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
  text-align: center;
}
.notifications__more {
  display: block;
  margin: 10px auto 14px;
  height: 32px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.notifications__more:disabled {
  opacity: 0.5;
}
@media (max-width: 767px) {
  .notifications {
    padding: 14px 14px 32px;
  }
  .notifications__actions {
    width: 100%;
    margin-left: 0;
  }
  .notifications__actions .notifications__btn {
    flex: 1;
    justify-content: center;
  }
  .notifications__scroll {
    max-height: calc(100dvh - 230px);
  }
}
</style>
