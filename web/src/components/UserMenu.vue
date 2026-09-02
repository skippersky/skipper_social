<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import KsAvatar from './KsAvatar.vue';
import { useI18nStore } from '../i18n';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const i18n = useI18nStore();
const open = ref(false);

function toggle(): void {
  open.value = !open.value;
}

function go(path: string): void {
  open.value = false;
  void router.push(path);
}

async function onLogout(): Promise<void> {
  open.value = false;
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <div class="user-menu">
    <router-link v-if="!auth.isAuthenticated" class="user-menu__signin" to="/login">
      {{ i18n.t('auth.login') }}
    </router-link>
    <template v-else>
      <button
        class="user-menu__trigger"
        type="button"
        :aria-label="i18n.t('user.menu')"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="toggle"
      >
        <KsAvatar :name="auth.user?.nickname ?? '?'" :src="auth.user?.avatarUrl" :size="30" />
      </button>
      <div v-if="open" class="user-menu__panel" role="menu">
        <p class="user-menu__name">
          {{ auth.user?.nickname }}
          <span v-if="auth.demo" class="user-menu__demo">{{ i18n.t('auth.demoBadge') }}</span>
        </p>
        <button role="menuitem" type="button" @click="go('/settings/profile')">{{ i18n.t('nav.profile') }}</button>
        <button role="menuitem" type="button" @click="go('/settings/security')">{{ i18n.t('nav.security') }}</button>
        <button role="menuitem" type="button" class="user-menu__logout" @click="onLogout">{{ i18n.t('auth.logout') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
}
.user-menu__signin {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.user-menu__trigger {
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.user-menu__panel {
  position: absolute;
  right: 0;
  top: 42px;
  z-index: 120;
  min-width: 190px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-menu__name {
  margin: 0 0 6px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.user-menu__demo {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(180, 83, 9, 0.1);
  color: var(--ks-warning);
  font-size: 10px;
  font-weight: 700;
}
.user-menu__panel button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--ks-text-primary);
  cursor: pointer;
}
.user-menu__panel button:hover {
  background: var(--ks-bg-muted);
}
.user-menu__logout {
  color: var(--ks-error);
}
</style>