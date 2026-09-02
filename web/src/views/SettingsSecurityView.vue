<script setup lang="ts">
import { ref } from 'vue';
import { showToast } from 'vant';
import SettingsNav from '../components/SettingsNav.vue';
import { changePassword } from '../api/auth';
import { ApiError } from '../api/http';
import { useI18nStore } from '../i18n';

const i18n = useI18nStore();

const current = ref('');
const next = ref('');
const confirm = ref('');
const fieldErrors = ref<Record<string, string>>({});
const submitting = ref(false);
const done = ref(false);

function validate(): boolean {
  const errors: Record<string, string> = {};
  if (!current.value) errors.current = i18n.t('auth.passwordRequired');
  if (next.value.length < 8 || !/[a-z]/.test(next.value) || !/[A-Z]/.test(next.value) || !/\d/.test(next.value)) {
    errors.next = i18n.t('auth.passwordWeak');
  } else if (next.value === current.value) {
    errors.next = i18n.t('security.sameAsCurrent');
  }
  if (confirm.value !== next.value) errors.confirm = i18n.t('auth.confirmMismatch');
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function onSubmit(): Promise<void> {
  done.value = false;
  if (!validate()) return;
  submitting.value = true;
  try {
    await changePassword(current.value, next.value);
    done.value = true;
    current.value = '';
    next.value = '';
    confirm.value = '';
    showToast(i18n.t('security.changed'));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'WRONG_PASSWORD') {
      fieldErrors.value = { current: i18n.t('security.wrongCurrent') };
    } else {
      showToast(i18n.t('api.network'));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <SettingsNav>
    <section class="security-card">
      <h2 class="security-card__title">{{ i18n.t('security.title') }}</h2>
      <form class="security-card__form" @submit.prevent="onSubmit">
        <div class="security-field">
          <label for="sec-current">{{ i18n.t('security.current') }}</label>
          <input id="sec-current" v-model="current" type="password" autocomplete="current-password" />
          <p v-if="fieldErrors.current" class="security-error">{{ fieldErrors.current }}</p>
        </div>
        <div class="security-field">
          <label for="sec-next">{{ i18n.t('security.new') }}</label>
          <input id="sec-next" v-model="next" type="password" autocomplete="new-password" />
          <p v-if="fieldErrors.next" class="security-error">{{ fieldErrors.next }}</p>
        </div>
        <div class="security-field">
          <label for="sec-confirm">{{ i18n.t('security.confirm') }}</label>
          <input id="sec-confirm" v-model="confirm" type="password" autocomplete="new-password" />
          <p v-if="fieldErrors.confirm" class="security-error">{{ fieldErrors.confirm }}</p>
        </div>
        <button class="security-submit" type="submit" :disabled="submitting">
          {{ submitting ? '...' : i18n.t('security.submit') }}
        </button>
        <p v-if="done" class="security-done" role="status">
          {{ i18n.t('security.changed') }} - {{ i18n.t('security.othersCleared') }}
        </p>
      </form>
    </section>
  </SettingsNav>
</template>

<style scoped>
.security-card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
  max-width: 480px;
}
.security-card__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  margin-bottom: 18px;
}
.security-card__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.security-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.security-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.security-field input {
  height: 42px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
}
.security-field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.security-error {
  margin: 0;
  color: var(--ks-error);
  font-size: 12px;
  line-height: 18px;
}
.security-submit {
  height: 44px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.security-submit:disabled {
  opacity: 0.6;
  cursor: wait;
}
.security-done {
  margin: 0;
  color: var(--ks-success);
  font-size: 13px;
  line-height: 19px;
}
</style>