<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { showToast } from 'vant';
import { DEMO_TIMEZONES } from '../../../api/settings';
import { useI18nStore } from '../../../i18n';
import { UI_LOCALES } from '../../../i18n/messages';
import type { UiLocale } from '../../../i18n';
import { THEME_MODES, isThemeAvailable } from '../../../lib/theme';
import { useNotificationStore } from '../../../stores/notification';
import { useSettingsStore } from '../../../stores/settings';
import type { SystemPreferences, ThemeMode } from '../../../types';

const i18n = useI18nStore();
const store = useSettingsStore();
const notifications = useNotificationStore();

const draft = ref<SystemPreferences>({ ...store.systemPreferences });

watch(
  () => store.systemPreferences,
  (value) => {
    draft.value = { ...value };
  },
  { deep: true }
);

const saving = computed(() => store.saving);
const dirty = computed(
  () => JSON.stringify(draft.value) !== JSON.stringify(store.systemPreferences)
);
const timezones = computed(() =>
  draft.value.timezone && !DEMO_TIMEZONES.includes(draft.value.timezone)
    ? [draft.value.timezone, ...DEMO_TIMEZONES]
    : DEMO_TIMEZONES
);

function isLocale(value: string): value is UiLocale {
  return (UI_LOCALES as string[]).includes(value);
}

function pickTheme(mode: ThemeMode): void {
  if (!isThemeAvailable(mode)) return;
  draft.value = { ...draft.value, theme: mode };
}

async function load(): Promise<void> {
  await store.fetchSystemPreferences();
  draft.value = { ...store.systemPreferences };
}

/**
 * Language and the alert switches are mirrored into the stores that actually
 * own them, so the header switcher and the notification inbox stay in step.
 */
async function onSave(): Promise<void> {
  const ok = await store.updateSystemPreferences({ ...draft.value });
  if (!ok) {
    showToast(i18n.t('settings.saveFailed'));
    return;
  }
  draft.value = { ...store.systemPreferences };
  if (isLocale(draft.value.language) && i18n.locale !== draft.value.language) {
    i18n.setLocale(draft.value.language);
  }
  await notifications.updatePreferences({
    sound: draft.value.soundEnabled,
    browserPush: draft.value.desktopNotifications
  });
  showToast(i18n.t('settings.prefsSaved'));
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="tab">
    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.prefsRegional') }}</h2>
      <div class="field">
        <label for="pref-language">{{ i18n.t('settings.prefsLanguage') }}</label>
        <select id="pref-language" v-model="draft.language">
          <option v-for="lang in UI_LOCALES" :key="lang" :value="lang">
            {{ i18n.t('settings.lang.' + lang) }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="pref-timezone">{{ i18n.t('settings.prefsTimezone') }}</label>
        <select id="pref-timezone" v-model="draft.timezone">
          <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
        </select>
      </div>
    </section>

    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.prefsTheme') }}</h2>
      <div class="themes" role="radiogroup" :aria-label="i18n.t('settings.prefsTheme')">
        <button
          v-for="mode in THEME_MODES"
          :key="'theme-' + mode"
          class="theme"
          :class="{ 'is-active': draft.theme === mode }"
          type="button"
          role="radio"
          :aria-checked="draft.theme === mode"
          :disabled="!isThemeAvailable(mode)"
          @click="pickTheme(mode)"
        >
          <span class="theme__name">{{ i18n.t('settings.theme.' + mode) }}</span>
          <span v-if="!isThemeAvailable(mode)" class="theme__soon">
            {{ i18n.t('settings.themeDarkUnavailable') }}
          </span>
        </button>
      </div>
      <p class="tab__hint">{{ i18n.t('settings.prefsThemeHint') }}</p>
    </section>

    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.prefsAlerts') }}</h2>
      <div class="row">
        <div class="row__copy">
          <p class="row__label">{{ i18n.t('settings.prefsSound') }}</p>
          <p class="row__hint">{{ i18n.t('settings.prefsSoundHint') }}</p>
        </div>
        <van-switch v-model="draft.soundEnabled" size="22" />
      </div>
      <div class="row">
        <div class="row__copy">
          <p class="row__label">{{ i18n.t('settings.prefsDesktop') }}</p>
          <p class="row__hint">{{ i18n.t('settings.prefsDesktopHint') }}</p>
        </div>
        <van-switch v-model="draft.desktopNotifications" size="22" />
      </div>
      <router-link class="tab__link" to="/dashboard/notifications/preferences">
        {{ i18n.t('settings.prefsAlertLink') }}
      </router-link>
    </section>

    <div class="tab__actions">
      <button
        class="tab__btn tab__btn--primary"
        type="button"
        :disabled="saving || !dirty"
        @click="onSave"
      >{{ saving ? i18n.t('common.loading') : i18n.t('settings.save') }}</button>
    </div>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tab__card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
}
.tab__card-title {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tab__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.tab__link {
  display: inline-block;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-primary-text);
  text-decoration: none;
}
.tab__link:hover {
  text-decoration: underline;
}
.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.field:last-child {
  margin-bottom: 0;
}
.field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.field select {
  height: 42px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.field select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.theme {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.theme:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.theme.is-active {
  border-color: var(--ks-primary);
  background: rgba(244, 99, 58, 0.08);
}
.theme:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.theme__name {
  font-size: 13px;
  font-weight: 700;
}
.theme__soon {
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--ks-border-default);
}
.row:first-of-type {
  border-top: none;
}
.row__copy {
  flex: 1;
  min-width: 0;
}
.row__label {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.row__hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.tab__actions {
  display: flex;
  justify-content: flex-end;
}
.tab__btn {
  height: 40px;
  padding: 0 20px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tab__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tab__btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
.tab__btn--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 767px) {
  .themes {
    grid-template-columns: minmax(0, 1fr);
  }
  .tab__actions .tab__btn {
    width: 100%;
  }
}
</style>
