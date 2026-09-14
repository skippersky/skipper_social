<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useNotification } from '../../composables/useNotification';
import { useI18nStore } from '../../i18n';
import { playNotificationCue, showBrowserNotification } from '../../lib/notificationAlerts';
import { relativeTime } from '../../lib/relativeTime';
import { TOAST_TTL_MS, useNotificationStore } from '../../stores/notification';
import type { AppNotification } from '../../types';

const i18n = useI18nStore();
const store = useNotificationStore();
const { handleNotificationClick } = useNotification();

const ttl = TOAST_TTL_MS + 'ms';
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
}

function clearTimers(): void {
  for (const id of [...timers.keys()]) clearTimer(id);
}

/** A fresh row gets the TTL countdown plus the configured delivery effects. */
function schedule(notification: AppNotification): void {
  timers.set(
    notification.id,
    setTimeout(() => store.dismissToast(notification.id), TOAST_TTL_MS)
  );
  if (store.preferences.browserPush) showBrowserNotification(notification.title, notification.body);
  if (store.preferences.sound) playNotificationCue();
}

/* Keyed on the toast ids so a re-ordered queue never restarts a countdown. */
watch(
  () => store.toasts.map((item) => item.id).join('|'),
  () => {
    const live = new Set(store.toasts.map((item) => item.id));
    for (const id of [...timers.keys()]) {
      if (!live.has(id)) clearTimer(id);
    }
    for (const item of store.toasts) {
      if (!timers.has(item.id)) schedule(item);
    }
  },
  { immediate: true }
);

onBeforeUnmount(clearTimers);

async function onClick(notification: AppNotification): Promise<void> {
  clearTimer(notification.id);
  store.dismissToast(notification.id);
  await handleNotificationClick(notification);
}

function onDismiss(notification: AppNotification): void {
  clearTimer(notification.id);
  store.dismissToast(notification.id);
}

function timeOf(notification: AppNotification): string {
  return relativeTime(notification.createdAt, Date.now(), i18n.locale);
}
</script>

<template>
  <div class="ntf-toasts" role="status" aria-live="polite">
    <article
      v-for="toast in store.toasts"
      :key="toast.id"
      class="ntf-toast"
      :data-type="toast.type"
      :data-id="toast.id"
      :style="{ '--ntf-ttl': ttl }"
    >
      <button class="ntf-toast__body" type="button" @click="onClick(toast)">
        <span class="ntf-toast__icon" aria-hidden="true"></span>
        <span class="ntf-toast__copy">
          <span class="ntf-toast__title">{{ toast.title }}</span>
          <span class="ntf-toast__text">{{ toast.body }}</span>
          <span class="ntf-toast__meta">
            <span class="ntf-toast__type">{{ i18n.t('notifications.type.' + toast.type) }}</span>
            <span class="ntf-toast__time">{{ timeOf(toast) }}</span>
          </span>
        </span>
      </button>
      <button
        class="ntf-toast__close"
        type="button"
        :aria-label="i18n.t('notifications.closeToast')"
        @click="onDismiss(toast)"
      >&times;</button>
      <span class="ntf-toast__timer" aria-hidden="true"></span>
    </article>
  </div>
</template>

<style scoped>
.ntf-toasts {
  position: fixed;
  top: 68px;
  right: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 340px;
  max-width: calc(100vw - 24px);
  pointer-events: none;
}
.ntf-toast {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 4px;
  overflow: hidden;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  pointer-events: auto;
  animation: ntf-toast-in var(--ks-motion-normal) var(--ks-ease);
}
.ntf-toast__body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 4px 14px 14px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.ntf-toast__icon {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--ks-grad-soft);
}
.ntf-toast__icon::after {
  content: '';
  position: absolute;
  inset: 8px;
}
.ntf-toast[data-type='message'] .ntf-toast__icon::after {
  background: var(--ks-primary);
  border-radius: 5px 5px 1px 5px;
}
.ntf-toast[data-type='conversation'] .ntf-toast__icon::after {
  background: var(--ks-accent);
  clip-path: polygon(0 32%, 58% 32%, 58% 8%, 100% 50%, 58% 92%, 58% 68%, 0 68%);
}
.ntf-toast[data-type='customer'] .ntf-toast__icon::after {
  inset: 7px 9px 8px 9px;
  background: var(--ks-success);
  border-radius: 50% 50% 3px 3px;
}
.ntf-toast[data-type='system'] .ntf-toast__icon::after {
  background: var(--ks-warning);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.ntf-toast__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ntf-toast__title {
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ntf-toast__text {
  font-size: 12px;
  line-height: 17px;
  color: var(--ks-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ntf-toast__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.ntf-toast__type {
  font-size: 10px;
  line-height: 15px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.ntf-toast__time {
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
}
.ntf-toast__close {
  width: 30px;
  flex-shrink: 0;
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 17px;
  line-height: 1;
  padding: 10px 0 0;
  cursor: pointer;
}
.ntf-toast__close:hover {
  color: var(--ks-text-primary);
}
.ntf-toast__timer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--ks-grad-brand);
  transform-origin: left center;
  animation: ntf-toast-countdown var(--ntf-ttl, 5000ms) linear forwards;
}
@keyframes ntf-toast-in {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes ntf-toast-countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
@media (max-width: 767px) {
  .ntf-toasts {
    top: 62px;
    left: 12px;
    right: 12px;
    width: auto;
  }
}
</style>
