import { computed, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { buildQrMatrix, QR_PLACEHOLDER_SIZE } from '../lib/qrPlaceholder';
import { isTwoFactorCodeValid, validatePasswordForm } from '../lib/settingsValidation';
import type { ValidationErrors } from '../lib/settingsValidation';
import type { LoginDevice, PasswordChangeRequest } from '../types';

/** Seed used while the backend has not issued a real TOTP secret. */
export const TWO_FACTOR_SEED_FALLBACK = 'kilisocial-pending';

/**
 * Security tab state: password rotation, two-factor toggle and the remote
 * session list. Two-factor stays demo-only, so the QR tile is a placeholder
 * pattern and the view says so out loud.
 */
export function useSecurity() {
  const store = useSettingsStore();
  const twoFactorCode = ref('');
  const codeError = ref<string | null>(null);

  const securitySettings = computed(() => store.securitySettings);
  const devices = computed<LoginDevice[]>(() => store.loginDevices);
  const twoFactorEnabled = computed(() => store.securitySettings?.twoFactorEnabled ?? false);
  const qrPending = computed(
    () => twoFactorEnabled.value && !store.securitySettings?.twoFactorQr
  );
  const qrMatrix = computed(() =>
    buildQrMatrix(
      store.securitySettings?.twoFactorQr ?? TWO_FACTOR_SEED_FALLBACK,
      QR_PLACEHOLDER_SIZE
    )
  );
  const lastPasswordChangedAt = computed(
    () => store.securitySettings?.lastPasswordChangedAt ?? null
  );
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);

  async function loadSecuritySettings(): Promise<void> {
    await store.fetchSecuritySettings();
  }

  async function changePassword(data: PasswordChangeRequest): Promise<boolean> {
    return store.changePassword(data);
  }

  function passwordErrors(data: PasswordChangeRequest): ValidationErrors {
    return validatePasswordForm(data);
  }

  async function enableTwoFactor(code: string): Promise<boolean> {
    twoFactorCode.value = code;
    if (!isTwoFactorCodeValid(code)) {
      codeError.value = 'settings.error.tfaCodeInvalid';
      return false;
    }
    codeError.value = null;
    const ok = await store.updateSecuritySettings({
      twoFactorEnabled: true,
      twoFactorCode: code.trim()
    });
    if (ok) twoFactorCode.value = '';
    return ok;
  }

  async function disableTwoFactor(): Promise<boolean> {
    codeError.value = null;
    twoFactorCode.value = '';
    return store.updateSecuritySettings({ twoFactorEnabled: false });
  }

  /** One entry point for the switch: enabling always needs a six digit code. */
  async function updateSecuritySettings(enabled: boolean, code?: string): Promise<boolean> {
    return enabled ? enableTwoFactor(code ?? '') : disableTwoFactor();
  }

  /** The session issuing the request can never sign itself out. */
  function canRevoke(device: LoginDevice): boolean {
    return !device.current;
  }

  async function revokeDevice(deviceId: string): Promise<boolean> {
    return store.revokeDevice(deviceId);
  }

  return {
    store,
    twoFactorCode,
    codeError,
    securitySettings,
    devices,
    twoFactorEnabled,
    qrPending,
    qrMatrix,
    lastPasswordChangedAt,
    loading,
    saving,
    error,
    loadSecuritySettings,
    changePassword,
    passwordErrors,
    enableTwoFactor,
    disableTwoFactor,
    updateSecuritySettings,
    canRevoke,
    revokeDevice
  };
}
