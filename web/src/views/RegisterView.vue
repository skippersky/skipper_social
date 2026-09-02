<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiErrorI18nKey, ApiError } from '../api/http';
import { useI18nStore } from '../i18n';
import { useAuthStore } from '../stores/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d[\d\s-]{6,14}$/;

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const i18n = useI18nStore();

const email = ref('');
const password = ref('');
const confirm = ref('');
const nickname = ref('');
const phone = ref('');
const fieldErrors = ref<Record<string, string>>({});
const submitError = ref('');
const submitting = ref(false);

function validate(): boolean {
  const errors: Record<string, string> = {};
  if (!EMAIL_RE.test(email.value.trim())) errors.email = i18n.t('auth.emailInvalid');
  if (!/[a-z]/.test(password.value) || !/[A-Z]/.test(password.value) || !/\d/.test(password.value) || password.value.length < 8) {
    errors.password = i18n.t('auth.passwordWeak');
  }
  if (confirm.value !== password.value) errors.confirm = i18n.t('auth.confirmMismatch');
  const name = nickname.value.trim();
  if (name.length < 2 || name.length > 20) errors.nickname = i18n.t('auth.nicknameInvalid');
  if (phone.value.trim() && !PHONE_RE.test(phone.value.trim())) errors.phone = i18n.t('auth.phoneInvalid');
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_EXISTS') return 'auth.emailExists';
    if (error.code === 'UNAUTHORIZED') return 'auth.badCredentials';
  }
  return apiErrorI18nKey(error);
}

async function onSubmit(): Promise<void> {
  submitError.value = '';
  if (!validate()) return;
  submitting.value = true;
  try {
    await auth.register({
      email: email.value.trim(),
      password: password.value,
      nickname: nickname.value.trim(),
      phone: phone.value.trim() || undefined
    });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/chat';
    await router.push(redirect);
  } catch (error) {
    submitError.value = i18n.t(errorKey(error));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand" aria-hidden="true">K</div>
      <h1 class="auth-title">{{ i18n.t('auth.register') }}</h1>
      <p class="auth-subtitle">{{ i18n.t('auth.loginSubtitle') }}</p>
      <form @submit.prevent="onSubmit">
        <div class="auth-field">
          <label for="reg-email">{{ i18n.t('auth.email') }}</label>
          <input id="reg-email" v-model="email" type="email" autocomplete="email" />
          <p v-if="fieldErrors.email" class="auth-error">{{ fieldErrors.email }}</p>
        </div>
        <div class="auth-field">
          <label for="reg-nickname">{{ i18n.t('auth.nickname') }}</label>
          <input id="reg-nickname" v-model="nickname" type="text" autocomplete="nickname" />
          <p v-if="fieldErrors.nickname" class="auth-error">{{ fieldErrors.nickname }}</p>
        </div>
        <div class="auth-field">
          <label for="reg-phone">{{ i18n.t('auth.phone') }}</label>
          <input id="reg-phone" v-model="phone" type="tel" autocomplete="tel" />
          <p v-if="fieldErrors.phone" class="auth-error">{{ fieldErrors.phone }}</p>
        </div>
        <div class="auth-field">
          <label for="reg-password">{{ i18n.t('auth.password') }}</label>
          <input id="reg-password" v-model="password" type="password" autocomplete="new-password" />
          <p v-if="fieldErrors.password" class="auth-error">{{ fieldErrors.password }}</p>
        </div>
        <div class="auth-field">
          <label for="reg-confirm">{{ i18n.t('auth.confirmPassword') }}</label>
          <input id="reg-confirm" v-model="confirm" type="password" autocomplete="new-password" />
          <p v-if="fieldErrors.confirm" class="auth-error">{{ fieldErrors.confirm }}</p>
        </div>
        <p v-if="submitError" class="auth-error" role="alert">{{ submitError }}</p>
        <button class="auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '...' : i18n.t('auth.register') }}
        </button>
      </form>
      <div class="auth-links auth-links--center">
        <router-link to="/login">{{ i18n.t('auth.hasAccount') }}</router-link>
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
  max-width: 440px;
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
  margin-bottom: 12px;
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
  height: 42px;
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
  margin: 6px 0 0;
  color: var(--ks-error);
  font-size: 12px;
  line-height: 18px;
}
form > .auth-error {
  margin: 0 0 12px;
}
.auth-submit {
  width: 100%;
  height: 46px;
  margin-top: 6px;
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
.auth-links--center {
  justify-content: center;
}
</style>