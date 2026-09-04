<script setup lang="ts">
import { useI18nStore } from '../../i18n';
import type { WebSocketStatus } from '../../composables/useWebSocket';

defineProps<{ status: WebSocketStatus }>();

const i18n = useI18nStore();

const labelKey = {
  connecting: 'inbox.wsConnecting',
  reconnecting: 'inbox.wsReconnecting',
  disconnected: 'inbox.wsDisconnected',
  connected: ''
} as const;
</script>

<template>
  <div v-if="status !== 'connected'" class="ws-bar" role="alert">
    <span class="ws-bar__dot" aria-hidden="true"></span>
    {{ i18n.t(labelKey[status]) }}
  </div>
</template>

<style scoped>
.ws-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(180, 83, 9, 0.1);
  color: var(--ks-warning);
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid rgba(180, 83, 9, 0.2);
}
.ws-bar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ks-warning);
  animation: ws-pulse 1.4s infinite;
}
@keyframes ws-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>