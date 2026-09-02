<script setup lang="ts">
import { useRouter } from 'vue-router';
import LanguageSwitcher from '../LanguageSwitcher.vue';
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const i18n = useI18nStore();

function goTo(hash: string): void {
  const current = router.currentRoute.value;
  if (current.path === '/' && current.hash === hash) {
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  void router.push({ path: '/', hash });
}
</script>

<template>
  <header class="lheader">
    <div class="lheader__brandline" aria-hidden="true"></div>
    <div class="lheader__inner">
      <router-link to="/" class="lheader__brand">
        <span class="lheader__logo" aria-hidden="true">K</span>
        <span class="lheader__name">KiliSocial</span>
      </router-link>
      <nav class="lheader__nav" aria-label="landing">
        <button type="button" class="lheader__link" @click="goTo('#features')">{{ i18n.t('nav.features') }}</button>
        <router-link to="/pricing" class="lheader__link">{{ i18n.t('nav.pricing') }}</router-link>
        <button type="button" class="lheader__link" @click="goTo('#faq')">{{ i18n.t('nav.faq') }}</button>
      </nav>
      <div class="lheader__actions">
        <LanguageSwitcher />
        <router-link v-if="auth.isAuthenticated" to="/home" class="lheader__dashboard">
          <KsAvatar :name="auth.user?.nickname ?? '?'" :src="auth.user?.avatarUrl" :size="26" />
          <span>{{ i18n.t('landing.dashboard') }}</span>
        </router-link>
        <template v-else>
          <router-link to="/login" class="lheader__signin">{{ i18n.t('auth.login') }}</router-link>
          <router-link to="/register" class="lheader__cta">{{ i18n.t('landing.cta') }}</router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.lheader {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ks-border-default);
}
.lheader__brandline {
  height: 3px;
  background: linear-gradient(90deg, #FFB238 0%, #F4633A 55%, #5B5BD6 100%);
}
.lheader__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.lheader__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.lheader__logo {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-family: Sora, sans-serif;
  font-weight: 800;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lheader__name {
  font-family: Sora, "PingFang SC", sans-serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--ks-text-primary);
}
.lheader__nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.lheader__link {
  border: none;
  background: transparent;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ks-text-secondary);
  text-decoration: none;
  cursor: pointer;
}
.lheader__link:hover {
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
}
.lheader__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.lheader__signin {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  text-decoration: none;
  padding: 8px 10px;
}
.lheader__signin:hover {
  color: var(--ks-text-primary);
}
.lheader__cta {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.lheader__cta:hover {
  filter: brightness(1.05);
  box-shadow: 0 8px 20px rgba(244, 99, 58, 0.25);
}
.lheader__dashboard {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px 0 6px;
  border-radius: 999px;
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.lheader__dashboard:hover {
  background: var(--ks-bg-muted);
}
@media (max-width: 767px) {
  .lheader__nav {
    display: none;
  }
  .lheader__signin {
    display: none;
  }
}
</style>