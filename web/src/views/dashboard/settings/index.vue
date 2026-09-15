<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useSettings } from '../../../composables/useSettings';
import { useI18nStore } from '../../../i18n';

/** One shell, four tabs: data is fetched once so switching never re-hits the api. */
const TABS = [
  { key: 'profile', path: '/dashboard/settings' },
  { key: 'security', path: '/dashboard/settings/security' },
  { key: 'preferences', path: '/dashboard/settings/preferences' },
  { key: 'channels', path: '/dashboard/settings/channels' }
];

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();
const { loading, error, loadSettings, retry } = useSettings();

usePageMeta(i18n.t('settings.metaTitle'), i18n.t('settings.metaDescription'));

function isActive(path: string): boolean {
  return path === '/dashboard/settings'
    ? route.path === path
    : route.path.startsWith(path);
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <section class="hub">
    <header class="hub__top">
      <button
        class="hub__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <div class="hub__heading">
        <h1 class="hub__title">{{ i18n.t('settings.title') }}</h1>
        <p class="hub__subtitle">{{ i18n.t('settings.subtitle') }}</p>
      </div>
    </header>

    <div class="hub__body" :data-loading="loading">
      <nav class="hub__rail" :aria-label="i18n.t('settings.title')">
        <router-link
          v-for="tab in TABS"
          :key="tab.key"
          class="hub__tab"
          :class="{ 'is-active': isActive(tab.path) }"
          :to="tab.path"
        >{{ i18n.t('settings.tab.' + tab.key) }}</router-link>
      </nav>

      <div class="hub__content">
        <p v-if="error" class="hub__error">
          <span>{{ i18n.t(error) }}</span>
          <button class="hub__retry" type="button" @click="retry()">
            {{ i18n.t('common.retry') }}
          </button>
        </p>
        <router-view />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hub {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 40px;
  box-sizing: border-box;
  background: var(--ks-bg-base);
}
.hub__top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}
.hub__home {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.hub__home:hover {
  background: var(--ks-bg-muted);
}
.hub__heading {
  min-width: 0;
}
.hub__title {
  margin: 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.hub__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.hub__body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.hub__body[data-loading='true'] {
  opacity: 0.75;
}
.hub__rail {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.hub__tab {
  display: block;
  padding: 10px 12px;
  border-radius: var(--ks-radius-btn);
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  text-decoration: none;
}
.hub__tab:hover {
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
}
.hub__tab.is-active {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.hub__content {
  min-width: 0;
}
.hub__error {
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
  color: var(--ks-error);
  font-size: 13px;
}
.hub__retry {
  margin-left: auto;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
@media (max-width: 1023px) {
  .hub__body {
    grid-template-columns: minmax(0, 1fr);
  }
  .hub__rail {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
  .hub__tab {
    white-space: nowrap;
  }
}
@media (max-width: 767px) {
  .hub {
    padding: 14px 14px 32px;
  }
}
</style>
