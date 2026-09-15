/**
 * Settings and account endpoints (Sprint 10).
 *
 * Every call tries the real backend first and degrades to the on-device demo
 * records on network errors, timeouts and 404s, exactly like the other api
 * modules. Profile identity fields stay owned by the Sprint 3 auth record so
 * the header avatar and the settings form can never disagree.
 */
import { apiBase, apiDelete, apiGet, apiPost, apiPut, ApiError } from './http';
import type { ApiResponse } from './http';
import * as authApi from './auth';
import {
  DEMO_TIMEZONES,
  demoBindChannel,
  demoMarkPasswordChanged,
  demoPreferences,
  demoProfileExtras,
  demoRevokeLoginDevice,
  demoSavePreferences,
  demoSaveProfileExtras,
  demoSecuritySettings,
  demoSettingsChannels,
  demoSettingsTestChannel,
  demoUnbindChannel,
  demoUpdateSecuritySettings,
  isMissingBackend
} from './demo';
import type { DemoPreferenceRecord, DemoProfileExtras } from './demo';
import { prepareAvatar } from '../lib/avatar';
import { getChannelProvider } from '../providers';
import { validateCredentials, validatePasswordForm } from '../lib/settingsValidation';
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
  UpdateMeRequest,
  UploadResult,
  User
} from '../types';

const SETTINGS = '/api/v1/settings';

export { DEMO_TIMEZONES };

/** Drops undefined keys so a partial patch never blanks an existing value. */
function compact<T extends object>(value: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) out[key] = item;
  }
  return out as Partial<T>;
}

function composeProfile(user: User, extras: DemoProfileExtras): SettingsProfile {
  return {
    name: user.nickname,
    email: user.email,
    phone: user.phone ?? '',
    bio: extras.bio,
    avatarUrl: user.avatarUrl || extras.avatarUrl || '',
    company: user.company ?? '',
    timezone: user.timezone,
    language: user.language
  };
}

function composePreferences(user: User, record: DemoPreferenceRecord): SystemPreferences {
  return {
    language: user.language,
    timezone: user.timezone,
    theme: record.theme,
    soundEnabled: record.soundEnabled,
    desktopNotifications: record.desktopNotifications
  };
}

/** Multipart upload helper: the shared json verbs cannot carry a File. */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(apiBase() + path, {
    method: 'POST',
    credentials: 'include',
    body: form
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.code ?? 'HTTP_' + response.status,
      payload.message ?? response.statusText
    );
  }
  return payload.data;
}

export async function getProfile(): Promise<SettingsProfile> {
  try {
    return await apiGet<SettingsProfile>(SETTINGS + '/profile');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return composeProfile(await authApi.getMe(), demoProfileExtras());
  }
}

export async function updateProfile(data: ProfileUpdateRequest): Promise<SettingsProfile> {
  try {
    return await apiPut<SettingsProfile>(SETTINGS + '/profile', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    const patch = compact<UpdateMeRequest>({
      nickname: data.name,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
      company: data.company,
      timezone: data.timezone,
      language: data.language
    });
    const user = await authApi.updateMe(patch as UpdateMeRequest);
    const extras = demoSaveProfileExtras({
      bio: data.bio ?? demoProfileExtras().bio,
      avatarUrl: user.avatarUrl ?? ''
    });
    return composeProfile(user, extras);
  }
}

/**
 * Compresses to a 512px square under 2 MB, uploads it when the endpoint exists
 * and otherwise keeps the prepared data URL on this device.
 */
export async function uploadAvatar(file: File): Promise<UploadResult> {
  const prepared = await prepareAvatar(file);
  try {
    const form = new FormData();
    form.append('file', file, file.name || 'avatar');
    const result = await postForm<UploadResult>(SETTINGS + '/profile/avatar', form);
    return { url: result.url };
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    await updateProfile({ avatarUrl: prepared.dataUrl });
    return { url: prepared.dataUrl };
  }
}

/** Client-side rules run first so a weak password never reaches the network. */
export async function changePassword(data: PasswordChangeRequest): Promise<void> {
  const firstIssue = Object.values(validatePasswordForm(data))[0];
  if (firstIssue) throw new ApiError('VALIDATION_FAILED', firstIssue);
  try {
    await apiPut<void>(SETTINGS + '/security/password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    await authApi.changePassword(data.currentPassword, data.newPassword);
    demoMarkPasswordChanged();
  }
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    return await apiGet<SecuritySettings>(SETTINGS + '/security');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSecuritySettings();
  }
}

export async function updateSecuritySettings(
  data: SecurityUpdateRequest
): Promise<SecuritySettings> {
  try {
    return await apiPut<SecuritySettings>(SETTINGS + '/security', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateSecuritySettings(data);
  }
}

/** Signs one remote session out; the current device cannot be revoked. */
export async function revokeLoginDevice(deviceId: string): Promise<LoginDevice[]> {
  try {
    return await apiDelete<LoginDevice[]>(
      SETTINGS + '/security/devices/' + encodeURIComponent(deviceId)
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRevokeLoginDevice(deviceId);
  }
}

export async function getSystemPreferences(): Promise<SystemPreferences> {
  try {
    return await apiGet<SystemPreferences>(SETTINGS + '/preferences');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return composePreferences(await authApi.getMe(), demoPreferences());
  }
}

export async function updateSystemPreferences(
  data: Partial<SystemPreferences>
): Promise<SystemPreferences> {
  try {
    return await apiPut<SystemPreferences>(SETTINGS + '/preferences', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    const record = demoSavePreferences(
      compact<Partial<DemoPreferenceRecord>>({
        theme: data.theme,
        soundEnabled: data.soundEnabled,
        desktopNotifications: data.desktopNotifications
      })
    );
    if (data.language || data.timezone) {
      try {
        await authApi.updateMe(
          compact<UpdateMeRequest>({
            language: data.language,
            timezone: data.timezone
          }) as UpdateMeRequest
        );
      } catch {
        /* the local preference record stays authoritative for this session */
      }
    }
    return composePreferences(await authApi.getMe(), record);
  }
}

export async function getChannelAccounts(): Promise<ChannelAccount[]> {
  try {
    return await apiGet<ChannelAccount[]>(SETTINGS + '/channels');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSettingsChannels();
  }
}

/** Credential shape is checked against the platform provider before any call. */
export async function bindChannelAccount(data: BindChannelRequest): Promise<ChannelAccount> {
  const fields = getChannelProvider(data.platform).getRequiredCredentials();
  const firstIssue = Object.values(validateCredentials(fields, data.credentials))[0];
  if (firstIssue) throw new ApiError('VALIDATION_FAILED', firstIssue);
  try {
    return await apiPost<ChannelAccount>(SETTINGS + '/channels/bind', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoBindChannel(data.platform, data.credentials);
  }
}

export async function unbindChannelAccount(channelId: string): Promise<void> {
  try {
    await apiDelete<void>(SETTINGS + '/channels/' + encodeURIComponent(channelId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoUnbindChannel(channelId);
  }
}

export async function testChannelConnection(channelId: string): Promise<ChannelTestResult> {
  try {
    return await apiPost<ChannelTestResult>(
      SETTINGS + '/channels/' + encodeURIComponent(channelId) + '/test',
      {}
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSettingsTestChannel(channelId);
  }
}
