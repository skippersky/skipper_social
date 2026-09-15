import { computed } from 'vue';
import { useSettingsStore } from '../stores/settings';
import type { SystemPreferences } from '../types';

/**
 * Hub-level facade: one call loads every tab, one call saves the preference
 * block. Tab composables own their own slice; this one owns the shell.
 */
export function useSettings() {
  const store = useSettingsStore();

  const settings = computed(() => ({
    profile: store.profile,
    security: store.securitySettings,
    preferences: store.systemPreferences,
    channels: store.channelAccounts
  }));

  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const loaded = computed(() => store.profile !== null);

  /** Skips the round trip when the hub already holds data, unless forced. */
  async function loadSettings(force = false): Promise<void> {
    if (!force && loaded.value) return;
    await store.loadAll();
  }

  async function saveSettings(patch: Partial<SystemPreferences>): Promise<boolean> {
    return store.updateSystemPreferences(patch);
  }

  async function retry(): Promise<void> {
    await store.loadAll();
  }

  return {
    store,
    settings,
    profile: computed(() => store.profile),
    securitySettings: computed(() => store.securitySettings),
    systemPreferences: computed(() => store.systemPreferences),
    channelAccounts: computed(() => store.channelAccounts),
    loading,
    saving,
    error,
    loaded,
    loadSettings,
    saveSettings,
    retry
  };
}
