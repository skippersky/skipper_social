import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as settingsApi from '../api/settings';
import { ApiError } from '../api/http';
import { DEMO_CREDENTIALS } from '../api/auth';
import { DEFAULT_SYSTEM_PREFERENCES } from '../api/demo';
import type { ChannelAccount, SecuritySettings, SettingsProfile } from '../types';

const SESSION_KEY = 'ks-demo-session';

/** jsdom has no 2d canvas: answer the probe directly and keep the log clean. */
const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
  getContext: () => unknown;
};
const originalGetContext = canvasPrototype.getContext;

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({ success: ok, code: ok ? 'OK' : 'HTTP_' + status, message: '', data })
  } as unknown as Response;
}

/** Network down: every call must fall back to the on-device demo records. */
function offline(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

/** A live backend answering 5xx: no demo fallback is allowed. */
function hardFailure(status = 500): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

/** A live backend with no settings routes yet: 404 means demo mode. */
function liveMissingBackend(): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));
}

function live<T>(data: T): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue(jsonResponse(data));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function urls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}

function inits(mock: ReturnType<typeof vi.fn>): RequestInit[] {
  return mock.mock.calls.map((call) => call[1] as RequestInit);
}

/** The demo directory needs a signed in session before it answers anything. */
function signInDemo(): void {
  localStorage.setItem(SESSION_KEY, DEMO_CREDENTIALS.email);
}

function pngFile(name = 'avatar.png', bytes = 64): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type: 'image/png' });
}

const VALID_PASSWORDS = {
  currentPassword: 'Old12345',
  newPassword: 'New12345',
  confirmPassword: 'New12345'
};

const WHATSAPP_CREDENTIALS = {
  phone_number_id: '123456789012345',
  access_token: 'EAAG-secret-token',
  verify_token: 'kili-verify-token'
};

beforeEach(() => {
  canvasPrototype.getContext = () => null;
  localStorage.clear();
});

afterEach(() => {
  canvasPrototype.getContext = originalGetContext;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('settings api live backend', () => {
  it('reads the profile over GET', async () => {
    const profile = { name: 'Amani', email: 'a@b.co' } as unknown as SettingsProfile;
    const mock = live(profile);

    await expect(settingsApi.getProfile()).resolves.toEqual(profile);

    expect(urls(mock)).toEqual(['/api/v1/settings/profile']);
    /* GET rides the fetch default, so only the session + timeout options are set */
    expect(inits(mock)[0]).toMatchObject({ credentials: 'include' });
    expect(inits(mock)[0]?.method).toBeUndefined();
    expect(inits(mock)[0]?.body).toBeUndefined();
  });

  it('writes the profile over PUT and forwards the patch', async () => {
    const mock = live({ name: 'Amani J.' });

    await settingsApi.updateProfile({ name: 'Amani J.', bio: 'Shop owner' });

    expect(urls(mock)).toEqual(['/api/v1/settings/profile']);
    expect(inits(mock)[0]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(inits(mock)[0].body))).toEqual({
      name: 'Amani J.',
      bio: 'Shop owner'
    });
  });

  it('uploads the avatar as multipart without a json content type', async () => {
    const mock = live({ url: 'https://cdn.example.test/a.png' });

    await expect(settingsApi.uploadAvatar(pngFile())).resolves.toEqual({
      url: 'https://cdn.example.test/a.png'
    });

    expect(urls(mock)).toEqual(['/api/v1/settings/profile/avatar']);
    expect(inits(mock)[0]).toMatchObject({ method: 'POST' });
    expect(inits(mock)[0].body).toBeInstanceOf(FormData);
    expect((inits(mock)[0].body as FormData).get('file')).toBeTruthy();
    expect(inits(mock)[0].headers).toBeUndefined();
  });

  it('reads and writes the security block', async () => {
    const settings = { twoFactorEnabled: true, devices: [] } as unknown as SecuritySettings;
    const getMock = live(settings);
    await expect(settingsApi.getSecuritySettings()).resolves.toEqual(settings);
    expect(urls(getMock)).toEqual(['/api/v1/settings/security']);

    const putMock = live(settings);
    await settingsApi.updateSecuritySettings({ twoFactorEnabled: true, twoFactorCode: '123456' });
    expect(urls(putMock)).toEqual(['/api/v1/settings/security']);
    expect(inits(putMock)[0]).toMatchObject({ method: 'PUT' });
  });

  it('sends only the two passwords when rotating', async () => {
    const mock = live(null);

    await expect(settingsApi.changePassword(VALID_PASSWORDS)).resolves.toBeUndefined();

    expect(urls(mock)).toEqual(['/api/v1/settings/security/password']);
    expect(JSON.parse(String(inits(mock)[0].body))).toEqual({
      currentPassword: 'Old12345',
      newPassword: 'New12345'
    });
  });

  it('blocks a weak rotation before it reaches the network', async () => {
    const mock = live(null);

    const error = await settingsApi
      .changePassword({ currentPassword: 'Old12345', newPassword: 'abc', confirmPassword: 'abc' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect(mock).not.toHaveBeenCalled();
  });

  it('revokes a device over DELETE and escapes the id', async () => {
    const mock = live([]);

    await settingsApi.revokeLoginDevice('dev/1');

    expect(urls(mock)).toEqual(['/api/v1/settings/security/devices/dev%2F1']);
    expect(inits(mock)[0]).toMatchObject({ method: 'DELETE' });
  });

  it('reads and writes the system preferences', async () => {
    const getMock = live(DEFAULT_SYSTEM_PREFERENCES);
    await expect(settingsApi.getSystemPreferences()).resolves.toEqual(DEFAULT_SYSTEM_PREFERENCES);
    expect(urls(getMock)).toEqual(['/api/v1/settings/preferences']);

    const putMock = live(DEFAULT_SYSTEM_PREFERENCES);
    await settingsApi.updateSystemPreferences({ theme: 'system' });
    expect(inits(putMock)[0]).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(inits(putMock)[0].body))).toEqual({ theme: 'system' });
  });

  it('lists, binds, probes and unbinds channels', async () => {
    const listMock = live([]);
    await expect(settingsApi.getChannelAccounts()).resolves.toEqual([]);
    expect(urls(listMock)).toEqual(['/api/v1/settings/channels']);

    const bound = { id: 'chn-1', platform: 'whatsapp' } as unknown as ChannelAccount;
    const bindMock = live(bound);
    await expect(
      settingsApi.bindChannelAccount({ platform: 'whatsapp', credentials: WHATSAPP_CREDENTIALS })
    ).resolves.toEqual(bound);
    expect(urls(bindMock)).toEqual(['/api/v1/settings/channels/bind']);
    expect(JSON.parse(String(inits(bindMock)[0].body))).toEqual({
      platform: 'whatsapp',
      credentials: WHATSAPP_CREDENTIALS
    });

    const testMock = live({ channelId: 'chn-1', ok: true, latencyMs: 12, checkedAt: 1 });
    await settingsApi.testChannelConnection('chn/1');
    expect(urls(testMock)).toEqual(['/api/v1/settings/channels/chn%2F1/test']);
    expect(inits(testMock)[0]).toMatchObject({ method: 'POST' });

    const unbindMock = live(null);
    await settingsApi.unbindChannelAccount('chn/1');
    expect(urls(unbindMock)).toEqual(['/api/v1/settings/channels/chn%2F1']);
    expect(inits(unbindMock)[0]).toMatchObject({ method: 'DELETE' });
  });

  it('validates platform credentials before binding', async () => {
    const mock = live(null);

    const error = await settingsApi
      .bindChannelAccount({ platform: 'whatsapp', credentials: { access_token: 'abcd' } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).message).toBe('common.required');
    expect(mock).not.toHaveBeenCalled();
  });

  it('rethrows a hard backend failure instead of masking it with demo data', async () => {
    signInDemo();
    hardFailure(500);

    const error = await settingsApi.getProfile().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HTTP_500');
  });

  it('exposes the shared timezone directory', () => {
    expect(settingsApi.DEMO_TIMEZONES).toContain('Africa/Dar_es_Salaam');
    expect(settingsApi.DEMO_TIMEZONES.length).toBeGreaterThan(3);
  });
});

describe('settings api demo fallback', () => {
  it('composes the profile from the auth record plus the local extras', async () => {
    signInDemo();
    offline();

    const profile = await settingsApi.getProfile();

    expect(profile).toMatchObject({
      name: 'Demo Merchant',
      email: DEMO_CREDENTIALS.email,
      company: 'KiliSocial Demo',
      timezone: 'Africa/Dar_es_Salaam',
      language: 'en',
      bio: '',
      avatarUrl: ''
    });
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
  });

  it('treats a 404 as a missing backend', async () => {
    signInDemo();
    liveMissingBackend();

    await expect(settingsApi.getProfile()).resolves.toMatchObject({ name: 'Demo Merchant' });
  });

  it('refuses to compose a profile without a session', async () => {
    offline();

    const error = await settingsApi.getProfile().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UNAUTHORIZED');
  });

  it('persists a profile edit through the auth record', async () => {
    signInDemo();
    offline();

    const saved = await settingsApi.updateProfile({
      name: 'Amani Juma',
      bio: 'Social commerce',
      company: 'KiliMax',
      phone: '+255712345678'
    });

    expect(saved).toMatchObject({
      name: 'Amani Juma',
      bio: 'Social commerce',
      company: 'KiliMax',
      phone: '+255712345678'
    });

    const reloaded = await settingsApi.getProfile();
    expect(reloaded.name).toBe('Amani Juma');
    expect(reloaded.bio).toBe('Social commerce');
  });

  it('drops undefined keys so a partial patch never blanks a value', async () => {
    signInDemo();
    offline();
    await settingsApi.updateProfile({ name: 'Amani Juma', bio: 'kept' });

    const saved = await settingsApi.updateProfile({ bio: 'changed' });

    expect(saved.bio).toBe('changed');
    expect(saved.name).toBe('Amani Juma');
  });

  it('keeps the prepared data url when no upload endpoint exists', async () => {
    signInDemo();
    offline();

    const result = await settingsApi.uploadAvatar(pngFile('me.png', 128));

    expect(result.url.startsWith('data:image/png;base64,')).toBe(true);
    const profile = await settingsApi.getProfile();
    expect(profile.avatarUrl).toBe(result.url);
  });

  it('rotates the demo password and stamps the change', async () => {
    signInDemo();
    offline();

    const wrong = await settingsApi
      .changePassword({
        currentPassword: 'NotThePassword1',
        newPassword: 'New12345',
        confirmPassword: 'New12345'
      })
      .catch((caught: unknown) => caught);
    expect(wrong).toBeInstanceOf(ApiError);
    expect((wrong as ApiError).code).toBe('WRONG_PASSWORD');

    await expect(
      settingsApi.changePassword({
        currentPassword: DEMO_CREDENTIALS.password,
        newPassword: 'New12345',
        confirmPassword: 'New12345'
      })
    ).resolves.toBeUndefined();

    const settings = await settingsApi.getSecuritySettings();
    expect(typeof settings.lastPasswordChangedAt).toBe('number');
  });

  it('serves the demo session list and tombstones a revoked device', async () => {
    signInDemo();
    offline();

    const settings = await settingsApi.getSecuritySettings();
    expect(settings.twoFactorEnabled).toBe(false);
    expect(settings.twoFactorQr).toBeUndefined();
    expect(settings.devices.map((row) => row.id)).toEqual(['device-current', 'device-phone']);
    expect(settings.devices.find((row) => row.current)?.id).toBe('device-current');

    const remaining = await settingsApi.revokeLoginDevice('device-phone');
    expect(remaining.map((row) => row.id)).toEqual(['device-current']);

    /* revoking twice is a no-op rather than an error */
    const again = await settingsApi.revokeLoginDevice('device-phone');
    /* lastActiveAt is derived from Date.now(), so only the stable fields compare */
    expect(again.map((row) => ({ ...row, lastActiveAt: 0 }))).toEqual(
      remaining.map((row) => ({ ...row, lastActiveAt: 0 }))
    );
  });

  it('demands a six digit code before enabling two factor', async () => {
    signInDemo();
    offline();

    const error = await settingsApi
      .updateSecuritySettings({ twoFactorEnabled: true })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_TFA_CODE');

    const enabled = await settingsApi.updateSecuritySettings({
      twoFactorEnabled: true,
      twoFactorCode: '123456'
    });
    expect(enabled.twoFactorEnabled).toBe(true);

    const disabled = await settingsApi.updateSecuritySettings({ twoFactorEnabled: false });
    expect(disabled.twoFactorEnabled).toBe(false);
  });

  it('composes the preferences from the user record and the local switches', async () => {
    signInDemo();
    offline();

    await expect(settingsApi.getSystemPreferences()).resolves.toEqual(DEFAULT_SYSTEM_PREFERENCES);
  });

  it('persists a theme switch locally', async () => {
    signInDemo();
    offline();

    const saved = await settingsApi.updateSystemPreferences({
      theme: 'system',
      soundEnabled: false,
      desktopNotifications: true
    });

    expect(saved).toMatchObject({
      theme: 'system',
      soundEnabled: false,
      desktopNotifications: true,
      language: 'en'
    });
    await expect(settingsApi.getSystemPreferences()).resolves.toMatchObject({ theme: 'system' });
  });

  it('mirrors a locale change onto the auth record', async () => {
    signInDemo();
    offline();

    const saved = await settingsApi.updateSystemPreferences({
      language: 'fr',
      timezone: 'Europe/Paris'
    });

    expect(saved).toMatchObject({ language: 'fr', timezone: 'Europe/Paris' });
    const profile = await settingsApi.getProfile();
    expect(profile).toMatchObject({ language: 'fr', timezone: 'Europe/Paris' });
  });

  it('binds, probes and unbinds a channel in the shared registry', async () => {
    signInDemo();
    offline();

    const bound = await settingsApi.bindChannelAccount({
      platform: 'whatsapp',
      credentials: WHATSAPP_CREDENTIALS
    });
    expect(bound).toMatchObject({
      id: 'demo-whatsapp',
      platform: 'whatsapp',
      accountName: '123456789012345',
      status: 'connected'
    });

    const listed = await settingsApi.getChannelAccounts();
    expect(listed.map((row) => row.id)).toContain('demo-whatsapp');

    const probe = await settingsApi.testChannelConnection('demo-whatsapp');
    expect(probe).toMatchObject({ channelId: 'demo-whatsapp', ok: true });
    expect(probe.latencyMs).toBeGreaterThanOrEqual(120);
    expect(probe.latencyMs).toBeLessThan(300);
    /* the probe is deterministic so the latency never jitters between renders */
    await expect(settingsApi.testChannelConnection('demo-whatsapp')).resolves.toMatchObject({
      latencyMs: probe.latencyMs
    });

    await settingsApi.unbindChannelAccount('demo-whatsapp');
    const afterUnbind = await settingsApi.getChannelAccounts();
    expect(afterUnbind.find((row) => row.id === 'demo-whatsapp')?.status).not.toBe('connected');
    /* demoDisconnect removes the record, so probing it again reports NOT_FOUND */
    const stale = await settingsApi
      .testChannelConnection('demo-whatsapp')
      .catch((caught: unknown) => caught);
    expect(stale).toBeInstanceOf(ApiError);
    expect((stale as ApiError).code).toBe('NOT_FOUND');
  });

  it('reports an unknown channel probe as NOT_FOUND', async () => {
    signInDemo();
    offline();

    const error = await settingsApi
      .testChannelConnection('ghost')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });
});
