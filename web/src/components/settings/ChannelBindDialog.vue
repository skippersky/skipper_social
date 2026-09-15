<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { getChannelProvider } from '../../providers';
import { useI18nStore } from '../../i18n';
import { validateCredentials } from '../../lib/settingsValidation';
import { CHANNEL_PLATFORMS } from '../../types';
import type {
  BindChannelRequest,
  ChannelPlatform,
  ChannelTestResult
} from '../../types';

const props = withDefaults(
  defineProps<{
    show: boolean;
    available?: ChannelPlatform[];
    busy?: boolean;
    testResult?: ChannelTestResult | null;
  }>(),
  { available: () => [], busy: false, testResult: null }
);

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'bind', value: BindChannelRequest): void;
  (e: 'test', value: BindChannelRequest): void;
  (e: 'oauth', platform: ChannelPlatform): void;
}>();

const i18n = useI18nStore();
/** Step 1 picks the platform, step 2 collects its credentials. */
const step = ref<1 | 2>(1);
const platform = ref<ChannelPlatform | null>(null);
const values = reactive<Record<string, string>>({});
const errors = ref<Record<string, string>>({});

const platforms = computed(() =>
  props.available.length > 0 ? props.available : CHANNEL_PLATFORMS
);
const fields = computed(() =>
  platform.value ? getChannelProvider(platform.value).getRequiredCredentials() : []
);
const platformName = computed(() =>
  platform.value ? i18n.t('channels.platform.' + platform.value) : ''
);
const firstError = computed(() => Object.values(errors.value)[0] ?? null);
const filled = computed(() =>
  fields.value.every((field) => ((values[field.key] ?? '') as string).trim().length > 0)
);

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    step.value = 1;
    platform.value = null;
    errors.value = {};
    for (const key of Object.keys(values)) delete values[key];
  }
);

function close(): void {
  emit('update:show', false);
}

function choose(next: ChannelPlatform): void {
  platform.value = next;
  errors.value = {};
  for (const key of Object.keys(values)) delete values[key];
  step.value = 2;
}

function back(): void {
  step.value = 1;
  errors.value = {};
}

function payload(): BindChannelRequest | null {
  if (!platform.value) return null;
  const credentials: Record<string, string> = {};
  for (const field of fields.value) {
    credentials[field.key] = ((values[field.key] ?? '') as string).trim();
  }
  return { platform: platform.value, credentials };
}

function onTest(): void {
  const data = payload();
  if (!data) return;
  errors.value = validateCredentials(fields.value, data.credentials);
  if (firstError.value) return;
  emit('test', data);
}

function onConfirm(): void {
  const data = payload();
  if (!data) return;
  errors.value = validateCredentials(fields.value, data.credentials);
  if (firstError.value) return;
  emit('bind', data);
}
</script>

<template>
  <div
    v-if="show"
    class="bind-overlay"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="bind-dialog">
      <header class="bind-dialog__head">
        <h2 class="bind-dialog__title">
          {{ step === 1 ? i18n.t('settings.bindPickPlatform') : i18n.t('settings.bindTitle') }}
        </h2>
        <button
          class="bind-dialog__close"
          type="button"
          :aria-label="i18n.t('common.close')"
          @click="close"
        >×</button>
      </header>

      <ul v-if="step === 1" class="bind-list">
        <li v-for="item in platforms" :key="'pick-' + item">
          <button class="bind-list__item" type="button" @click="choose(item)">
            <span class="bind-list__name">{{ i18n.t('channels.platform.' + item) }}</span>
            <span class="bind-list__arrow" aria-hidden="true">&rarr;</span>
          </button>
        </li>
      </ul>

      <form v-else class="bind-form" @submit.prevent="onConfirm">
        <p class="bind-form__platform">{{ platformName }}</p>
        <div v-for="field in fields" :key="field.key" class="bind-field">
          <label :for="'bind-' + field.key">{{ field.label }}</label>
          <input
            :id="'bind-' + field.key"
            v-model="values[field.key]"
            :type="field.type"
            :placeholder="field.placeholder"
            autocomplete="off"
            :class="{ 'has-error': Boolean(errors[field.key]) }"
          />
          <p v-if="field.helpText" class="bind-field__help">{{ field.helpText }}</p>
          <p v-if="errors[field.key]" class="bind-field__error">{{ i18n.t(errors[field.key]) }}</p>
        </div>

        <p
          v-if="testResult"
          class="bind-probe"
          :data-ok="testResult.ok"
        >{{ testResult.ok ? i18n.t('settings.bindTestOk', { latency: testResult.latencyMs + ' ms' }) : i18n.t('settings.bindTestFailed') }}</p>

        <div class="bind-dialog__actions">
          <button class="bind-btn" type="button" @click="back">
            {{ i18n.t('settings.bindBack') }}
          </button>
          <button class="bind-btn" type="button" :disabled="busy || !filled" @click="onTest">
            {{ i18n.t('settings.bindTest') }}
          </button>
          <button class="bind-btn bind-btn--primary" type="submit" :disabled="busy || !filled">
            {{ i18n.t('settings.bindConfirm') }}
          </button>
          <button
            class="bind-btn bind-btn--ghost"
            type="button"
            @click="platform && emit('oauth', platform)"
          >{{ i18n.t('settings.bindUseOAuth') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.bind-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(23, 26, 33, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.bind-dialog {
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 24px;
}
.bind-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.bind-dialog__title {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.bind-dialog__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  cursor: pointer;
}
.bind-dialog__close:hover {
  background: var(--ks-bg-muted);
}
.bind-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bind-list__item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.bind-list__item:hover {
  background: var(--ks-bg-muted);
  border-color: var(--ks-border-strong);
}
.bind-list__arrow {
  color: var(--ks-text-tertiary);
}
.bind-form__platform {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-primary-text);
}
.bind-field {
  margin-bottom: 14px;
}
.bind-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.bind-field input {
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
.bind-field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.bind-field input.has-error {
  border-color: var(--ks-error);
}
.bind-field__help {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.bind-field__error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-error);
}
.bind-probe {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-muted);
  font-size: 12px;
  color: var(--ks-text-secondary);
}
.bind-probe[data-ok='true'] {
  border-color: rgba(21, 128, 61, 0.35);
  background: rgba(21, 128, 61, 0.08);
  color: var(--ks-success);
}
.bind-probe[data-ok='false'] {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
  color: var(--ks-error);
}
.bind-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.bind-btn {
  flex: 1;
  min-width: 120px;
  height: 42px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.bind-btn:hover {
  background: var(--ks-bg-muted);
}
.bind-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.bind-btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.bind-btn--primary:hover {
  filter: brightness(1.05);
  background: var(--ks-grad-brand);
}
.bind-btn--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ks-primary-text);
}
@media (max-width: 767px) {
  .bind-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .bind-dialog {
    max-width: none;
    max-height: 88dvh;
    border-radius: var(--ks-radius-card) var(--ks-radius-card) 0 0;
  }
}
</style>
