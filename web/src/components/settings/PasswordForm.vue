<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useI18nStore } from '../../i18n';
import { passwordStrength, validatePasswordForm } from '../../lib/settingsValidation';
import type { PasswordChangeRequest } from '../../types';

const props = withDefaults(defineProps<{ busy?: boolean }>(), { busy: false });

const emit = defineEmits<{ (e: 'submit', value: PasswordChangeRequest): void }>();

const i18n = useI18nStore();
const form = reactive<PasswordChangeRequest>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const touched = reactive({
  currentPassword: false,
  newPassword: false,
  confirmPassword: false
});

const STRENGTH_KEYS = [
  'settings.strength.empty',
  'settings.strength.weak',
  'settings.strength.fair',
  'settings.strength.good',
  'settings.strength.strong'
];

const strength = computed(() => passwordStrength(form.newPassword));
const errors = computed(() => validatePasswordForm(form));
const strengthKey = computed(() => STRENGTH_KEYS[strength.value.score]);
const valid = computed(() => Object.keys(errors.value).length === 0);

/** Rules are only shown once the field has been visited. */
function errorFor(field: keyof PasswordChangeRequest): string | null {
  return touched[field] ? (errors.value[field] ?? null) : null;
}

function touch(field: keyof PasswordChangeRequest): void {
  touched[field] = true;
}

function onSubmit(): void {
  touched.currentPassword = true;
  touched.newPassword = true;
  touched.confirmPassword = true;
  if (!valid.value || props.busy) return;
  emit('submit', { ...form });
}

function reset(): void {
  form.currentPassword = '';
  form.newPassword = '';
  form.confirmPassword = '';
  touched.currentPassword = false;
  touched.newPassword = false;
  touched.confirmPassword = false;
}

defineExpose({ reset, form });
</script>

<template>
  <form class="pw-form" @submit.prevent="onSubmit">
    <div class="pw-field">
      <label for="pw-current">{{ i18n.t('settings.passwordCurrent') }}</label>
      <input
        id="pw-current"
        v-model="form.currentPassword"
        type="password"
        autocomplete="current-password"
        :class="{ 'has-error': errorFor('currentPassword') !== null }"
        @blur="touch('currentPassword')"
      />
      <p v-if="errorFor('currentPassword')" class="pw-field__error">
        {{ i18n.t(errorFor('currentPassword') as string) }}
      </p>
    </div>

    <div class="pw-field">
      <label for="pw-new">{{ i18n.t('settings.passwordNew') }}</label>
      <input
        id="pw-new"
        v-model="form.newPassword"
        type="password"
        autocomplete="new-password"
        :class="{ 'has-error': errorFor('newPassword') !== null }"
        @blur="touch('newPassword')"
      />
      <div class="pw-meter" :data-score="strength.score" aria-hidden="true">
        <span
          v-for="index in 4"
          :key="'seg-' + index"
          class="pw-meter__seg"
          :class="{ 'pw-meter__seg--on': strength.score >= index }"
        ></span>
      </div>
      <p class="pw-meter__label">{{ i18n.t(strengthKey) }}</p>
      <ul v-if="strength.missing.length > 0" class="pw-rules">
        <li v-for="rule in strength.missing" :key="rule">{{ i18n.t(rule) }}</li>
      </ul>
      <p v-if="errorFor('newPassword')" class="pw-field__error">
        {{ i18n.t(errorFor('newPassword') as string) }}
      </p>
    </div>

    <div class="pw-field">
      <label for="pw-confirm">{{ i18n.t('settings.passwordConfirm') }}</label>
      <input
        id="pw-confirm"
        v-model="form.confirmPassword"
        type="password"
        autocomplete="new-password"
        :class="{ 'has-error': errorFor('confirmPassword') !== null }"
        @blur="touch('confirmPassword')"
      />
      <p v-if="errorFor('confirmPassword')" class="pw-field__error">
        {{ i18n.t(errorFor('confirmPassword') as string) }}
      </p>
    </div>

    <button class="pw-submit" type="submit" :disabled="busy || !valid">
      {{ busy ? i18n.t('common.loading') : i18n.t('settings.passwordSubmit') }}
    </button>
  </form>
</template>

<style scoped>
.pw-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pw-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.pw-field input {
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
.pw-field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.pw-field input.has-error {
  border-color: var(--ks-error);
}
.pw-field__error {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-error);
}
.pw-meter {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}
.pw-meter__seg {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--ks-bg-muted);
  border: 1px solid var(--ks-border-default);
}
.pw-meter__seg--on {
  background: var(--ks-warning);
  border-color: transparent;
}
.pw-meter[data-score='3'] .pw-meter__seg--on {
  background: var(--ks-primary);
}
.pw-meter[data-score='4'] .pw-meter__seg--on {
  background: var(--ks-success);
}
.pw-meter__label {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.pw-rules {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-secondary);
}
.pw-submit {
  height: 42px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.pw-submit:hover {
  filter: brightness(1.05);
}
.pw-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
