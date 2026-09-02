<script setup lang="ts">
import { useRouter } from 'vue-router';
import KsAvatar from './KsAvatar.vue';
import { useI18nStore } from '../i18n';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const i18n = useI18nStore();

async function onLogout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <div class="settings">
    <aside class="settings__nav">
      <div class="settings__user">
        <KsAvatar :name="auth.user?.nickname ?? '?'" :src="auth.user?.avatarUrl" :size="44" />
        <div class="settings__user-meta">
          <p class="settings__name">{{ auth.user?.nickname }}</p>
          <p class="settings__email">{{ auth.user?.email }}</p>
        </div>
        <span v-if="auth.demo" class="settings__demo">{{ i18n.t('auth.demoBadge') }}</span>
      </div>
      <nav class="settings__links" aria-label="settings">
        <router-link to="/settings/profile" class="settings__link">{{ i18n.t('nav.profile') }}</router-link>
        <router-link to="/settings/security" class="settings__link">{{ i18n.t('nav.security') }}</router-link>
      </nav>
      <button class="settings__logout" type="button" @click="onLogout">{{ i18n.t('auth.logout') }}</button>
    </aside>
    <div class="settings__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 24px 48px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  align-items: start;
}
.settings__nav {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings__user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.settings__user-meta {
  min-width: 0;
}
.settings__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.settings__email {
  margin: 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.settings__demo {
  margin-left: auto;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(180, 83, 9, 0.1);
  color: var(--ks-warning);
  font-size: 11px;
  font-weight: 600;
}
.settings__links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.settings__link {
  display: block;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--ks-text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.settings__link:hover {
  background: var(--ks-bg-muted);
}
.settings__link.router-link-active {
  background: var(--ks-grad-soft);
  color: var(--ks-primary-text);
  font-weight: 600;
}
.settings__logout {
  height: 40px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-error);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.settings__logout:hover {
  background: rgba(220, 38, 38, 0.06);
}
.settings__body {
  min-width: 0;
}
@media (max-width: 767px) {
  .settings {
    grid-template-columns: 1fr;
  }
}
</style>