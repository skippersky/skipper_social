/**
 * Pure validation helpers for the settings module. They return i18n keys (never
 * translated copy) so the UI layer owns presentation and the rules stay testable.
 */
import type { CredentialField } from '../providers/types';
import type { PasswordChangeRequest, SettingsProfile } from '../types';

/** Field name to i18n error key. Empty object means the form is valid. */
export type ValidationErrors = Record<string, string>;

export const NAME_MIN = 2;
export const NAME_MAX = 50;
export const BIO_MAX = 200;
export const PASSWORD_MIN = 8;
export const TWO_FACTOR_CODE_LENGTH = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Optional +, then 7-15 digits with the usual separators. */
const PHONE_RE = /^\+?[0-9][0-9\s\-().]{6,18}$/;
const DIGIT_RE = /[0-9]/;
const LOWER_RE = /[a-z]/;
const UPPER_RE = /[A-Z]/;

function trim(value: string | undefined | null): string {
  return (value ?? '').trim();
}

export function validateName(value: string): string | null {
  const name = trim(value);
  if (!name) return 'settings.error.nameRequired';
  if (name.length < NAME_MIN || name.length > NAME_MAX) return 'settings.error.nameLength';
  return null;
}

export function validateEmail(value: string): string | null {
  const email = trim(value);
  if (!email) return 'settings.error.emailRequired';
  return EMAIL_RE.test(email) ? null : 'settings.error.emailInvalid';
}

/** Phone is optional; when present it must look like an international number. */
export function validatePhone(value: string): string | null {
  const phone = trim(value);
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) return 'settings.error.phoneInvalid';
  return PHONE_RE.test(phone) ? null : 'settings.error.phoneInvalid';
}

export function validateBio(value: string): string | null {
  return trim(value).length > BIO_MAX ? 'settings.error.bioTooLong' : null;
}

/** Runs every profile rule at once; used before enabling the save button. */
export function validateProfile(form: Partial<SettingsProfile>): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = validateName(form.name ?? '');
  if (name) errors.name = name;
  const email = validateEmail(form.email ?? '');
  if (email) errors.email = email;
  const phone = validatePhone(form.phone ?? '');
  if (phone) errors.phone = phone;
  const bio = validateBio(form.bio ?? '');
  if (bio) errors.bio = bio;
  return errors;
}

export function isProfileValid(form: Partial<SettingsProfile>): boolean {
  return Object.keys(validateProfile(form)).length === 0;
}

/** Missing rule keys, in the order the strength meter displays them. */
export function missingPasswordRules(value: string): string[] {
  const missing: string[] = [];
  if (value.length < PASSWORD_MIN) missing.push('settings.error.passwordLength');
  if (!LOWER_RE.test(value)) missing.push('settings.error.passwordLower');
  if (!UPPER_RE.test(value)) missing.push('settings.error.passwordUpper');
  if (!DIGIT_RE.test(value)) missing.push('settings.error.passwordDigit');
  return missing;
}

export interface PasswordStrength {
  /** 0 empty, 1 weak, 2 fair, 3 good, 4 strong. */
  score: 0 | 1 | 2 | 3 | 4;
  missing: string[];
  valid: boolean;
}

export function passwordStrength(value: string): PasswordStrength {
  const missing = missingPasswordRules(value);
  if (!value) return { score: 0, missing, valid: false };
  if (missing.length > 0) return { score: 1, missing, valid: false };
  let score = 2;
  if (value.length >= 12) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return { score: Math.min(score, 4) as PasswordStrength['score'], missing, valid: true };
}

export function validateNewPassword(value: string): string | null {
  if (!value) return 'settings.error.passwordRequired';
  return missingPasswordRules(value)[0] ?? null;
}

export function validateConfirmPassword(next: string, confirm: string): string | null {
  if (!confirm) return 'settings.error.confirmRequired';
  return next === confirm ? null : 'settings.error.passwordMismatch';
}

/**
 * The current password must not be reused: identical old/new is rejected even
 * when the new one satisfies every strength rule.
 */
export function validatePasswordForm(form: PasswordChangeRequest): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.currentPassword) errors.currentPassword = 'settings.error.currentPasswordRequired';
  const next = validateNewPassword(form.newPassword);
  if (next) errors.newPassword = next;
  else if (form.newPassword === form.currentPassword) {
    errors.newPassword = 'settings.error.passwordSame';
  }
  const confirm = validateConfirmPassword(form.newPassword, form.confirmPassword);
  if (confirm) errors.confirmPassword = confirm;
  return errors;
}

export function isTwoFactorCodeValid(code: string): boolean {
  return /^[0-9]{6}$/.test(trim(code)) && trim(code).length === TWO_FACTOR_CODE_LENGTH;
}

/** Required credential fields must be filled; values are trimmed by the caller. */
export function validateCredentials(
  fields: CredentialField[],
  values: Record<string, string>
): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const field of fields) {
    const value = trim(values[field.key]);
    if (!value) {
      if (field.required) errors[field.key] = 'common.required';
      continue;
    }
    if (value.length < 4) errors[field.key] = 'settings.error.credentialTooShort';
  }
  return errors;
}
