<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import ChannelCard from '../../../components/channel/ChannelCard.vue';
import ConnectLimitWarning from '../../../components/channel/ConnectLimitWarning.vue';
import CredentialFormDialog from '../../../components/channel/CredentialFormDialog.vue';
import PlatformSelector from '../../../components/channel/PlatformSelector.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { channelBus } from '../../../events/channel';
import { useI18nStore } from '../../../i18n';
import { useChannelStore } from '../../../stores/channel';
import { useSubscriptionStore } from '../../../stores/subscription';
import { CHANNEL_PLATFORMS, type ChannelPlatform } from '../../../types';

const router = useRouter();
const route = useRoute();
const i18n = useI18nStore();
const store = useChannelStore();
const sub = useSubscriptionStore();

usePageMeta(i18n.t('channels.metaTitle'), i18n.t('channels.metaDescription'));

const selectorVisible = ref(false);

// Onboarding banner shown right after registration (query first_login=true).
const FIRST_LOGIN_KEY = 'ks-first-login-dismissed';
const firstLoginDismissed = ref(false);
try {
  firstLoginDismissed.value = localStorage.getItem(FIRST_LOGIN_KEY) === '1';
} catch {
  /* private mode */
}
const showWelcome = computed(() => route.query.first_login === 'true' && !firstLoginDismissed.value);

function dismissWelcome(): void {
  firstLoginDismissed.value = true;
  try {
    localStorage.setItem(FIRST_LOGIN_KEY, '1');
  } catch {
    /* private mode */
  }
}

// Manual credential dialog state.
const credentialShow = ref(false);
const credentialPlatform = ref<ChannelPlatform | null>(null);

const quota = computed(() => sub.currentPlan?.quotas.channels ?? 1);
const limitLabel = computed(() =>
  quota.value === -1 ? i18n.t('channels.unlimited') : String(quota.value)
);
const slotsFull = computed(() => store.availableSlots <= 0);
const hasConnections = computed(() => store.channels.length > 0);

onMounted(async () => {
  await Promise.all([sub.fetchPlans(), sub.fetchMySubscription()]);
  await store.fetchChannels();
});

// Observer: keep the list fresh when other views mutate channel state.
const offBus = channelBus.on(() => {
  void store.fetchChannels();
});
onUnmounted(() => offBus());

function onConnectExisting(platform: ChannelPlatform): void {
  credentialPlatform.value = platform;
  credentialShow.value = true;
}

function onSelectPlatform(platform: ChannelPlatform): void {
  selectorVisible.value = false;
  credentialPlatform.value = platform;
  credentialShow.value = true;
}

async function startConnection(
  platform: ChannelPlatform,
  credentials?: Record<string, string>
): Promise<void> {
  const result = await store.connect(platform, credentials);
  if (!result) {
    if (store.error) showToast(i18n.t(store.error));
    return;
  }
  if (result.channel) {
    showToast(i18n.t('channels.connectedToast', { platform: i18n.t(`channels.platform.${platform}`) }));
    return;
  }
  if (!result.authUrl) return;
  if (result.authUrl.startsWith('/')) await router.push(result.authUrl);
  else window.location.assign(result.authUrl);
}

async function onCredentialSubmit(credentials: Record<string, string>): Promise<void> {
  const platform = credentialPlatform.value;
  credentialShow.value = false;
  if (platform) await startConnection(platform, credentials);
}

async function onCredentialOAuth(): Promise<void> {
  const platform = credentialPlatform.value;
  credentialShow.value = false;
  if (platform) await startConnection(platform);
}

async function onDisconnect(channelId: string): Promise<void> {
  if (await store.disconnectChannel(channelId)) {
    showToast(i18n.t('channels.disconnectedToast'));
  } else if (store.error) {
    showToast(i18n.t(store.error));
  }
}

async function onRefreshAll(): Promise<void> {
  await store.refreshAllTokens();
  if (store.error) {
    showToast(i18n.t(store.error));
  } else {
    showToast(i18n.t('channels.refreshDone'));
  }
}
</script>
<template>
  <section class="channels-page">
    <header class="channels-page__top">
      <button
        class="page__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >←</button>
      <h1 class="channels-page__title">{{ i18n.t('channels.title') }}</h1>
    </header>

    <div v-if="showWelcome" class="channels-page__welcome" role="status">
      <p class="channels-page__welcome-text">{{ i18n.t('channels.welcome') }}</p>
      <button
        class="channels-page__welcome-close"
        type="button"
        :aria-label="i18n.t('channels.welcomeDismiss')"
        @click="dismissWelcome"
      >
        ×
      </button>
    </div>

    <section class="channels-page__overview">
      <p class="channels-page__count">
        {{ i18n.t('channels.overview', { connected: store.connectedCount, limit: limitLabel }) }}
      </p>
      <div class="channels-page__overview-actions">
        <button
          v-if="hasConnections"
          type="button"
          class="btn-ghost"
          :disabled="store.loading"
          @click="onRefreshAll"
        >{{ i18n.t('channels.refreshAll') }}</button>
        <button
          type="button"
          class="btn-primary"
          :disabled="slotsFull"
          @click="selectorVisible = true"
        >{{ i18n.t('channels.connectNew') }}</button>
      </div>
    </section>

    <ConnectLimitWarning v-if="slotsFull" />

    <div class="channels-page__list">
      <ChannelCard
        v-for="platform in CHANNEL_PLATFORMS"
        :key="platform"
        :platform="platform"
        :channel="store.getChannelByPlatform(platform)"
        @connect="onConnectExisting(platform)"
        @disconnect="onDisconnect(store.getChannelByPlatform(platform)?.id ?? '')"
        @refresh="onRefreshAll"
      />
    </div>

    <PlatformSelector v-model:show="selectorVisible" @select="onSelectPlatform" />

    <CredentialFormDialog
      v-model:show="credentialShow"
      :platform="credentialPlatform"
      @submit="onCredentialSubmit"
      @oauth="onCredentialOAuth"
    />
  </section>
</template>
<style scoped>
.channels-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.channels-page__top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.page__home {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 16px;
  cursor: pointer;
}
.page__home:hover {
  background: var(--ks-bg-muted);
}
.channels-page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 800;
}
.channels-page__overview {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.channels-page__count {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.channels-page__overview-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
.btn-primary:disabled {
  opacity: 0.55;
  cursor: default;
}
.btn-ghost {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.btn-ghost:disabled {
  opacity: 0.55;
  cursor: default;
}
.channels-page__list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.channels-page__welcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(244, 99, 58, 0.25);
  background: var(--ks-grad-soft);
}
.channels-page__welcome-text {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ks-primary-text);
}
.channels-page__welcome-close {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 16px;
  cursor: pointer;
}
.channels-page__welcome-close:hover {
  background: rgba(244, 99, 58, 0.1);
}
@media (max-width: 767px) {
  .channels-page {
    padding: 16px 16px 64px;
  }
  .channels-page__list {
    grid-template-columns: 1fr;
  }
  .channels-page__overview {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>