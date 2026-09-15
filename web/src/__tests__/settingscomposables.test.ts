/**
 * Composable tests for the Sprint 10 settings hub.
 *
 * The pinia store stays real so every composable runs against the same state
 * machine the views use. Only the api layer and the auth store are mocked,
 * because both would otherwise reach the network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as settingsApi from '../api/settings';
import { ApiError } from '../api/http';
import { useSettingsStore } from '../stores/settings';
import { useSettings } from '../composables/useSettings';
import {
  PROFILE_DRAFT_KEY,
  clearProfileDraft,
  readProfileDraft,
  useProfile,
  writeProfileDraft
} from '../composables/useProfile';
import { TWO_FACTOR_SEED_FALLBACK, useSecurity } from '../composables/useSecurity';
import { useChannelBinding } from '../composables/useChannelBinding';
import { QR_PLACEHOLDER_SIZE, buildQrMatrix } from '../lib/qrPlaceholder';
import type {
  ChannelAccount,
  LoginDevice,
  SecuritySettings,
  SettingsProfile,
  SystemPreferences
} from '../types';

const refreshUser = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ refreshUser })
}));

vi.mock('../api/settings', () => ({
  DEMO_TIMEZONES: ['Africa/Dar_es_Salaam', 'Africa/Nairobi', 'UTC'],
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  changePassword: vi.fn(),
  getSecuritySettings: vi.fn(),
  updateSecuritySettings: vi.fn(),
  revokeLoginDevice: vi.fn(),
  getSystemPreferences: vi.fn(),
  updateSystemPreferences: vi.fn(),
  getChannelAccounts: vi.fn(),
  bindChannelAccount: vi.fn(),
  unbindChannelAccount: vi.fn(),
  testChannelConnection: vi.fn()
}));

const getProfile = vi.mocked(settingsApi.getProfile);
const updateProfile = vi.mocked(settingsApi.updateProfile);
const uploadAvatar = vi.mocked(settingsApi.uploadAvatar);
const changePassword = vi.mocked(settingsApi.changePassword);
const getSecuritySettings = vi.mocked(settingsApi.getSecuritySettings);
const updateSecuritySettings = vi.mocked(settingsApi.updateSecuritySettings);
const revokeLoginDevice = vi.mocked(settingsApi.revokeLoginDevice);
const getSystemPreferences = vi.mocked(settingsApi.getSystemPreferences);
const updateSystemPreferences = vi.mocked(settingsApi.updateSystemPreferences);
const getChannelAccounts = vi.mocked(settingsApi.getChannelAccounts);
const bindChannelAccount = vi.mocked(settingsApi.bindChannelAccount);
const unbindChannelAccount = vi.mocked(settingsApi.unbindChannelAccount);
const testChannelConnection = vi.mocked(settingsApi.testChannelConnection);

const PROFILE: SettingsProfile = {
  name: 'Amani Juma',
  email: 'amani@kilisocial.app',
  phone: '+255 712 345 678',
  bio: 'Social seller in Dar es Salaam.',
  avatarUrl: 'https://cdn.kilisocial.app/amani.png',
  company: 'Kili Textiles',
  timezone: 'Africa/Dar_es_Salaam',
  language: 'en'
};

const PREFERENCES: SystemPreferences = {
  language: 'en',
  timezone: 'Africa/Dar_es_Salaam',
  theme: 'light',
  soundEnabled: true,
  desktopNotifications: false
};

const CURRENT_DEVICE: LoginDevice = {
  id: 'dev-current',
  name: 'Chrome on Windows',
  location: 'Dar es Salaam, TZ',
  lastActiveAt: 1700000000000,
  current: true
};

const OTHER_DEVICE: LoginDevice = {
  id: 'dev-other',
  name: 'Safari on iPhone',
  location: 'Nairobi, KE',
  lastActiveAt: 1699990000000,
  current: false
};

function security(overrides: Partial<SecuritySettings> = {}): SecuritySettings {
  return {
    twoFactorEnabled: false,
    lastPasswordChangedAt: 1699000000000,
    devices: [{ ...CURRENT_DEVICE }, { ...OTHER_DEVICE }],
    ...overrides
  };
}

const WHATSAPP: ChannelAccount = {
  id: 'chn-whatsapp',
  platform: 'whatsapp',
  accountName: '123456789012345',
  status: 'connected',
  connectedAt: 1699500000000,
  tokenExpiresAt: 1702000000000
};

const FACEBOOK: ChannelAccount = {
  id: 'chn-facebook',
  platform: 'facebook',
  accountName: 'Kili Textiles',
  status: 'needs_reauth',
  connectedAt: 1699400000000,
  tokenExpiresAt: 1701900000000
};

const WHATSAPP_CREDENTIALS = {
  phone_number_id: '123456789012345',
  access_token: 'EAAG-secret-token',
  verify_token: 'kili-verify-token'
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setActivePinia(createPinia());
  document.documentElement.removeAttribute('data-theme');
  getProfile.mockResolvedValue({ ...PROFILE });
  updateProfile.mockImplementation(async (patch) => ({ ...PROFILE, ...patch }));
  uploadAvatar.mockResolvedValue({ url: 'https://cdn.kilisocial.app/new.png' });
  changePassword.mockResolvedValue(undefined);
  getSecuritySettings.mockImplementation(async () => security());
  updateSecuritySettings.mockImplementation(async (patch) =>
    security({ twoFactorEnabled: patch.twoFactorEnabled })
  );
  revokeLoginDevice.mockResolvedValue([{ ...CURRENT_DEVICE }]);
  getSystemPreferences.mockResolvedValue({ ...PREFERENCES });
  updateSystemPreferences.mockImplementation(async (patch) => ({
    ...PREFERENCES,
    ...patch
  }));
  getChannelAccounts.mockResolvedValue([{ ...WHATSAPP }, { ...FACEBOOK }]);
  bindChannelAccount.mockImplementation(async (request) => ({
    id: 'chn-' + request.platform,
    platform: request.platform,
    accountName: Object.values(request.credentials)[0] ?? 'bound',
    status: 'connected',
    connectedAt: 1700100000000,
    tokenExpiresAt: 1702600000000
  }));
  unbindChannelAccount.mockResolvedValue(undefined);
  testChannelConnection.mockResolvedValue({
    channelId: 'chn-whatsapp',
    ok: true,
    latencyMs: 140,
    checkedAt: 1700200000000
  });
  refreshUser.mockResolvedValue(undefined);
});

describe('useSettings', () => {
  it('loads every tab once and skips the cached second call', async () => {
    const { loadSettings, loaded, settings } = useSettings();
    expect(loaded.value).toBe(false);

    await loadSettings();
    await loadSettings();

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(getChannelAccounts).toHaveBeenCalledTimes(1);
    expect(loaded.value).toBe(true);
    expect(settings.value.profile).toEqual(PROFILE);
    expect(settings.value.security).toEqual(security());
    expect(settings.value.preferences).toEqual(PREFERENCES);
    expect(settings.value.channels.map((row) => row.id)).toEqual(['chn-whatsapp', 'chn-facebook']);
  });

  it('reloads on force and on retry', async () => {
    const { loadSettings, retry } = useSettings();
    await loadSettings();
    await loadSettings(true);
    expect(getProfile).toHaveBeenCalledTimes(2);

    await retry();
    expect(getProfile).toHaveBeenCalledTimes(3);
  });

  it('keeps the tabs that answered when one request fails', async () => {
    getProfile.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const { loadSettings, error, profile, channelAccounts, loading } = useSettings();

    await loadSettings();

    expect(profile.value).toBeNull();
    expect(error.value).toBe('api.500');
    expect(channelAccounts.value).toHaveLength(2);
    expect(loading.value).toBe(false);
  });

  it('paints the theme when preferences are saved', async () => {
    updateSystemPreferences.mockResolvedValue({ ...PREFERENCES, theme: 'dark' });
    const { saveSettings, systemPreferences, saving, error } = useSettings();

    const ok = await saveSettings({ theme: 'dark' });

    expect(ok).toBe(true);
    expect(updateSystemPreferences).toHaveBeenCalledWith({ theme: 'dark' });
    expect(systemPreferences.value.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(saving.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('reports a save failure as an i18n key', async () => {
    updateSystemPreferences.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));
    const { saveSettings, error, saving } = useSettings();

    await expect(saveSettings({ language: 'fr' })).resolves.toBe(false);

    expect(error.value).toBe('api.timeout');
    expect(saving.value).toBe(false);
  });

  it('exposes the store so views can reach the derived flags', async () => {
    const { store, loadSettings } = useSettings();
    await loadSettings();
    expect(store).toBe(useSettingsStore());
    expect(store.isProfileComplete).toBe(true);
    expect(store.hasBoundChannels).toBe(true);
    expect(store.enabledChannels.map((row) => row.id)).toEqual(['chn-whatsapp']);
  });
});

describe('useProfile', () => {
  it('applies the fetched profile to form and baseline', async () => {
    const profile = useProfile();

    await profile.loadProfile();

    expect(profile.form.value).toEqual(PROFILE);
    expect(profile.baseline.value).toEqual(PROFILE);
    expect(profile.dirty.value).toBe(false);
    expect(profile.valid.value).toBe(true);
    expect(profile.complete.value).toBe(true);
    expect(profile.canSave.value).toBe(false);
    expect(profile.restoredDraft.value).toBe(false);
  });

  it('returns null and stores an i18n error when the fetch fails', async () => {
    getProfile.mockRejectedValue(new ApiError('HTTP_401', 'expired'));
    const profile = useProfile();

    await expect(profile.loadProfile()).resolves.toBeNull();

    expect(profile.error.value).toBe('api.401');
    expect(profile.form.value.name).toBe('');
  });

  it('marks the form dirty and caches a draft on every keystroke', async () => {
    const profile = useProfile();
    await profile.loadProfile();

    profile.patchForm({ company: 'Kili Textiles Ltd' });

    expect(profile.dirty.value).toBe(true);
    expect(profile.canSave.value).toBe(true);
    expect(readProfileDraft()?.company).toBe('Kili Textiles Ltd');
  });

  it('blocks saving while a rule fails', async () => {
    const profile = useProfile();
    await profile.loadProfile();

    profile.patchForm({ name: 'A' });

    expect(profile.errors.value.name).toBe('settings.error.nameLength');
    expect(profile.valid.value).toBe(false);
    expect(profile.complete.value).toBe(false);
    expect(profile.canSave.value).toBe(false);
    await expect(profile.updateProfile()).resolves.toBe(false);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('trims the patch, clears the draft and refreshes the session user', async () => {
    const profile = useProfile();
    await profile.loadProfile();
    profile.patchForm({ name: '  Amani Updated  ', phone: ' +255712345678 ' });

    await expect(profile.updateProfile()).resolves.toBe(true);

    expect(updateProfile).toHaveBeenCalledWith({
      name: 'Amani Updated',
      phone: '+255712345678',
      bio: 'Social seller in Dar es Salaam.',
      avatarUrl: 'https://cdn.kilisocial.app/amani.png',
      company: 'Kili Textiles',
      timezone: 'Africa/Dar_es_Salaam',
      language: 'en'
    });
    expect(localStorage.getItem(PROFILE_DRAFT_KEY)).toBeNull();
    expect(profile.restoredDraft.value).toBe(false);
    expect(profile.form.value.name).toBe('Amani Updated');
    expect(profile.dirty.value).toBe(false);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft when the save fails', async () => {
    updateProfile.mockRejectedValue(new ApiError('HTTP_403', 'forbidden'));
    const profile = useProfile();
    await profile.loadProfile();
    profile.patchForm({ bio: 'Hand woven kitenge' });

    await expect(profile.updateProfile()).resolves.toBe(false);

    expect(profile.error.value).toBe('api.403');
    expect(readProfileDraft()?.bio).toBe('Hand woven kitenge');
    expect(profile.dirty.value).toBe(true);
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('restores an unsaved draft over the fetched profile', async () => {
    writeProfileDraft({ company: 'Draft Company' });
    const profile = useProfile();

    await profile.loadProfile();

    expect(profile.restoredDraft.value).toBe(true);
    expect(profile.form.value.company).toBe('Draft Company');
    expect(profile.baseline.value.company).toBe('Kili Textiles');
    expect(profile.dirty.value).toBe(true);
  });

  it('discardDraft clears storage and resetForm only rewinds the form', async () => {
    const profile = useProfile();
    await profile.loadProfile();
    profile.patchForm({ company: 'Temp' });

    profile.resetForm();
    expect(profile.form.value.company).toBe('Kili Textiles');
    expect(readProfileDraft()?.company).toBe('Temp');

    profile.patchForm({ company: 'Temp' });
    profile.discardDraft();
    expect(profile.form.value.company).toBe('Kili Textiles');
    expect(readProfileDraft()).toBeNull();
    expect(profile.restoredDraft.value).toBe(false);
  });

  it('writes an uploaded avatar into form, baseline and draft', async () => {
    const profile = useProfile();
    await profile.loadProfile();
    const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });

    await expect(profile.uploadAvatar(file)).resolves.toBe(true);

    expect(profile.avatarUrl.value).toBe('https://cdn.kilisocial.app/new.png');
    expect(profile.baseline.value.avatarUrl).toBe('https://cdn.kilisocial.app/new.png');
    expect(readProfileDraft()?.avatarUrl).toBe('https://cdn.kilisocial.app/new.png');
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('leaves the form untouched when the upload fails', async () => {
    uploadAvatar.mockRejectedValue(new ApiError('HTTP_500', 'too large'));
    const profile = useProfile();
    await profile.loadProfile();
    const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });

    await expect(profile.uploadAvatar(file)).resolves.toBe(false);

    expect(profile.avatarUrl.value).toBe('https://cdn.kilisocial.app/amani.png');
    expect(profile.error.value).toBe('api.500');
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('draft helpers survive corrupt json and blocked storage', () => {
    localStorage.setItem(PROFILE_DRAFT_KEY, '{oops');
    expect(readProfileDraft()).toBeNull();

    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => writeProfileDraft({ name: 'X' })).not.toThrow();
    localStorage.setItem = original;

    const originalRemove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = () => { throw new Error('blocked'); };
    expect(() => clearProfileDraft()).not.toThrow();
    localStorage.removeItem = originalRemove;
  });
});

describe('useSecurity', () => {
  it('loads the session list and the password timestamp', async () => {
    const sec = useSecurity();
    expect(sec.devices.value).toEqual([]);
    expect(sec.lastPasswordChangedAt.value).toBeNull();

    await sec.loadSecuritySettings();

    expect(sec.devices.value.map((row) => row.id)).toEqual(['dev-current', 'dev-other']);
    expect(sec.lastPasswordChangedAt.value).toBe(1699000000000);
    expect(sec.twoFactorEnabled.value).toBe(false);
  });

  it('refuses a two-factor code that is not six digits', async () => {
    const sec = useSecurity();

    await expect(sec.enableTwoFactor('12')).resolves.toBe(false);

    expect(sec.codeError.value).toBe('settings.error.tfaCodeInvalid');
    expect(sec.twoFactorCode.value).toBe('12');
    expect(updateSecuritySettings).not.toHaveBeenCalled();
  });

  it('enables two-factor and clears the code on success', async () => {
    const sec = useSecurity();
    sec.codeError.value = 'settings.error.tfaCodeInvalid';

    await expect(sec.enableTwoFactor(' 123456 ')).resolves.toBe(true);

    expect(updateSecuritySettings).toHaveBeenCalledWith({
      twoFactorEnabled: true,
      twoFactorCode: '123456'
    });
    expect(sec.twoFactorCode.value).toBe('');
    expect(sec.codeError.value).toBeNull();
    expect(sec.twoFactorEnabled.value).toBe(true);
  });

  it('keeps the typed code when enabling fails', async () => {
    updateSecuritySettings.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const sec = useSecurity();

    await expect(sec.enableTwoFactor('123456')).resolves.toBe(false);

    expect(sec.twoFactorCode.value).toBe('123456');
    expect(sec.error.value).toBe('api.500');
    expect(sec.twoFactorEnabled.value).toBe(false);
  });

  it('routes the switch through enable and disable', async () => {
    const sec = useSecurity();

    await expect(sec.updateSecuritySettings(true, '654321')).resolves.toBe(true);
    expect(updateSecuritySettings).toHaveBeenLastCalledWith({
      twoFactorEnabled: true,
      twoFactorCode: '654321'
    });

    await expect(sec.updateSecuritySettings(false)).resolves.toBe(true);
    expect(updateSecuritySettings).toHaveBeenLastCalledWith({ twoFactorEnabled: false });
    expect(sec.twoFactorCode.value).toBe('');
    expect(sec.codeError.value).toBeNull();
  });

  it('flags a pending QR tile and falls back to the placeholder seed', async () => {
    getSecuritySettings.mockImplementation(async () => security({ twoFactorEnabled: true }));
    const sec = useSecurity();
    await sec.loadSecuritySettings();

    expect(sec.qrPending.value).toBe(true);
    expect(sec.qrMatrix.value).toEqual(
      buildQrMatrix(TWO_FACTOR_SEED_FALLBACK, QR_PLACEHOLDER_SIZE)
    );
    expect(sec.qrMatrix.value).toHaveLength(QR_PLACEHOLDER_SIZE * QR_PLACEHOLDER_SIZE);

    getSecuritySettings.mockImplementation(async () => security({ twoFactorEnabled: true, twoFactorQr: 'otpauth-real' }));
    await sec.loadSecuritySettings();

    expect(sec.qrPending.value).toBe(false);
    expect(sec.qrMatrix.value).toEqual(buildQrMatrix('otpauth-real', QR_PLACEHOLDER_SIZE));
  });

  it('never lets the current session revoke itself', async () => {
    const sec = useSecurity();
    await sec.loadSecuritySettings();

    expect(sec.canRevoke(CURRENT_DEVICE)).toBe(false);
    expect(sec.canRevoke(OTHER_DEVICE)).toBe(true);

    await expect(sec.revokeDevice('dev-other')).resolves.toBe(true);
    expect(revokeLoginDevice).toHaveBeenCalledWith('dev-other');
    expect(sec.devices.value.map((row) => row.id)).toEqual(['dev-current']);
  });

  it('reports a revoke failure without dropping the device list', async () => {
    revokeLoginDevice.mockRejectedValue(new ApiError('NOT_FOUND', 'gone'));
    const sec = useSecurity();
    await sec.loadSecuritySettings();

    await expect(sec.revokeDevice('dev-other')).resolves.toBe(false);

    expect(sec.error.value).toBe('api.404');
    expect(sec.devices.value).toHaveLength(2);
  });

  it('rotates the password and refreshes the security block', async () => {
    const sec = useSecurity();
    const form = {
      currentPassword: 'Old12345',
      newPassword: 'New12345',
      confirmPassword: 'New12345'
    };

    await expect(sec.changePassword(form)).resolves.toBe(true);

    expect(changePassword).toHaveBeenCalledWith(form);
    expect(getSecuritySettings).toHaveBeenCalledTimes(1);
    expect(sec.saving.value).toBe(false);
  });

  it('surfaces password rule errors as i18n keys', () => {
    const sec = useSecurity();

    expect(
      sec.passwordErrors({
        currentPassword: 'Old12345',
        newPassword: 'New12345',
        confirmPassword: 'New12345'
      })
    ).toEqual({});

    const errors = sec.passwordErrors({
      currentPassword: '',
      newPassword: 'New12345',
      confirmPassword: 'Different1'
    });
    expect(errors.currentPassword).toBe('settings.error.currentPasswordRequired');
    expect(errors.confirmPassword).toBe('settings.error.passwordMismatch');

    /* reusing the current password is rejected even when it is strong enough */
    const reused = sec.passwordErrors({
      currentPassword: 'Same12345',
      newPassword: 'Same12345',
      confirmPassword: 'Same12345'
    });
    expect(reused).toEqual({ newPassword: 'settings.error.passwordSame' });

    expect(
      sec.passwordErrors({
        currentPassword: 'Old12345',
        newPassword: 'abc',
        confirmPassword: ''
      })
    ).toMatchObject({ newPassword: 'settings.error.passwordLength', confirmPassword: 'settings.error.confirmRequired' });
  });
});

describe('useChannelBinding', () => {
  it('lists the shared registry rows', async () => {
    const binding = useChannelBinding();
    expect(binding.channels.value).toEqual([]);

    const rows = await binding.loadChannelAccounts();

    expect(rows).toHaveLength(2);
    expect(binding.channels.value.map((row) => row.id)).toEqual(['chn-whatsapp', 'chn-facebook']);
    expect(binding.loading.value).toBe(false);
  });

  it('hides platforms that are already bound', async () => {
    const binding = useChannelBinding();
    expect(binding.availablePlatforms.value).toEqual(['whatsapp', 'facebook', 'instagram', 'tiktok']);

    await binding.loadChannelAccounts();

    expect(binding.boundPlatforms.value).toEqual(['whatsapp', 'facebook']);
    expect(binding.availablePlatforms.value).toEqual(['instagram', 'tiktok']);
  });

  it('serves the provider credential fields and validates them', () => {
    const binding = useChannelBinding();

    expect(binding.credentialFields(null)).toEqual([]);
    expect(binding.credentialFields('whatsapp').map((field) => field.key)).toEqual([
      'phone_number_id',
      'access_token',
      'verify_token'
    ]);

    const fields = binding.credentialFields('whatsapp');
    expect(binding.validate(fields, {})).toEqual({
      phone_number_id: 'common.required',
      access_token: 'common.required',
      verify_token: 'common.required'
    });
    expect(binding.validate(fields, { phone_number_id: '12' })).toEqual({
      phone_number_id: 'settings.error.credentialTooShort',
      access_token: 'common.required',
      verify_token: 'common.required'
    });
    expect(binding.validate(fields, WHATSAPP_CREDENTIALS)).toEqual({});
  });

  it('resolves a single row and returns null for an unknown id', async () => {
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();

    expect(binding.getChannel('chn-whatsapp')).toEqual(WHATSAPP);
    expect(binding.getChannel('ghost')).toBeNull();
  });

  it('binds a platform and clears the picker', async () => {
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();
    binding.selectedPlatform.value = 'instagram';

    const bound = await binding.bindChannel({
      platform: 'instagram',
      credentials: { instagram_business_account_id: '1784', access_token: 'EAAG' }
    });

    expect(bound).toMatchObject({ id: 'chn-instagram', platform: 'instagram' });
    expect(binding.selectedPlatform.value).toBeNull();
    expect(binding.channels.value.map((row) => row.id)).toEqual([
      'chn-whatsapp',
      'chn-facebook',
      'chn-instagram'
    ]);
  });

  it('replaces the previous row when a platform is rebound', async () => {
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();

    await binding.bindChannel({
      platform: 'whatsapp',
      credentials: WHATSAPP_CREDENTIALS
    });

    const ids = binding.channels.value.map((row) => row.id);
    expect(ids.filter((id) => id === 'chn-whatsapp')).toHaveLength(1);
    expect(ids).toEqual(['chn-facebook', 'chn-whatsapp']);
  });

  it('keeps the picker selection when binding fails', async () => {
    bindChannelAccount.mockRejectedValue(new ApiError('HTTP_403', 'plan limit'));
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();
    binding.selectedPlatform.value = 'tiktok';

    const bound = await binding.bindChannel({
      platform: 'tiktok',
      credentials: { client_key: 'key', client_secret: 'secret' }
    });

    expect(bound).toBeNull();
    expect(binding.selectedPlatform.value).toBe('tiktok');
    expect(binding.error.value).toBe('api.403');
    expect(binding.channels.value).toHaveLength(2);
  });

  it('caches probe results and drops them with the row', async () => {
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();
    expect(binding.testResult('chn-whatsapp')).toBeNull();

    const result = await binding.testConnection('chn-whatsapp');

    expect(result).toMatchObject({ channelId: 'chn-whatsapp', ok: true, latencyMs: 140 });
    expect(binding.testResult('chn-whatsapp')).toEqual(result);

    await expect(binding.unbindChannel('chn-whatsapp')).resolves.toBe(true);

    expect(unbindChannelAccount).toHaveBeenCalledWith('chn-whatsapp');
    expect(binding.channels.value.map((row) => row.id)).toEqual(['chn-facebook']);
    expect(binding.testResult('chn-whatsapp')).toBeNull();
    expect(binding.availablePlatforms.value).toContain('whatsapp');
  });

  it('reports a failed probe without caching it', async () => {
    testChannelConnection.mockRejectedValue(new ApiError('HTTP_500', 'upstream'));
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();

    await expect(binding.testConnection('chn-facebook')).resolves.toBeNull();

    expect(binding.error.value).toBe('api.500');
    expect(binding.testResult('chn-facebook')).toBeNull();
    expect(binding.channels.value).toHaveLength(2);
  });

  it('reports an unbind failure and keeps the row', async () => {
    unbindChannelAccount.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));
    const binding = useChannelBinding();
    await binding.loadChannelAccounts();

    await expect(binding.unbindChannel('chn-facebook')).resolves.toBe(false);

    expect(binding.error.value).toBe('api.timeout');
    expect(binding.channels.value).toHaveLength(2);
  });
});

