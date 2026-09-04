import { ref, type Ref } from 'vue';
import { SOCKET_TYPING, socketBus } from '../events/socket';
import { useWebSocket } from './useWebSocket';

const TYPING_TTL_MS = 5000;

/** Remote typing state for one conversation + outbound typing signals. */
export function useTypingIndicator(conversationId: Ref<string | null>) {
  const remoteTyping = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const off = socketBus.on((event) => {
    if (event.type !== SOCKET_TYPING || event.conversationId !== conversationId.value) return;
    remoteTyping.value = event.isTyping;
    if (timer) clearTimeout(timer);
    if (event.isTyping) {
      timer = setTimeout(() => {
        remoteTyping.value = false;
      }, TYPING_TTL_MS);
    }
  });

  function setTyping(isTyping: boolean): void {
    if (conversationId.value) useWebSocket().typing(conversationId.value, isTyping);
  }

  return { remoteTyping, setTyping, stop: off };
}