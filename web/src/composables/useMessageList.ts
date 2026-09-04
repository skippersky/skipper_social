import { ref } from 'vue';

const TOP_THRESHOLD_PX = 24;
const BOTTOM_THRESHOLD_PX = 48;

/** Scroll behaviour for the message pane: stick to bottom, load more at top. */
export function useMessageList(onReachTop: () => void) {
  const containerRef = ref<HTMLElement | null>(null);
  const stickToBottom = ref(true);

  function scrollToBottom(): void {
    const el = containerRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function onScroll(): void {
    const el = containerRef.value;
    if (!el) return;
    if (el.scrollTop <= TOP_THRESHOLD_PX) onReachTop();
    stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
  }

  function onNewMessage(): void {
    if (stickToBottom.value) scrollToBottom();
  }

  return { containerRef, stickToBottom, onScroll, scrollToBottom, onNewMessage };
}