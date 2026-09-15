import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as settingsApi from '../api/settings';
import { ApiError } from '../api/http';
import { DEFAULT_SYSTEM_PREFERENCES } from '../api/demo';
import { useSettingsStore } from '../stores/settings';
import type {
  ChannelAccount,
  ChannelTestResult,
  LoginDevice,
  SecuritySettings,
  SettingsProfile,
  SystemPreferences,
  UploadResult
} from '../types';

vi.mock('../api/settings', () => ({
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

const api = vi.mocked(settingsApi);

function profile(overrides: Partial<SettingsProfile> = {}): SettingsProfile {
  return {
    name: 'Amani Juma',
    email: 'amani@kilimax.com',
    phone: '+255712345678',
    bio: 'Social commerce in Dar es Salaam.',
    avatarUrl: 'https://cdn.example.test/a.png',
    company: 'KiliMax',
    timezone: 'Africa/Dar_es_Salaam',
    language: 'en',
    ...overrides
  };
}

function device(overrides: Partial<LoginDevice> = {}): LoginDevice {
  return {
    id: 'dev-1',
    name: 'Chrome on Windows',
    location: 'Dar es Salaam, TZ',
    lastActiveAt: 1700000000000,
    current: false,
    ...overrides
  };
}

function security(overrides: Partial<SecuritySettings> = {}): SecuritySettings {
  return {
    twoFactorEnabled: false,
    lastPasswordChangedAt: 1690000000000,
    devices: [device()],
    ...overrides
  };
}

function channel(overrides: Partial<ChannelAccount> = {}): ChannelAccount {
  return {
    id: 'chn-1',
    platform: 'whatsapp',
    accountName: '+255 712 345 678',
    status: 'connected',
    connectedAt: 1700000000000,
    tokenExpiresAt: 1800000000000,
    ...overrides
  };
}

function preferences(overrides: Partial<SystemPreferences> = {}): SystemPreferences {
  return { ...DEFAULT_SYSTEM_PREFERENCES, ...overrides };
}

function testResult(overrides: Partial<ChannelTestResult> = {}): ChannelTestResult {
  return {
    channelId: 'chn-1',
    ok: true,
    latencyMs: 42,
    checkedAt: 1700000000000,
    ...overrides
  };
}

function imageFile(name: string): File {
  return new File(['kili'], name, { type: 'image/png' });
}

/** Every endpoint answering: the shape the hub loads on first paint. */
function seedStore(): void {
  api.getProfile.mockResolvedValue(profile());
  api.getSecuritySettings.mockResolvedValue(security());
  api.getSystemPreferences.mockResolvedValue(preferences());
  api.getChannelAccounts.mockResolvedValue([channel()]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('settings store initial state', () => {
  it('starts empty and keeps a private copy of the default preferences', () => {
    const store = useSettingsStore();

    expect(store.profile).toBeNull();
    expect(store.securitySettings).toBeNull();
    expect(store.channelAccounts).toEqual([]);
    expect(store.channelTests).toEqual({});
    expect(store.loading).toBe(false);
    expect(store.saving).toBe(false);
    expect(store.error).toBeNull();
    expect(store.systemPreferences).toEqual(DEFAULT_SYSTEM_PREFERENCES);
    expect(store.systemPreferences).not.toBe(DEFAULT_SYSTEM_PREFERENCES);
    expect(store.isProfileComplete).toBe(false);
    expect(store.hasBoundChannels).toBe(false);
    expect(store.enabledChannels).toEqual([]);
    expect(store.loginDevices).toEqual([]);
  });
});

describe('fetchProfile', () => {
  it('stores the profile and derives completeness', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());

    await expect(store.fetchProfile()).resolves.toEqual(profile());

    expect(store.profile).toEqual(profile());
    expect(store.isProfileComplete).toBe(true);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('keeps an incomplete profile but does not flag an error', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile({ name: 'A', email: 'nope' }));

    await store.fetchProfile();

    expect(store.isProfileComplete).toBe(false);
    expect(store.error).toBeNull();
  });

  it('maps a backend failure onto an i18n key and clears the loading flag', async () => {
    const store = useSettingsStore();
    api.getProfile.mockRejectedValue(new ApiError('HTTP_403', 'forbidden'));

    await expect(store.fetchProfile()).resolves.toBeNull();

    expect(store.error).toBe('api.403');
    expect(store.loading).toBe(false);
  });

  it('clears a previous error before a successful retry', async () => {
    const store = useSettingsStore();
    api.getProfile.mockRejectedValueOnce(new Error('offline'));
    await store.fetchProfile();
    expect(store.error).toBe('api.network');

    api.getProfile.mockResolvedValueOnce(profile());
    await store.fetchProfile();

    expect(store.error).toBeNull();
  });
});

describe('updateProfile', () => {
  it('adopts the authoritative server copy', async () => {
    const store = useSettingsStore();
    api.updateProfile.mockResolvedValue(profile({ name: 'Amani J.' }));

    await expect(store.updateProfile({ name: 'Amani J.' })).resolves.toBe(true);

    expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Amani J.' });
    expect(store.profile?.name).toBe('Amani J.');
    expect(store.saving).toBe(false);
  });

  it('reports a timeout and keeps the old profile', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());
    await store.fetchProfile();
    api.updateProfile.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));

    await expect(store.updateProfile({ name: 'x' })).resolves.toBe(false);

    expect(store.error).toBe('api.timeout');
    expect(store.profile).toEqual(profile());
    expect(store.saving).toBe(false);
  });
});

describe('uploadAvatar', () => {
  it('keeps the uploaded url on the profile copy', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());
    await store.fetchProfile();
    const result: UploadResult = { url: 'data:image/png;base64,AAAA' };
    api.uploadAvatar.mockResolvedValue(result);

    await expect(store.uploadAvatar(imageFile('avatar.png'))).resolves.toEqual(result);

    expect(store.profile?.avatarUrl).toBe(result.url);
    expect(store.profile?.name).toBe('Amani Juma');
    expect(store.saving).toBe(false);
  });

  it('still returns the upload when no profile has been loaded', async () => {
    const store = useSettingsStore();
    api.uploadAvatar.mockResolvedValue({ url: 'https://cdn.example.test/b.png' });

    await expect(store.uploadAvatar(imageFile('b.png'))).resolves.toEqual({
      url: 'https://cdn.example.test/b.png'
    });
    expect(store.profile).toBeNull();
  });

  it('reports a rejected upload without touching the profile', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());
    await store.fetchProfile();
    api.uploadAvatar.mockRejectedValue(new ApiError('HTTP_500', 'boom'));

    await expect(store.uploadAvatar(imageFile('c.png'))).resolves.toBeNull();

    expect(store.error).toBe('api.500');
    expect(store.profile?.avatarUrl).toBe('https://cdn.example.test/a.png');
  });
});

describe('security settings', () => {
  it('loads the block and exposes the device list', async () => {
    const store = useSettingsStore();
    api.getSecuritySettings.mockResolvedValue(
      security({ devices: [device(), device({ id: 'dev-2', current: true })] })
    );

    await expect(store.fetchSecuritySettings()).resolves.toMatchObject({ twoFactorEnabled: false });

    expect(store.loginDevices.map((row) => row.id)).toEqual(['dev-1', 'dev-2']);
    expect(store.loading).toBe(false);
  });

  it('reports a load failure', async () => {
    const store = useSettingsStore();
    api.getSecuritySettings.mockRejectedValue(new ApiError('HTTP_401', 'expired'));

    await expect(store.fetchSecuritySettings()).resolves.toBeNull();

    expect(store.error).toBe('api.401');
  });

  it('adopts the server copy after a two factor update', async () => {
    const store = useSettingsStore();
    api.updateSecuritySettings.mockResolvedValue(
      security({ twoFactorEnabled: true, twoFactorQr: 'otpauth://totp/kili' })
    );

    await expect(
      store.updateSecuritySettings({ twoFactorEnabled: true, twoFactorCode: '123456' })
    ).resolves.toBe(true);

    expect(api.updateSecuritySettings).toHaveBeenCalledWith({
      twoFactorEnabled: true,
      twoFactorCode: '123456'
    });
    expect(store.securitySettings?.twoFactorEnabled).toBe(true);
    expect(store.securitySettings?.twoFactorQr).toBe('otpauth://totp/kili');
  });

  it('reports an update failure', async () => {
    const store = useSettingsStore();
    api.updateSecuritySettings.mockRejectedValue(new Error('offline'));

    await expect(store.updateSecuritySettings({ twoFactorEnabled: true })).resolves.toBe(false);

    expect(store.error).toBe('api.network');
  });

  it('rotates the password and refreshes the security block', async () => {
    const store = useSettingsStore();
    api.getSecuritySettings.mockResolvedValue(security({ lastPasswordChangedAt: 1710000000000 }));
    const payload = {
      currentPassword: 'Old12345',
      newPassword: 'New12345',
      confirmPassword: 'New12345'
    };

    await expect(store.changePassword(payload)).resolves.toBe(true);

    expect(api.changePassword).toHaveBeenCalledWith(payload);
    expect(api.getSecuritySettings).toHaveBeenCalledTimes(1);
    expect(store.securitySettings?.lastPasswordChangedAt).toBe(1710000000000);
    expect(store.saving).toBe(false);
  });

  it('reports a rejected rotation and never refreshes', async () => {
    const store = useSettingsStore();
    api.changePassword.mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'settings.error.passwordSame')
    );

    await expect(
      store.changePassword({ currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' })
    ).resolves.toBe(false);

    expect(store.error).toBe('api.network');
    expect(api.getSecuritySettings).not.toHaveBeenCalled();
  });

  it('revokes a remote session and keeps the current one', async () => {
    const store = useSettingsStore();
    api.getSecuritySettings.mockResolvedValue(
      security({ devices: [device(), device({ id: 'dev-2', current: true })] })
    );
    await store.fetchSecuritySettings();
    api.revokeLoginDevice.mockResolvedValue([device({ id: 'dev-2', current: true })]);

    await expect(store.revokeDevice('dev-1')).resolves.toBe(true);

    expect(api.revokeLoginDevice).toHaveBeenCalledWith('dev-1');
    expect(store.loginDevices.map((row) => row.id)).toEqual(['dev-2']);
  });

  it('tolerates a revoke before any security load', async () => {
    const store = useSettingsStore();
    api.revokeLoginDevice.mockResolvedValue([]);

    await expect(store.revokeDevice('dev-9')).resolves.toBe(true);

    expect(store.securitySettings).toBeNull();
    expect(store.loginDevices).toEqual([]);
  });

  it('reports a revoke failure', async () => {
    const store = useSettingsStore();
    api.revokeLoginDevice.mockRejectedValue(new ApiError('HTTP_503', 'down'));

    await expect(store.revokeDevice('dev-1')).resolves.toBe(false);

    expect(store.error).toBe('api.500');
  });
});

describe('system preferences', () => {
  it('paints and persists the fetched theme', async () => {
    const store = useSettingsStore();
    api.getSystemPreferences.mockResolvedValue(
      preferences({ theme: 'system', soundEnabled: false })
    );

    await expect(store.fetchSystemPreferences()).resolves.toMatchObject({ theme: 'system' });

    expect(localStorage.getItem('ks-theme')).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(store.loading).toBe(false);
  });

  it('keeps the previous preferences when the fetch fails', async () => {
    const store = useSettingsStore();
    api.getSystemPreferences.mockRejectedValue(new Error('offline'));

    await expect(store.fetchSystemPreferences()).resolves.toEqual(DEFAULT_SYSTEM_PREFERENCES);

    expect(store.error).toBe('api.network');
    expect(store.loading).toBe(false);
  });

  it('saves a patch, paints it and mirrors locale onto the profile', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());
    await store.fetchProfile();
    api.updateSystemPreferences.mockResolvedValue(
      preferences({ language: 'fr', timezone: 'Europe/Paris', theme: 'light' })
    );

    await expect(
      store.updateSystemPreferences({ language: 'fr', timezone: 'Europe/Paris' })
    ).resolves.toBe(true);

    expect(api.updateSystemPreferences).toHaveBeenCalledWith({
      language: 'fr',
      timezone: 'Europe/Paris'
    });
    expect(store.systemPreferences.language).toBe('fr');
    expect(store.profile?.language).toBe('fr');
    expect(store.profile?.timezone).toBe('Europe/Paris');
    expect(store.saving).toBe(false);
  });

  it('saves without a profile loaded and reports failures', async () => {
    const store = useSettingsStore();
    api.updateSystemPreferences.mockRejectedValue(new ApiError('HTTP_404', 'missing'));

    await expect(store.updateSystemPreferences({ theme: 'light' })).resolves.toBe(false);

    expect(store.error).toBe('api.404');
    expect(store.profile).toBeNull();
    expect(store.systemPreferences).toEqual(DEFAULT_SYSTEM_PREFERENCES);
  });
});

describe('channel accounts', () => {
  it('loads the bound channels and derives the enabled subset', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValue([
      channel(),
      channel({ id: 'chn-2', platform: 'tiktok', status: 'needs_reauth' })
    ]);

    await expect(store.fetchChannelAccounts()).resolves.toHaveLength(2);

    expect(store.hasBoundChannels).toBe(true);
    expect(store.enabledChannels.map((row) => row.id)).toEqual(['chn-1']);
    expect(store.loading).toBe(false);
  });

  it('returns the previous list when the refresh fails', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValueOnce([channel()]);
    await store.fetchChannelAccounts();
    api.getChannelAccounts.mockRejectedValueOnce(new ApiError('HTTP_500', 'boom'));

    await expect(store.fetchChannelAccounts()).resolves.toHaveLength(1);

    expect(store.error).toBe('api.500');
  });

  it('looks a channel up by id', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValue([channel()]);
    await store.fetchChannelAccounts();

    expect(store.getChannelAccount('chn-1')?.platform).toBe('whatsapp');
    expect(store.getChannelAccount('chn-missing')).toBeNull();
  });

  it('replaces an existing row for the same platform when binding', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValue([
      channel(),
      channel({ id: 'chn-2', platform: 'facebook' })
    ]);
    await store.fetchChannelAccounts();
    api.bindChannelAccount.mockResolvedValue(channel({ id: 'chn-3', accountName: 'KiliMax Shop' }));

    const bound = await store.bindChannel({
      platform: 'whatsapp',
      credentials: { access_token: 'abcd1234' }
    });

    expect(bound?.id).toBe('chn-3');
    expect(store.channelAccounts.map((row) => row.id)).toEqual(['chn-2', 'chn-3']);
    expect(store.saving).toBe(false);
  });

  it('reports a rejected bind', async () => {
    const store = useSettingsStore();
    api.bindChannelAccount.mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'common.required')
    );

    await expect(store.bindChannel({ platform: 'tiktok', credentials: {} })).resolves.toBeNull();

    expect(store.error).toBe('api.network');
    expect(store.channelAccounts).toEqual([]);
  });

  it('drops the row and its cached probe result when unbinding', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValue([
      channel(),
      channel({ id: 'chn-2', platform: 'facebook' })
    ]);
    await store.fetchChannelAccounts();
    api.testChannelConnection.mockResolvedValue(testResult());
    await store.testChannelConnection('chn-1');
    expect(store.channelTests['chn-1'].ok).toBe(true);

    api.unbindChannelAccount.mockResolvedValue(undefined);
    await expect(store.unbindChannel('chn-1')).resolves.toBe(true);

    expect(store.channelAccounts.map((row) => row.id)).toEqual(['chn-2']);
    expect(store.channelTests).toEqual({});
  });

  it('reports a rejected unbind and keeps the row', async () => {
    const store = useSettingsStore();
    api.getChannelAccounts.mockResolvedValue([channel()]);
    await store.fetchChannelAccounts();
    api.unbindChannelAccount.mockRejectedValue(new ApiError('HTTP_403', 'nope'));

    await expect(store.unbindChannel('chn-1')).resolves.toBe(false);

    expect(store.error).toBe('api.403');
    expect(store.channelAccounts).toHaveLength(1);
  });

  it('records a probe result and keeps it when a later probe fails', async () => {
    const store = useSettingsStore();
    api.testChannelConnection.mockResolvedValueOnce(
      testResult({ ok: false, message: 'token expired', latencyMs: 900 })
    );

    await expect(store.testChannelConnection('chn-1')).resolves.toMatchObject({ ok: false });
    expect(store.channelTests['chn-1'].latencyMs).toBe(900);

    api.testChannelConnection.mockRejectedValueOnce(new Error('offline'));
    await expect(store.testChannelConnection('chn-1')).resolves.toBeNull();

    expect(store.error).toBe('api.network');
    expect(store.channelTests['chn-1'].ok).toBe(false);
  });
});

describe('loadAll', () => {
  it('fills every tab in one pass', async () => {
    const store = useSettingsStore();
    seedStore();

    await store.loadAll();

    expect(store.profile).toEqual(profile());
    expect(store.securitySettings).toEqual(security());
    expect(store.systemPreferences).toEqual(preferences());
    expect(store.channelAccounts).toEqual([channel()]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    expect(localStorage.getItem('ks-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('keeps the slices that answered when two tabs fail', async () => {
    const store = useSettingsStore();
    api.getProfile.mockResolvedValue(profile());
    api.getSecuritySettings.mockRejectedValue(new ApiError('HTTP_503', 'down'));
    api.getSystemPreferences.mockResolvedValue(preferences({ theme: 'system' }));
    api.getChannelAccounts.mockRejectedValue(new Error('offline'));

    await store.loadAll();

    expect(store.profile).toEqual(profile());
    expect(store.securitySettings).toBeNull();
    expect(store.channelAccounts).toEqual([]);
    /* the last rejection wins, so the network key survives the 5xx key */
    expect(store.error).toBe('api.network');
    expect(store.loading).toBe(false);
  });

  it('reports an auth failure while the rest still lands', async () => {
    const store = useSettingsStore();
    api.getProfile.mockRejectedValue(new ApiError('HTTP_401', 'expired'));
    api.getSecuritySettings.mockResolvedValue(security());
    api.getSystemPreferences.mockResolvedValue(preferences());
    api.getChannelAccounts.mockResolvedValue([channel()]);

    await store.loadAll();

    expect(store.error).toBe('api.401');
    expect(store.channelAccounts).toHaveLength(1);
    expect(store.isProfileComplete).toBe(false);
  });
});
