<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import LanguageSwitcher from './components/LanguageSwitcher.vue';
import UserMenu from './components/UserMenu.vue';
import { useI18nStore } from './i18n';

const route = useRoute();
const i18n = useI18nStore();
const showTabbar = computed(() => ['/editor', '/drafts'].includes(route.path));
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--has-tabbar': showTabbar }">
    <header class="app-header">
      <div class="app-header__brandline" aria-hidden="true"></div>
      <div class="app-header__inner">
        <router-link to="/" class="app-header__brand">
          <span class="app-header__logo" aria-hidden="true">K</span>
          <span class="app-header__name">KiliSocial</span>
        </router-link>
        <div class="app-header__actions">
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
    <router-view />
    <van-tabbar v-if="showTabbar" route>
      <van-tabbar-item to="/editor" icon="edit">{{ i18n.t('nav.editor') }}</van-tabbar-item>
      <van-tabbar-item to="/drafts" icon="notes">{{ i18n.t('nav.drafts') }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.app-shell--has-tabbar {
  padding-bottom: 60px;
}
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ks-border-default);
}
.app-header__brandline {
  height: 3px;
  background: linear-gradient(90deg, #FFB238 0%, #F4633A 55%, #5B5BD6 100%);
}
.app-header__inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.app-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.app-header__logo {
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
.app-header__name {
  font-family: Sora, "PingFang SC", sans-serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--ks-text-primary);
}
@media (min-width: 1024px) {
  .app-shell--has-tabbar {
    padding-bottom: 0;
  }
  .app-shell--has-tabbar .van-tabbar {
    display: none;
  }
}
</style>