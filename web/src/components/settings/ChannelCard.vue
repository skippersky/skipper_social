<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import BaseChannelCard from '../channel/ChannelCard.vue';
import type { Channel, ChannelPlatform, ChannelTestResult } from '../../types';

const props = withDefaults(
  defineProps<{
    platform: ChannelPlatform;
    channel: Channel | null;
    testResult?: ChannelTestResult | null;
    busy?: boolean;
  }>(),
  { testResult: null, busy: false }
);

const emit = defineEmits<{
  (e: 'bind'): void;
  (e: 'unbind'): void;
  (e: 'test'): void;
}>();

const i18n = useI18nStore();

/** Reuses the Sprint 5b card so both surfaces stay visually identical. */
const bound = computed(() => props.channel !== null);
const latencyLabel = computed(() =>
  props.testResult ? props.testResult.latencyMs + ' ms' : ''
);
const checkedLabel = computed(() =>
  props.testResult ? new Date(props.testResult.checkedAt).toLocaleString() : ''
);
</script>

<template>
  <div class="settings-channel">
    <BaseChannelCard
      :platform="platform"
      :channel="channel"
      @connect="emit('bind')"
      @disconnect="emit('unbind')"
      @refresh="emit('test')"
    />
    <p
      v-if="testResult"
      class="settings-channel__probe"
      :data-ok="testResult.ok"
    >
      <span class="settings-channel__probe-state">
        {{ testResult.ok ? i18n.t('settings.channelsTestOk') : i18n.t('settings.channelsTestFailed') }}
      </span>
      <span class="settings-channel__probe-meta">
        {{ i18n.t('settings.channelsLastTest', { time: checkedLabel, latency: latencyLabel }) }}
      </span>
      <span v-if="testResult.message" class="settings-channel__probe-msg">{{ testResult.message }}</span>
    </p>
    <p v-else-if="busy" class="settings-channel__probe">{{ i18n.t('settings.channelsTesting') }}</p>
  </div>
</template>

<style scoped>
.settings-channel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.settings-channel__probe {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-muted);
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-secondary);
}
.settings-channel__probe[data-ok='true'] {
  border-color: rgba(21, 128, 61, 0.35);
  background: rgba(21, 128, 61, 0.08);
}
.settings-channel__probe[data-ok='false'] {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
}
.settings-channel__probe-state {
  font-weight: 700;
  color: var(--ks-text-primary);
}
.settings-channel__probe[data-ok='true'] .settings-channel__probe-state {
  color: var(--ks-success);
}
.settings-channel__probe[data-ok='false'] .settings-channel__probe-state {
  color: var(--ks-error);
}
.settings-channel__probe-msg {
  flex-basis: 100%;
  color: var(--ks-text-tertiary);
}
</style>
