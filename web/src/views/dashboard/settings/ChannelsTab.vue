<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import ChannelBindDialog from '../../../components/settings/ChannelBindDialog.vue';
import SettingsChannelCard from '../../../components/settings/ChannelCard.vue';
import { useChannelBinding } from '../../../composables/useChannelBinding';
import { useI18nStore } from '../../../i18n';
import { useChannelStore } from '../../../stores/channel';
import type { BindChannelRequest, ChannelPlatform, ChannelTestResult } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const channelStore = useChannelStore();
const {
  store,
  channels,
  loading,
  saving,
  availablePlatforms,
  loadChannelAccounts,
  bindChannel,
  unbindChannel,
  testConnection
} = useChannelBinding();

const dialogShow = ref(false);
/** Probe outcome surfaced inside the dialog before the row is committed. */
const pendingTest = ref<ChannelTestResult | null>(null);
const probingId = ref<string | null>(null);

const hasChannels = computed(() => channels.value.length > 0);
const canBind = computed(() => availablePlatforms.value.length > 0);

onMounted(() => {
  void loadChannelAccounts();
});

function openDialog(): void {
  pendingTest.value = null;
  dialogShow.value = true;
}

function platformLabel(platform: ChannelPlatform): string {
  return i18n.t('channels.platform.' + platform);
}

async function onBind(data: BindChannelRequest): Promise<void> {
  const bound = await bindChannel(data);
  if (!bound) {
    if (store.error) showToast(i18n.t(store.error));
    return;
  }
  dialogShow.value = false;
  pendingTest.value = null;
  showToast(i18n.t('settings.channelsBound', { platform: platformLabel(bound.platform) }));
}

/**
 * Test-then-commit: the probe needs a channel id, so the row is bound first and
 * rolled back when the credentials are rejected. A failed test leaves no trace.
 */
async function onDialogTest(data: BindChannelRequest): Promise<void> {
  const bound = await bindChannel(data);
  if (!bound) {
    if (store.error) showToast(i18n.t(store.error));
    return;
  }
  const result = await testConnection(bound.id);
  pendingTest.value = result;
  if (result && result.ok) {
    dialogShow.value = false;
    pendingTest.value = null;
    showToast(i18n.t('settings.bindTestOk', { latency: result.latencyMs + ' ms' }));
    return;
  }
  await unbindChannel(bound.id);
  pendingTest.value = result;
}

async function onOAuth(platform: ChannelPlatform): Promise<void> {
  dialogShow.value = false;
  pendingTest.value = null;
  const result = await channelStore.connect(platform);
  if (!result) {
    if (channelStore.error) showToast(i18n.t(channelStore.error));
    return;
  }
  if (result.channel) {
    await loadChannelAccounts();
    showToast(i18n.t('settings.channelsBound', { platform: platformLabel(platform) }));
    return;
  }
  if (!result.authUrl) return;
  if (result.authUrl.startsWith('/')) await router.push(result.authUrl);
  else window.location.assign(result.authUrl);
}

async function onUnbind(channelId: string, platform: ChannelPlatform): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('settings.channelsUnbind'),
      message: i18n.t('settings.channelsUnbindConfirm', { platform: platformLabel(platform) }),
      confirmButtonText: i18n.t('settings.channelsUnbind'),
      cancelButtonText: i18n.t('common.cancel')
    });
  } catch {
    return;
  }
  if (await unbindChannel(channelId)) {
    showToast(i18n.t('settings.channelsUnbound'));
  } else if (store.error) {
    showToast(i18n.t(store.error));
  }
}

async function onProbeRow(channelId: string): Promise<void> {
  probingId.value = channelId;
  const result = await testConnection(channelId);
  probingId.value = null;
  if (!result) return;
  showToast(result.ok ? i18n.t('settings.channelsTestOk') : i18n.t('settings.channelsTestFailed'));
}
</script>

<template>
  <div class="tab">
    <section class="tab__card">
      <div class="tab__head">
        <div class="tab__head-copy">
          <h2 class="tab__card-title">{{ i18n.t('settings.channelsTitle') }}</h2>
          <p class="tab__hint tab__hint--top">{{ i18n.t('settings.channelsSubtitle') }}</p>
        </div>
        <button
          class="tab__btn tab__btn--primary"
          type="button"
          :disabled="!canBind || saving"
          @click="openDialog"
        >{{ i18n.t('settings.channelsBind') }}</button>
      </div>
    </section>

    <p v-if="loading && !hasChannels" class="chan__note">{{ i18n.t('common.loading') }}</p>

    <section v-else-if="!hasChannels" class="chan__empty">
      <span class="chan__empty-mark" aria-hidden="true"></span>
      <p class="chan__empty-title">{{ i18n.t('settings.channelsEmpty') }}</p>
      <p class="chan__empty-hint">{{ i18n.t('settings.channelsEmptyHint') }}</p>
      <button
        class="tab__btn tab__btn--primary"
        type="button"
        :disabled="!canBind || saving"
        @click="openDialog"
      >{{ i18n.t('settings.channelsBind') }}</button>
    </section>

    <div v-else class="chan__grid">
      <SettingsChannelCard
        v-for="channel in channels"
        :key="'chan-' + channel.id"
        :platform="channel.platform"
        :channel="channel"
        :test-result="store.channelTests[channel.id] ?? null"
        :busy="probingId === channel.id"
        @bind="openDialog"
        @unbind="onUnbind(channel.id, channel.platform)"
        @test="onProbeRow(channel.id)"
      />
    </div>

    <ChannelBindDialog
      v-model:show="dialogShow"
      :available="availablePlatforms"
      :busy="saving"
      :test-result="pendingTest"
      @bind="onBind"
      @test="onDialogTest"
      @oauth="onOAuth"
    />
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tab__card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
}
.tab__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.tab__head-copy {
  min-width: 0;
}
.tab__card-title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tab__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.tab__hint--top {
  margin: 4px 0 0;
}
.tab__btn {
  height: 40px;
  padding: 0 20px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.tab__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tab__btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
.tab__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.chan__note {
  margin: 0;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.chan__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.chan__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  background: var(--ks-bg-surface);
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  text-align: center;
}
.chan__empty-mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 2px solid var(--ks-primary);
  background: var(--ks-grad-brand);
  opacity: 0.85;
}
.chan__empty-title {
  margin: 6px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.chan__empty-hint {
  margin: 0 0 10px;
  max-width: 420px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
@media (max-width: 1023px) {
  .chan__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .tab__head {
    flex-direction: column;
    align-items: stretch;
  }
  .tab__btn {
    width: 100%;
  }
}
</style>
