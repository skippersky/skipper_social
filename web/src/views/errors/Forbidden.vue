<script setup lang="ts">
/**
 * 403 (Sprint 13).
 *
 * Where the permission guard sends a signed-in user whose role does not cover the
 * route. It names the right that was missing, because "access denied" on its own
 * leaves the user with nothing to ask their administrator for, and it offers the two
 * remedies that actually exist: go back, or switch to a tenant where they do hold it.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('org.forbidden.metaTitle'), i18n.t('org.forbidden.body'));

/** The guard joins the missing keys with commas; split them back out for display. */
const needed = computed<string[]>(() => {
  const raw = route.query.needed;
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  if (typeof value !== 'string' || value === '') return [];
  return value.split(',').filter((entry) => entry !== '');
});

const from = computed(() => {
  const raw = route.query.from;
  return typeof raw === 'string' && raw !== '' ? raw : '';
});

function goBack(): void {
  if (from.value) void router.push(from.value);
  else void router.push('/home');
}

function goHome(): void {
  void router.push('/home');
}

function goSwitch(): void {
  void router.push('/dashboard/organization/switch');
}

defineExpose({ needed, from, goBack, goHome, goSwitch });
</script>

<template>
  <div class="fb">
    <main class="fb__card" data-testid="forbidden-card">
      <span class="fb__mark" aria-hidden="true">403</span>
      <h1 class="fb__title">{{ i18n.t('org.forbidden.title') }}</h1>
      <p class="fb__body">{{ i18n.t('org.forbidden.body') }}</p>
      <p v-if="needed.length > 0" class="fb__needed-label" data-testid="forbidden-needed-label">
        {{ i18n.t('org.forbidden.needed', { permission: needed.join(', ') }) }}
      </p>
      <ul v-if="needed.length > 0" class="fb__needed" data-testid="forbidden-needed">
        <li v-for="key in needed" :key="key"><code>{{ key }}</code></li>
      </ul>
      <div class="fb__actions">
        <button class="fb__btn fb__btn--primary" type="button" data-testid="forbidden-back" @click="goBack">
          {{ i18n.t('org.forbidden.back') }}
        </button>
        <button class="fb__btn" type="button" data-testid="forbidden-home" @click="goHome">
          {{ i18n.t('org.forbidden.goHome') }}
        </button>
        <button class="fb__btn" type="button" data-testid="forbidden-switch" @click="goSwitch">
          {{ i18n.t('org.forbidden.switchOrg') }}
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fb {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  background: var(--ks-bg-page);
}
.fb__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 460px;
  padding: 32px 28px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  text-align: center;
}
.fb__mark {
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.fb__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.fb__body {
  margin: 0;
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.fb__needed-label {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.fb__needed {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.fb__needed code {
  padding: 3px 9px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  font-size: 12px;
  color: var(--ks-primary-text);
}
.fb__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  width: 100%;
}
.fb__btn {
  flex: 1 1 130px;
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.fb__btn:hover {
  background: var(--ks-bg-muted);
}
.fb__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.fb__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
@media (max-width: 767px) {
  .fb__actions {
    flex-direction: column;
  }
}
</style>
