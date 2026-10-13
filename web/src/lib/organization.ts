/**
 * Organisation context, validation and tenant cache rules (Sprint 13).
 *
 * Pure module, no Vue and no store. Two jobs:
 *
 * 1. Own the persisted "current organisation" so a reload lands the user back
 *    where they were, and so the http layer can read the tenant header without
 *    importing a store (which would be a circular dependency).
 * 2. Own every form rule the organisation pages need, reusing the accepted email
 *    validator from settingsValidation rather than writing a second regex.
 */
import type {
  InvitationInput,
  Member,
  OrgContext,
  OrganizationInput,
  OrganizationSettings,
  RoleInput
} from '../types';
import { isKnownPermission } from './permissions';
import { validateEmail } from './settingsValidation';
import type { ValidationErrors } from './settingsValidation';

export const ORG_CONTEXT_KEY = 'ks-org-context';

/** Page size for the member list; the spec asks for paged loading. */
export const ORG_PAGE_SIZE = 20;

export const ORG_NAME_MIN = 2;
export const ORG_NAME_MAX = 60;
export const ORG_DESCRIPTION_MAX = 200;
export const INVITE_MESSAGE_MAX = 200;
export const ROLE_NAME_MIN = 2;
export const ROLE_NAME_MAX = 40;
export const ROLE_DESCRIPTION_MAX = 160;
export const MAX_INVITES_PER_REQUEST = 20;

/** "Active member" on the overview card means a login inside this window. */
export const ACTIVE_MEMBER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_TIMEOUT_CHOICES = [15, 30, 60, 240, 1440];
export const RETENTION_CHOICES = [30, 90, 180, 365, 730];

/* ------------------------------------------------------------- org context */

export function readOrgContext(): OrgContext | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORG_CONTEXT_KEY) ?? 'null') as OrgContext | null;
    if (parsed && typeof parsed.orgId === 'string' && parsed.orgId !== '') return parsed;
  } catch {
    /* corrupted or unavailable storage falls back to "no organisation yet" */
  }
  return null;
}

export function writeOrgContext(context: OrgContext | null): void {
  try {
    if (context) localStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify(context));
    else localStorage.removeItem(ORG_CONTEXT_KEY);
  } catch {
    /* private mode: the in-memory store still works for this session */
  }
}

export function clearOrgContext(): void {
  writeOrgContext(null);
}

/* ------------------------------------------------------- data isolation */

/**
 * Stores whose contents are scoped to one organisation. Switching tenants must
 * drop all of them or the next page would render the previous organisation's
 * rows. The auth, i18n, theme and organisation stores are deliberately absent:
 * the session survives a switch, and the organisation store is the thing doing
 * the switching.
 */
export const ORG_SCOPED_STORE_IDS = [
  'analytics',
  'channel',
  'conversation',
  'customer',
  'drafts',
  'marketing',
  'message',
  'notification',
  'settings',
  'subscription',
  'tag',
  'usage',
  'websocket',
  'workflow'
] as const;

/** localStorage keys holding org-scoped ui state, cleared on a tenant switch. */
export const ORG_SCOPED_STORAGE_KEYS: readonly string[] = [
  'ks-workflow-demo-hidden',
  'ks-marketing-demo-hidden',
  'ks-analytics-demo-hidden',
  'ks-customer-demo-hidden',
  'ks-notification-demo-hidden'
];

export function clearOrgScopedStorage(): string[] {
  const cleared: string[] = [];
  for (const key of ORG_SCOPED_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared.push(key);
      }
    } catch {
      /* private mode */
    }
  }
  return cleared;
}

/* ------------------------------------------------------------ validation */

export function validateOrgName(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'org.error.nameRequired';
  if (name.length < ORG_NAME_MIN) return 'org.error.nameTooShort';
  if (name.length > ORG_NAME_MAX) return 'org.error.nameTooLong';
  return null;
}

export function validateOrgDescription(value: string): string | null {
  if (value.length > ORG_DESCRIPTION_MAX) return 'org.error.descriptionTooLong';
  return null;
}

export function validateOrgInput(input: OrganizationInput): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = validateOrgName(input.name);
  if (name) errors.name = name;
  const description = validateOrgDescription(input.description ?? '');
  if (description) errors.description = description;
  return errors;
}

export function isOrgInputValid(input: OrganizationInput): boolean {
  return Object.keys(validateOrgInput(input)).length === 0;
}

/** Splits a comma, semicolon, space or newline separated field into addresses. */
export function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function dedupeEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email.trim());
  }
  return out;
}

/**
 * Validates an invite batch. Returns one error per offending address under the
 * email index so the dialog can point at the exact chip, plus a shared error for
 * the batch-level rules.
 */
export function validateInvitationInput(
  input: InvitationInput,
  existingEmails: readonly string[] = []
): ValidationErrors {
  const errors: ValidationErrors = {};
  const emails = dedupeEmails(input.emails);
  if (emails.length === 0) {
    errors.emails = 'org.error.emailRequired';
    return errors;
  }
  if (emails.length > MAX_INVITES_PER_REQUEST) {
    errors.emails = 'org.error.tooManyInvites';
    return errors;
  }
  const taken = new Set(existingEmails.map((e) => e.toLowerCase()));
  const invalid: string[] = [];
  const duplicate: string[] = [];
  for (const email of emails) {
    if (validateEmail(email) !== null) invalid.push(email);
    else if (taken.has(email.toLowerCase())) duplicate.push(email);
  }
  if (invalid.length > 0) errors.emails = 'org.error.emailInvalid';
  else if (duplicate.length > 0) errors.emails = 'org.error.emailAlreadyMember';
  if (!input.roleId) errors.roleId = 'org.error.roleRequired';
  if ((input.message ?? '').length > INVITE_MESSAGE_MAX) errors.message = 'org.error.messageTooLong';
  return errors;
}

export function isInvitationValid(
  input: InvitationInput,
  existingEmails: readonly string[] = []
): boolean {
  return Object.keys(validateInvitationInput(input, existingEmails)).length === 0;
}

export function validateRoleName(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'org.error.roleNameRequired';
  if (name.length < ROLE_NAME_MIN) return 'org.error.roleNameTooShort';
  if (name.length > ROLE_NAME_MAX) return 'org.error.roleNameTooLong';
  return null;
}

export function validateRoleInput(
  input: RoleInput,
  takenNames: readonly string[] = []
): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = validateRoleName(input.name);
  if (name) errors.name = name;
  else if (takenNames.some((n) => n.trim().toLowerCase() === input.name.trim().toLowerCase())) {
    errors.name = 'org.error.roleNameTaken';
  }
  if ((input.description ?? '').length > ROLE_DESCRIPTION_MAX) {
    errors.description = 'org.error.roleDescriptionTooLong';
  }
  const unknown = input.permissions.filter((key) => !isKnownPermission(key));
  if (unknown.length > 0) errors.permissions = 'org.error.permissionUnknown';
  else if (input.permissions.length === 0) errors.permissions = 'org.error.permissionRequired';
  return errors;
}

export function isRoleInputValid(input: RoleInput, takenNames: readonly string[] = []): boolean {
  return Object.keys(validateRoleInput(input, takenNames)).length === 0;
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function isValidIpv4(value: string): boolean {
  return IPV4_RE.test(value.trim());
}

/** Accepts bare addresses and /0-/32 CIDR blocks; rejects everything else. */
export function isValidIpEntry(value: string): boolean {
  const entry = value.trim();
  if (entry === '') return false;
  if (!entry.includes('/')) return isValidIpv4(entry);
  const [address, suffix] = entry.split('/');
  if (!/^\d{1,2}$/.test(suffix)) return false;
  const bits = Number(suffix);
  return bits >= 0 && bits <= 32 && isValidIpv4(address);
}

export function validateIpAllowlist(entries: readonly string[]): string | null {
  for (const entry of entries) {
    if (!isValidIpEntry(entry)) return 'org.error.ipInvalid';
  }
  return null;
}

export function validateSessionTimeout(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'org.error.sessionTimeoutInvalid';
  if (!SESSION_TIMEOUT_CHOICES.includes(minutes)) return 'org.error.sessionTimeoutInvalid';
  return null;
}

export function validateRetentionDays(days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) return 'org.error.retentionInvalid';
  if (!RETENTION_CHOICES.includes(days)) return 'org.error.retentionInvalid';
  return null;
}

export function validateSettings(settings: OrganizationSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  const ip = validateIpAllowlist(settings.security.ipAllowlist);
  if (ip) errors.ipAllowlist = ip;
  const timeout = validateSessionTimeout(settings.security.sessionTimeoutMinutes);
  if (timeout) errors.sessionTimeoutMinutes = timeout;
  const messages = validateRetentionDays(settings.data.messageRetentionDays);
  if (messages) errors.messageRetentionDays = messages;
  const logs = validateRetentionDays(settings.data.logRetentionDays);
  if (logs) errors.logRetentionDays = logs;
  return errors;
}

/**
 * The destructive-action guard: deleting an organisation or transferring
 * ownership requires typing the exact name. Comparison ignores surrounding
 * whitespace and case, because forcing a user to reproduce capitalisation in a
 * panic is not a safety feature.
 */
export function confirmNameMatches(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

/* -------------------------------------------------------------- helpers */

export function isActiveMember(lastLoginAt: number | undefined, now: number = Date.now()): boolean {
  if (lastLoginAt === undefined) return false;
  return now - lastLoginAt <= ACTIVE_MEMBER_WINDOW_MS && lastLoginAt <= now;
}

export function countActiveMembers(members: readonly Member[], now: number = Date.now()): number {
  return members.filter((m) => isActiveMember(m.lastLoginAt, now)).length;
}

/** Two uppercase initials for the avatar fallback, e.g. "Kili Social" -> "KS". */
export function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function memberMatchesQuery(member: Member, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (text === '') return true;
  return (
    member.name.toLowerCase().includes(text) || member.email.toLowerCase().includes(text)
  );
}
