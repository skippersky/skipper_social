<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';
import { useChannelStore } from '../../stores/channel';
import { CHANNEL_PLATFORMS, type ChannelPlatform } from '../../types';

const route = useRoute();
const router = useRouter();
const i18n = useI18nStore();
const store = useChannelStore();

usePageMeta(i18n.t('channels.metaTitle'), i18n.t('channels.metaDescription'));

const failed = ref(false);

const platform = computed(() => {
  const value = route.params.platform;
  const candidate = Array.isArray(value) ? value[0] : value;
  return CHANNEL_PLATFORMS.includes(candidate as ChannelPlatform)
    ? (candidate as ChannelPlatform)
    : null;
});

const platformName = computed(() =>
  platform.value ? i18n.t(`channels.platform.${platform.value}`) : ''
);

async function complete(): Promise<void> {
  failed.value = false;
  if (!platform.value) {
    await router.replace('/dashboard/channels');
    return;
  }
  const code = typeof route.query.code === 'string' ? route.query.code : '';
  const state = typeof route.query.state === 'string' ? route.query.state : '';
  const oauthError = typeof route.query.error === 'string' ? route.query.error : '';
  if (oauthError || !code) {
    failed.value = true;
    showToast(i18n.t('channels.connectFailed'));
    return;
  }
  const channel = await store.completeConnect(platform.value, { code, state });
  if (channel) {
    showToast(i18n.t('channels.connectedToast', { platform: platformName.value }));
    await router.replace('/dashboard/channels');
  } else {
    failed.value = true;
    showToast(i18n.t('channels.connectFailed'));
  }
}

onMounted(() => {
  // Navigation rejections (e.g. unmount mid-redirect) must not surface as unhandled errors.
  complete().catch(() => {
    failed.value = true;
  });
});
</script>

<template>
  <section class="callback-page">
    <div class="callback-page__card">
      <template v-if="!failed">
        <span class="callback-page__spinner" aria-hidden="true"></span>
        <h1 class="callback-page__title">{{ i18n.t('channels.callbackTitle') }}</h1>
        <p class="callback-page__body">
          {{ i18n.t('channels.callbackBody', { platform: platformName }) }}
        </p>
      </template>
      <template v-else>
        <h1 class="callback-page__title">{{ i18n.t('channels.connectErrorTitle') }}</h1>
        <p class="callback-page__body">{{ i18n.t('channels.connectFailed') }}</p>
        <div class="callback-page__actions">
          <button type="button" class="btn-primary" @click="complete">{{ i18n.t('channels.retry') }}</button>
          <button type="button" class="btn-ghost" @click="router.push('/dashboard/channels')">
            {{ i18n.t('channels.backToList') }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
<style scoped>
.callback-page {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
}
.callback-page__card {
  max-width: 440px;
  width: 100%;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 36px 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.callback-page__spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid var(--ks-bg-muted);
  border-top-color: var(--ks-primary);
  animation: callback-spin 0.9s linear infinite;
}
@keyframes callback-spin {
  to {
    transform: rotate(360deg);
  }
}
.callback-page__title {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}
.callback-page__body {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 21px;
}
.callback-page__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-primary,
.btn-ghost {
  height: 42px;
  padding: 0 20px;
  border-radius: var(--ks-radius-btn);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.btn-ghost {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-strong);
  color: var(--ks-text-primary);
}
</style>