<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { ChannelStatus } from '../../types';

const props = defineProps<{ status: ChannelStatus }>();
const i18n = useI18nStore();

const stateClass = computed(() => `channel-status--${props.status.replace('_', '-')}`);
</script>

<template>
  <span class="channel-status" :class="stateClass">{{ i18n.t(`channels.status.${status}`) }}</span>
</template>

<style scoped>
.channel-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.channel-status::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.channel-status--connected {
  background: rgba(21, 128, 61, 0.12);
  color: var(--ks-success);
}
.channel-status--needs-reauth {
  background: rgba(220, 38, 38, 0.1);
  color: var(--ks-error);
}
.channel-status--disconnected {
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
</style>