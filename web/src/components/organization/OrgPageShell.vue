<script setup lang="ts">
/**
 * OrgPageShell (Sprint 13).
 *
 * The frame shared by all five organisation pages: back button, title, subtitle,
 * the page's own actions, the sample-data disclosure, the sub-navigation, and the
 * error block with its retry.
 *
 * It exists so the shell is written once. Five scoped copies of the same header
 * CSS would drift the first time someone adjusted a padding, and a shared global
 * stylesheet would leak into pages that never asked for it. A slotted component
 * gets the reuse while every page keeps its own scoped content styles.
 *
 * The sub-navigation is permission-aware: a viewer sees Overview and Switch but
 * not Members, Roles or Settings, so nobody is handed a link that the guard would
 * immediately bounce them off with a 403.
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18nStore } from '../../i18n';
import { usePageMeta } from '../../composables/usePageMeta';
import { useOrganizationStore } from '../../stores/organization';
import { ORG_NAV } from '../../lib/orgNav';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    metaTitle?: string;
    metaDescription?: string;
    active?: string;
    demo?: boolean;
    error?: string | null;
    loading?: boolean;
    backTo?: string;
  }>(),
  {
    subtitle: '',
    metaTitle: undefined,
    metaDescription: undefined,
    active: '',
    demo: false,
    error: null,
    loading: false,
    backTo: '/home'
  }
);

const emit = defineEmits<{
  (event: 'retry'): void;
  (event: 'hide-demo'): void;
}>();

const i18n = useI18nStore();
const router = useRouter();
const store = useOrganizationStore();

usePageMeta(
  props.metaTitle ?? i18n.t('org.metaTitle'),
  props.metaDescription ?? i18n.t('org.metaDescription')
);

/** Hiding a tab the guard would reject beats showing a link to a 403. */
const navItems = computed(() =>
  ORG_NAV.filter((item) => !item.permission || store.can(item.permission))
);

/** Dismissing the sample-data bar is page-local and never reaches storage. */
const demoHidden = ref(false);
const showDemoBar = computed(() => props.demo && !demoHidden.value);

function onHideDemo(): void {
  demoHidden.value = true;
  emit('hide-demo');
}

function go(path: string): void {
  void router.push(path);
}

defineExpose({ navItems, go });
</script>

<template>
  <section class="ops">
    <header class="ops__top">
      <button
        class="ops__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        data-testid="org-back"
        @click="go(backTo)"
      >&larr;</button>
      <div class="ops__heading">
        <h1 class="ops__title" data-testid="org-page-title">{{ title }}</h1>
        <p v-if="subtitle" class="ops__subtitle">{{ subtitle }}</p>
      </div>
      <div class="ops__actions">
        <slot name="actions" />
      </div>
    </header>

    <nav v-if="navItems.length > 1" class="ops__nav" :aria-label="i18n.t('org.title')">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="ops__nav-item"
        :class="{ 'is-active': active === item.key }"
        type="button"
        :aria-current="active === item.key ? 'page' : undefined"
        :data-nav="item.key"
        data-testid="org-nav"
        @click="go(item.path)"
      >{{ i18n.t(item.labelKey) }}</button>
    </nav>

    <div v-if="showDemoBar" class="ops__demo" data-testid="org-demo-bar" role="status">
      <span>{{ i18n.t('org.demoNotice') }}</span>
      <button
        type="button"
        :aria-label="i18n.t('org.demoHide')"
        data-testid="org-demo-hide"
        @click="onHideDemo"
      >&times;</button>
    </div>

    <div v-if="error" class="ops__error" data-testid="org-error" role="alert">
      <strong>{{ i18n.t('org.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="ops__btn" type="button" data-testid="org-retry" @click="emit('retry')">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <div class="ops__body" :aria-busy="loading ? 'true' : 'false'">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ops {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  box-sizing: border-box;
}
.ops__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.ops__home {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.ops__home:hover {
  background: var(--ks-bg-muted);
}
.ops__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ops__heading {
  flex: 1 1 320px;
  min-width: 0;
}
.ops__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ops__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.ops__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ops__nav {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
}
.ops__nav-item {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.ops__nav-item:hover {
  background: var(--ks-bg-muted);
}
.ops__nav-item.is-active {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.ops__nav-item:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ops__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid rgba(180, 83, 9, 0.24);
  border-radius: var(--ks-radius-btn);
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 13px;
  line-height: 19px;
}
.ops__demo button {
  flex: none;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.ops__demo button:hover {
  background: rgba(180, 83, 9, 0.14);
}
.ops__error {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid rgba(220, 38, 38, 0.26);
  border-radius: var(--ks-radius-btn);
  background: rgba(220, 38, 38, 0.06);
  color: var(--ks-error);
  font-size: 13px;
}
.ops__btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.ops__btn:hover {
  background: var(--ks-bg-muted);
}
.ops__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (max-width: 767px) {
  .ops {
    padding: 16px 14px 40px;
  }
  .ops__title {
    font-size: 20px;
    line-height: 28px;
  }
  .ops__actions {
    width: 100%;
  }
}
</style>
