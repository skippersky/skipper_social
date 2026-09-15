import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { DEFAULT_SYSTEM_PREFERENCES } from '../api/demo';
import { apiErrorI18nKey } from '../api/http';
import * as settingsApi from '../api/settings';
import { applyTheme } from '../lib/theme';
import { isProfileValid } from '../lib/settingsValidation';
import type {
  BindChannelRequest,
  ChannelAccount,
  ChannelTestResult,
  LoginDevice,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  SecuritySettings,
  SecurityUpdateRequest,
  SettingsProfile,
  SystemPreferences,
  UploadResult
} from '../types';

/**
 * Single source of truth for the settings hub. Composables and views only talk
 * to this store; the api layer stays behind it so swapping in a real backend
 * needs no UI change. Errors are stored as i18n keys, never as raw messages.
 */
export const useSettingsStore = defineStore('settings', () => {
  const profile = ref<SettingsProfile | null>(null);
  const securitySettings = ref<SecuritySettings | null>(null);
  const systemPreferences = ref<SystemPreferences>({ ...DEFAULT_SYSTEM_PREFERENCES });
  const channelAccounts = ref<ChannelAccount[]>([]);
  /** Last probe result per channel id, kept out of the channel rows. */
  const channelTests = ref<Record<string, ChannelTestResult>>({});
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const isProfileComplete = computed(
    () => profile.value !== null && isProfileValid(profile.value)
  );
  const hasBoundChannels = computed(() => channelAccounts.value.length > 0);
  const enabledChannels = computed(() =>
    channelAccounts.value.filter((channel) => channel.status === 'connected')
  );
  const loginDevices = computed<LoginDevice[]>(() => securitySettings.value?.devices ?? []);

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function resetError(): void {
    error.value = null;
  }

  async function fetchProfile(): Promise<SettingsProfile | null> {
    loading.value = true;
    resetError();
    try {
      profile.value = await settingsApi.getProfile();
      return profile.value;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(data: ProfileUpdateRequest): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      profile.value = await settingsApi.updateProfile(data);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function uploadAvatar(file: File): Promise<UploadResult | null> {
    saving.value = true;
    resetError();
    try {
      const result = await settingsApi.uploadAvatar(file);
      if (profile.value) profile.value = { ...profile.value, avatarUrl: result.url };
      return result;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function fetchSecuritySettings(): Promise<SecuritySettings | null> {
    loading.value = true;
    resetError();
    try {
      securitySettings.value = await settingsApi.getSecuritySettings();
      return securitySettings.value;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateSecuritySettings(data: SecurityUpdateRequest): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      securitySettings.value = await settingsApi.updateSecuritySettings(data);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function changePassword(data: PasswordChangeRequest): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      await settingsApi.changePassword(data);
      securitySettings.value = await settingsApi.getSecuritySettings();
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function revokeDevice(deviceId: string): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      const devices = await settingsApi.revokeLoginDevice(deviceId);
      if (securitySettings.value) {
        securitySettings.value = { ...securitySettings.value, devices };
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function fetchSystemPreferences(): Promise<SystemPreferences> {
    loading.value = true;
    resetError();
    try {
      systemPreferences.value = await settingsApi.getSystemPreferences();
      applyTheme(systemPreferences.value.theme);
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
    return systemPreferences.value;
  }

  /** Persists preferences and paints the chosen theme straight away. */
  async function updateSystemPreferences(patch: Partial<SystemPreferences>): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      systemPreferences.value = await settingsApi.updateSystemPreferences(patch);
      applyTheme(systemPreferences.value.theme);
      if (profile.value) {
        profile.value = {
          ...profile.value,
          language: systemPreferences.value.language,
          timezone: systemPreferences.value.timezone
        };
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function fetchChannelAccounts(): Promise<ChannelAccount[]> {
    loading.value = true;
    resetError();
    try {
      channelAccounts.value = await settingsApi.getChannelAccounts();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
    return channelAccounts.value;
  }

  function getChannelAccount(channelId: string): ChannelAccount | null {
    return channelAccounts.value.find((channel) => channel.id === channelId) ?? null;
  }

  async function bindChannel(data: BindChannelRequest): Promise<ChannelAccount | null> {
    saving.value = true;
    resetError();
    try {
      const bound = await settingsApi.bindChannelAccount(data);
      channelAccounts.value = [
        ...channelAccounts.value.filter((channel) => channel.platform !== bound.platform),
        bound
      ];
      return bound;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function unbindChannel(channelId: string): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      await settingsApi.unbindChannelAccount(channelId);
      channelAccounts.value = channelAccounts.value.filter((channel) => channel.id !== channelId);
      const tests = { ...channelTests.value };
      delete tests[channelId];
      channelTests.value = tests;
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function testChannelConnection(channelId: string): Promise<ChannelTestResult | null> {
    resetError();
    try {
      const result = await settingsApi.testChannelConnection(channelId);
      channelTests.value = { ...channelTests.value, [channelId]: result };
      return result;
    } catch (err) {
      fail(err);
      return null;
    }
  }

  /** Loads every tab's data once so switching tabs never re-fetches. */
  async function loadAll(): Promise<void> {
    loading.value = true;
    resetError();
    const results = await Promise.allSettled([
      settingsApi.getProfile(),
      settingsApi.getSecuritySettings(),
      settingsApi.getSystemPreferences(),
      settingsApi.getChannelAccounts()
    ]);
    if (results[0].status === 'fulfilled') profile.value = results[0].value;
    else fail(results[0].reason);
    if (results[1].status === 'fulfilled') securitySettings.value = results[1].value;
    else fail(results[1].reason);
    if (results[2].status === 'fulfilled') {
      systemPreferences.value = results[2].value;
      applyTheme(systemPreferences.value.theme);
    } else {
      fail(results[2].reason);
    }
    if (results[3].status === 'fulfilled') channelAccounts.value = results[3].value;
    else fail(results[3].reason);
    loading.value = false;
  }

  return {
    profile,
    securitySettings,
    systemPreferences,
    channelAccounts,
    channelTests,
    loading,
    saving,
    error,
    isProfileComplete,
    hasBoundChannels,
    enabledChannels,
    loginDevices,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    fetchSecuritySettings,
    updateSecuritySettings,
    changePassword,
    revokeDevice,
    fetchSystemPreferences,
    updateSystemPreferences,
    fetchChannelAccounts,
    getChannelAccount,
    bindChannel,
    unbindChannel,
    testChannelConnection,
    loadAll
  };
});
