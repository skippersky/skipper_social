<script setup lang="ts">
import { ref } from 'vue';
import { useI18nStore } from '../../i18n';

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'attach', file: File): void;
  (e: 'ai'): void;
  (e: 'quick'): void;
  (e: 'typing', isTyping: boolean): void;
}>();

const i18n = useI18nStore();
const text = ref('');
const fileRef = ref<HTMLInputElement | null>(null);

function submit(): void {
  const value = text.value.trim();
  if (!value) return;
  emit('send', value);
  text.value = '';
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}

function onInput(): void {
  emit('typing', text.value.length > 0);
}

function onFileChange(): void {
  const file = fileRef.value?.files?.[0];
  if (file) emit('attach', file);
  if (fileRef.value) fileRef.value.value = '';
}

defineExpose({ setText(value: string) { text.value = value; }, getText: () => text.value });
</script>

<template>
  <div class="composer">
    <textarea
      v-model="text"
      class="composer__input"
      rows="1"
      :placeholder="i18n.t('inbox.inputPlaceholder')"
      @keydown="onKeydown"
      @input="onInput"
    ></textarea>
    <input ref="fileRef" type="file" hidden @change="onFileChange" />
    <div class="composer__actions">
      <button class="composer__btn" type="button" :title="i18n.t('inbox.attach')" :aria-label="i18n.t('inbox.attach')" @click="fileRef?.click()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <button class="composer__btn" type="button" :title="i18n.t('inbox.aiReply')" :aria-label="i18n.t('inbox.aiReply')" @click="emit('ai')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.9z"/></svg>
      </button>
      <button class="composer__btn" type="button" :title="i18n.t('inbox.quickReply')" :aria-label="i18n.t('inbox.quickReply')" @click="emit('quick')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></svg>
      </button>
      <button class="composer__send" type="button" :aria-label="i18n.t('inbox.send')" @click="submit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  border-top: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.composer__input {
  width: 100%;
  min-height: 40px;
  max-height: 120px;
  resize: vertical;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  line-height: 20px;
  padding: 9px 12px;
  box-sizing: border-box;
  font-family: inherit;
}
.composer__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.composer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.composer__btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.composer__btn:hover {
  background: var(--ks-bg-muted);
  color: var(--ks-primary-text);
}
.composer__send {
  margin-left: auto;
  width: 40px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.composer__send:hover {
  filter: brightness(1.05);
}
</style>