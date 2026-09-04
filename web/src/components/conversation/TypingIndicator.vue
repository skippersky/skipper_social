<script setup lang="ts">
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();
</script>

<template>
  <div class="typing" role="status" :aria-label="i18n.t('inbox.typing')">
    <span class="typing__dot"></span>
    <span class="typing__dot"></span>
    <span class="typing__dot"></span>
  </div>
</template>

<style scoped>
.typing {
  display: inline-flex;
  gap: 4px;
  padding: 10px 14px;
  background: var(--ks-bg-muted);
  border-radius: 16px 16px 16px 4px;
  align-self: flex-start;
  margin: 4px 0;
}
.typing__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ks-text-tertiary);
  animation: typing-blink 1.2s infinite ease-in-out;
}
.typing__dot:nth-child(2) {
  animation-delay: 0.2s;
}
.typing__dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing-blink {
  0%, 80%, 100% { opacity: 0.35; }
  40% { opacity: 1; }
}
</style>