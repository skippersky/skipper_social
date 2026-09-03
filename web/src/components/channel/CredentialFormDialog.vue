<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { getChannelProvider } from '../../providers';
import { useI18nStore } from '../../i18n';
import type { ChannelPlatform } from '../../types';

const props = defineProps<{ show: boolean; platform: ChannelPlatform | null }>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', credentials: Record<string, string>): void;
  (e: 'oauth'): void;
}>();

const i18n = useI18nStore();

const values = reactive<Record<string, string>>({});
const missing = ref<Record<string, boolean>>({});

const fields = computed(() =>
  props.platform ? getChannelProvider(props.platform).getRequiredCredentials() : []
);

const platformName = computed(() =>
  props.platform ? i18n.t(`channels.platform.${props.platform}`) : ''
);

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    for (const key of Object.keys(values)) delete values[key];
    missing.value = {};
  }
);

function close(): void {
  emit('update:show', false);
}

function onSubmit(): void {
  const next: Record<string, boolean> = {};
  for (const field of fields.value) {
    if (field.required && !(values[field.key] ?? '').trim()) next[field.key] = true;
  }
  missing.value = next;
  if (Object.keys(next).length > 0) return;
  const credentials: Record<string, string> = {};
  for (const field of fields.value) credentials[field.key] = (values[field.key] ?? '').trim();
  emit('submit', credentials);
}
</script>
<template>
  <div v-if="show && platform" class="cred-overlay" role="dialog" aria-modal="true" @click.self="close">
    <div class="cred-dialog">
      <header class="cred-dialog__head">
        <h2 class="cred-dialog__title">
          {{ i18n.t('channels.credentialTitle', { platform: platformName }) }}
        </h2>
        <button
          class="cred-dialog__close"
          type="button"
          :aria-label="i18n.t('channels.welcomeDismiss')"
          @click="close"
        >
          ×
        </button>
      </header>
      <p class="cred-dialog__hint">{{ i18n.t('channels.credentialHint') }}</p>
      <form class="cred-dialog__form" @submit.prevent="onSubmit">
        <div v-for="field in fields" :key="field.key" class="cred-field">
          <label :for="`cred-${field.key}`">{{ field.label }}</label>
          <input
            :id="`cred-${field.key}`"
            v-model="values[field.key]"
            :type="field.type"
            :placeholder="field.placeholder"
            autocomplete="off"
            :class="{ 'has-error': missing[field.key] }"
          />
          <p v-if="field.helpText" class="cred-field__help">{{ field.helpText }}</p>
          <p v-if="missing[field.key]" class="cred-field__error">{{ i18n.t('common.required') }}</p>
        </div>
        <div class="cred-dialog__actions">
          <button class="cred-dialog__submit" type="submit">
            {{ i18n.t('channels.credentialSubmit') }}
          </button>
          <button class="cred-dialog__oauth" type="button" @click="emit('oauth')">
            {{ i18n.t('channels.useOAuth') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
<style scoped>
.cred-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(23, 26, 33, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.cred-dialog {
  width: 100%;
  max-width: 460px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 24px;
}
.cred-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cred-dialog__title {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
}
.cred-dialog__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  cursor: pointer;
}
.cred-dialog__close:hover {
  background: var(--ks-bg-muted);
}
.cred-dialog__hint {
  margin: 8px 0 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.cred-field {
  margin-bottom: 14px;
}
.cred-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.cred-field input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  box-sizing: border-box;
}
.cred-field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.cred-field input.has-error {
  border-color: var(--ks-error);
}
.cred-field__help {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.cred-field__error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-error);
}
.cred-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}
.cred-dialog__submit {
  height: 44px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cred-dialog__submit:hover {
  filter: brightness(1.05);
}
.cred-dialog__oauth {
  height: 40px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.cred-dialog__oauth:hover {
  background: var(--ks-bg-muted);
}
@media (max-width: 767px) {
  .cred-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .cred-dialog {
    max-width: none;
    max-height: 86dvh;
    border-radius: var(--ks-radius-card) var(--ks-radius-card) 0 0;
  }
}
</style>