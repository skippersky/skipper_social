<script setup lang="ts">
import { ref } from 'vue';
import { resetPassword } from '../api/auth';
import { useI18nStore } from '../i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const i18n = useI18nStore();
const email = ref('');
const fieldError = ref('');
const submitting = ref(false);
const sent = ref(false);

async function onSubmit(): Promise<void> {
  fieldError.value = '';
  if (!EMAIL_RE.test(email.value.trim())) {
    fieldError.value = i18n.t('auth.emailInvalid');
    return;
  }
  submitting.value = true;
  try {
    await resetPassword(email.value.trim());
    sent.value = true;
  } catch {
    fieldError.value = i18n.t('api.network');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand" aria-hidden="true">K</div>
      <template v-if="!sent">
        <h1 class="auth-title">{{ i18n.t('auth.resetTitle') }}</h1>
        <p class="auth-subtitle">{{ i18n.t('auth.resetHint') }}</p>
        <form @submit.prevent="onSubmit">
          <div class="auth-field">
            <label for="forgot-email">{{ i18n.t('auth.email') }}</label>
            <input id="forgot-email" v-model="email" type="email" autocomplete="email" />
          </div>
          <p v-if="fieldError" class="auth-error" role="alert">{{ fieldError }}</p>
          <button class="auth-submit" type="submit" :disabled="submitting">
            {{ submitting ? '...' : i18n.t('auth.resetSend') }}
          </button>
        </form>
      </template>
      <template v-else>
        <h1 class="auth-title">{{ i18n.t('auth.resetSent') }}</h1>
        <p class="auth-subtitle">{{ email }}</p>
      </template>
      <div class="auth-links auth-links--center">
        <router-link to="/login">{{ i18n.t('auth.backToLogin') }}</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  position: relative;
  background:
    radial-gradient(600px 300px at 85% -10%, rgba(255, 178, 56, 0.18), transparent 65%),
    radial-gradient(500px 280px at 10% 110%, rgba(91, 91, 214, 0.12), transparent 60%),
    var(--ks-bg-base);
}
.auth-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 32px 28px;
}
.auth-brand {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-family: Sora, sans-serif;
  font-weight: 800;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.auth-title {
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
}
.auth-subtitle {
  margin: 6px 0 18px;
  color: var(--ks-text-tertiary);
  font-size: 13px;
  line-height: 20px;
}
.auth-field {
  margin-bottom: 14px;
}
.auth-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.auth-field input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 15px;
  box-sizing: border-box;
}
.auth-field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.auth-error {
  margin: 0 0 12px;
  color: var(--ks-error);
  font-size: 13px;
  line-height: 19px;
}
.auth-submit {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.auth-submit:disabled {
  opacity: 0.6;
  cursor: wait;
}
.auth-links {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  font-size: 13px;
}
.auth-links--center {
  justify-content: center;
}
</style>