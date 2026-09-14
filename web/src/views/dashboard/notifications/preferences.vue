<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { demoPushNotification } from '../../../api/demo';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { requestBrowserPushPermission } from '../../../lib/notificationAlerts';
import { useNotificationStore } from '../../../stores/notification';
import { NOTIFICATION_TYPES } from '../../../types';
import type { NotificationPreferences, NotificationType } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const store = useNotificationStore();

usePageMeta(
  i18n.t('notifications.prefsMetaTitle'),
  i18n.t('notifications.prefsMetaDescription')
);

const draft = ref<NotificationPreferences>({ ...store.preferences });
const saving = ref(false);

const TYPE_HINTS: Record<NotificationType, string> = {
  message: 'notifications.prefsTypeMessageHint',
  conversation: 'notifications.prefsTypeConversationHint',
  customer: 'notifications.prefsTypeCustomerHint',
  system: 'notifications.prefsTypeSystemHint'
};

const connectionLabel = computed(() =>
  i18n.t('notifications.connection.' + store.connectionStatus)
);

async function load(): Promise<void> {
  await store.fetchPreferences();
  draft.value = { ...store.preferences };
}

/**
 * Enabling browser push needs a user-gesture permission prompt. A refusal
 * reverts the switch so the UI never claims a delivery the browser blocks.
 */
async function onBrowserPushToggle(value: boolean): Promise<void> {
  draft.value.browserPush = value;
  if (!value) return;
  const result = await requestBrowserPushPermission();
  if (result === 'granted') {
    showToast(i18n.t('notifications.prefsPushGranted'));
    return;
  }
  draft.value.browserPush = false;
  showToast(
    i18n.t(
      result === 'unsupported'
        ? 'notifications.prefsPushUnsupported'
        : 'notifications.prefsPushDenied'
    )
  );
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    if (await store.updatePreferences(draft.value)) {
      showToast(i18n.t('notifications.prefsSavedToast'));
    } else if (store.error) {
      showToast(i18n.t(store.error));
    }
    draft.value = { ...store.preferences };
  } finally {
    saving.value = false;
  }
}

/** Offline preview of the realtime toast; never touches a live socket. */
function onTest(): void {
  const pushed = demoPushNotification({
    type: 'system',
    title: i18n.t('notifications.prefsTest'),
    body: i18n.t('notifications.subtitle'),
    link: '/dashboard/notifications'
  });
  store.addRealtimeNotification(pushed);
  showToast(i18n.t('notifications.prefsTestToast'));
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="prefs">
    <header class="prefs__top">
      <button
        class="prefs__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/dashboard/notifications')"
      >&larr;</button>
      <h1 class="prefs__title">{{ i18n.t('notifications.prefsTitle') }}</h1>
      <span class="prefs__live" :data-status="store.connectionStatus">
        {{ i18n.t('notifications.prefsConnection') }}: {{ connectionLabel }}
      </span>
    </header>

    <p class="prefs__subtitle">{{ i18n.t('notifications.prefsSubtitle') }}</p>

    <div class="prefs__grid">
      <section class="prefs__card">
        <h2 class="prefs__card-title">{{ i18n.t('notifications.prefsTypes') }}</h2>
        <div
          v-for="type in NOTIFICATION_TYPES"
          :key="'pref-' + type"
          class="prefs__row"
        >
          <div class="prefs__row-copy">
            <p class="prefs__row-label">{{ i18n.t('notifications.type.' + type) }}</p>
            <p class="prefs__row-hint">{{ i18n.t(TYPE_HINTS[type]) }}</p>
          </div>
          <van-switch v-model="draft[type]" size="22" />
        </div>
      </section>

      <section class="prefs__card">
        <h2 class="prefs__card-title">{{ i18n.t('notifications.prefsDelivery') }}</h2>
        <div class="prefs__row">
          <div class="prefs__row-copy">
            <p class="prefs__row-label">{{ i18n.t('notifications.prefsBrowserPush') }}</p>
            <p class="prefs__row-hint">{{ i18n.t('notifications.prefsBrowserPushHint') }}</p>
          </div>
          <van-switch
            :model-value="draft.browserPush"
            size="22"
            @update:model-value="onBrowserPushToggle"
          />
        </div>
        <div class="prefs__row">
          <div class="prefs__row-copy">
            <p class="prefs__row-label">{{ i18n.t('notifications.prefsSound') }}</p>
            <p class="prefs__row-hint">{{ i18n.t('notifications.prefsSoundHint') }}</p>
          </div>
          <van-switch v-model="draft.sound" size="22" />
        </div>
        <div class="prefs__row prefs__row--actions">
          <button class="prefs__btn" type="button" @click="onTest">
            {{ i18n.t('notifications.prefsTest') }}
          </button>
        </div>
      </section>
    </div>

    <div class="prefs__footer">
      <button
        class="prefs__btn prefs__btn--primary"
        type="button"
        :disabled="saving"
        @click="onSave"
      >{{ i18n.t('notifications.prefsSave') }}</button>
    </div>
  </section>
</template>

<style scoped>
.prefs {
  flex: 1;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 24px 40px;
  box-sizing: border-box;
  background: var(--ks-bg-base);
}
.prefs__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.prefs__home {
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.prefs__home:hover {
  background: var(--ks-bg-muted);
}
.prefs__title {
  margin: 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.prefs__live {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  color: var(--ks-text-tertiary);
}
.prefs__live[data-status='connected'] {
  color: var(--ks-success);
  border-color: var(--ks-success);
  background: rgba(21, 128, 61, 0.1);
}
.prefs__live[data-status='error'] {
  color: var(--ks-error);
  border-color: var(--ks-error);
  background: rgba(220, 38, 38, 0.1);
}
.prefs__subtitle {
  margin: 6px 0 18px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.prefs__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.prefs__card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px 18px;
}
.prefs__card-title {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.prefs__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--ks-border-default);
}
.prefs__row:first-of-type {
  border-top: none;
}
.prefs__row-copy {
  flex: 1;
  min-width: 0;
}
.prefs__row-label {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.prefs__row-hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.prefs__row--actions {
  justify-content: flex-start;
}
.prefs__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}
.prefs__btn {
  height: 38px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.prefs__btn:hover {
  background: var(--ks-bg-muted);
}
.prefs__btn--primary {
  background: var(--ks-grad-brand);
  border-color: transparent;
  color: var(--ks-ink-on-grad);
}
.prefs__btn--primary:hover {
  filter: brightness(1.05);
}
.prefs__btn--primary:disabled {
  opacity: 0.6;
}
@media (max-width: 1023px) {
  .prefs__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .prefs {
    padding: 14px 14px 32px;
  }
  .prefs__footer .prefs__btn {
    width: 100%;
  }
}
</style>
