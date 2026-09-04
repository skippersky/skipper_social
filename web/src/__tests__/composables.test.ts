import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useMessageList } from '../composables/useMessageList';
import { useTypingIndicator } from '../composables/useTypingIndicator';
import { resetWebSocketForTests } from '../composables/useWebSocket';
import { SOCKET_TYPING, socketBus } from '../events/socket';

describe('useMessageList', () => {
  function element(scrollTop: number) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true });
    el.scrollTop = scrollTop;
    return el;
  }

  it('sticks to the bottom until the user scrolls up', () => {
    let topCalls = 0;
    const { containerRef, stickToBottom, onScroll, scrollToBottom } = useMessageList(() => {
      topCalls += 1;
    });

    containerRef.value = element(300);
    onScroll();
    expect(stickToBottom.value).toBe(true);

    containerRef.value = element(10);
    onScroll();
    expect(topCalls).toBe(1);
    expect(stickToBottom.value).toBe(false);

    scrollToBottom();
    expect(containerRef.value.scrollTop).toBe(500);
  });

  it('does nothing without a container', () => {
    const { containerRef, onScroll, scrollToBottom } = useMessageList(() => vi.fn());
    containerRef.value = null;
    expect(() => {
      onScroll();
      scrollToBottom();
    }).not.toThrow();
  });
});

describe('useTypingIndicator', () => {
  beforeEach(() => {
    socketBus.clear();
    resetWebSocketForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    socketBus.clear();
    resetWebSocketForTests();
  });

  it('tracks remote typing for the open conversation with a 5s expiry', () => {
    const conversationId = ref<string | null>('c-1');
    const { remoteTyping, stop } = useTypingIndicator(conversationId);

    socketBus.emit({ type: SOCKET_TYPING, conversationId: 'c-1', isTyping: true });
    expect(remoteTyping.value).toBe(true);

    vi.advanceTimersByTime(4000);
    socketBus.emit({ type: SOCKET_TYPING, conversationId: 'c-1', isTyping: true });
    vi.advanceTimersByTime(4000);
    expect(remoteTyping.value).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(remoteTyping.value).toBe(false);
    stop();
  });

  it('ignores typing from other conversations and stops on unsubscribe', () => {
    const conversationId = ref<string | null>('c-1');
    const { remoteTyping, stop } = useTypingIndicator(conversationId);

    socketBus.emit({ type: SOCKET_TYPING, conversationId: 'c-2', isTyping: true });
    expect(remoteTyping.value).toBe(false);

    stop();
    socketBus.emit({ type: SOCKET_TYPING, conversationId: 'c-1', isTyping: true });
    expect(remoteTyping.value).toBe(false);
  });

  it('sends local typing signals safely without a connection', () => {
    const conversationId = ref<string | null>(null);
    const { setTyping } = useTypingIndicator(conversationId);

    expect(() => setTyping(true)).not.toThrow();
    conversationId.value = 'c-1';
    expect(() => setTyping(true)).not.toThrow();
  });
});