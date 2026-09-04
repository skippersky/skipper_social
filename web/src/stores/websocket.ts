import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

export const useWebSocketStore = defineStore('websocket', () => {
  const { status, connect, disconnect, typing } = useWebSocket();

  const isConnected = computed(() => status.value === 'connected');
  const isReconnecting = computed(() => status.value === 'reconnecting');
  const showStatusBar = computed(() => status.value !== 'connected');

  return { status, connect, disconnect, typing, isConnected, isReconnecting, showStatusBar };
});