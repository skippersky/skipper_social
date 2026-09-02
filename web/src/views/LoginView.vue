<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { DEMO_CREDENTIALS, demoMode } from '../api/auth';
import { apiErrorI18nKey, ApiError } from '../api/http';
import { useI18nStore } from '../i18n';
import { useAuthStore } from '../stores/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const i18n = useI18nStore();

const email = ref('');
const password = ref('');
const fieldError = ref('');
const submitError = ref('');
const submitting = ref(false);
const demoNotice = ref(demoMode());

function validate(): boolean {
  if (!EMAIL_RE.test(email.value.trim())) {
    fieldError.value = i18n.t('auth.emailInvalid');
    return false;
  }
  if (!password.value) {
    fieldError.value = i18n.t('auth.passwordRequired');
    return false;
  }
  fieldError.value = '';
  return true;
}

function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHORIZED') return 'auth.badCredentials';
    if (error.code === 'NOT_ACTIVATED') return 'auth.notActivated';
  }
  return apiErrorI18nKey(error);
}

async function onSubmit(): Promise<void> {
  submitError.value = '';
  if (!validate()) return;
  submitting.value = true;
  try {
    await auth.login({ email: email.value.trim(), password: password.value });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/chat';
    await router.push(redirect);
  } catch (error) {
    submitError.value = i18n.t(errorKey(error));
    demoNotice.value = demoMode();
  } finally {
    submitting.value = false;
  }
}

function onGoogle(): void {
  // GIS wiring lands together with the backend OAuth endpoint (API_CONTRACT.md).
  showToast(i18n.t('auth.googleSoon'));
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand" aria-hidden="true">K</div>
      <h1 class="auth-title">{{ i18n.t('auth.loginTitle') }}</h1>
      <p class="auth-subtitle">{{ i18n.t('auth.loginSubtitle') }}</p>
      <div v-if="demoNotice" class="auth-demo">
        <span>{{ i18n.t('auth.demoNotice') }}</span>
        <span class="auth-demo__creds">{{ i18n.t('auth.demoHint') }}: {{ DEMO_CREDENTIALS.email }} / {{ DEMO_CREDENTIALS.password }}</span>
      </div>
      <form @submit.prevent="onSubmit">
        <div class="auth-field">
          <label for="login-email">{{ i18n.t('auth.email') }}</label>
          <input id="login-email" v-model="email" type="email" autocomplete="email" />
        </div>
        <div class="auth-field">
          <label for="login-password">{{ i18n.t('auth.password') }}</label>
          <input id="login-password" v-model="password" type="password" autocomplete="current-password" />
        </div>
        <p v-if="fieldError" class="auth-error" role="alert">{{ fieldError }}</p>
        <p v-if="submitError" class="auth-error" role="alert">{{ submitError }}</p>
        <button class="auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '...' : i18n.t('auth.login') }}
        </button>
      </form>
      <div class="auth-links">
        <router-link to="/register">{{ i18n.t('auth.noAccount') }}</router-link>
        <router-link to="/forgot-password">{{ i18n.t('auth.forgot') }}</router-link>
      </div>
      <div class="auth-divider">{{ i18n.t('auth.or') }}</div>
      <button class="auth-google" type="button" @click="onGoogle">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/>
        </svg>
        {{ i18n.t('auth.google') }}
      </button>
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
.auth-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, rgba(244, 99, 58, 0.05) 0 2px, transparent 2px 18px),
    repeating-linear-gradient(-45deg, rgba(91, 91, 214, 0.04) 0 2px, transparent 2px 18px);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 70%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 70%);
  pointer-events: none;
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
.auth-demo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  margin-bottom: 16px;
  border-radius: 10px;
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 12px;
  line-height: 18px;
}
.auth-demo__creds {
  font-family: ui-monospace, monospace;
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
.auth-submit:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: 0 8px 20px rgba(244, 99, 58, 0.25);
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
.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0 14px;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--ks-border-default);
}
.auth-google {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  border-radius: var(--ks-radius-btn);
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
  cursor: pointer;
}
.auth-google:hover {
  background: var(--ks-bg-muted);
}
</style>