/**
 * Sprint 13 pure layers: the permission catalog, the organisation rules and the
 * sub-navigation table.
 *
 * These three modules carry no Vue and no store, so they are tested directly
 * rather than through a mount. That matters because everything else in the sprint
 * is built on their answers: the guard, the directive, the role editor and the
 * demo directory all ask hasPermission or validateRoleInput and trust the result.
 * A wrong wildcard expansion here would be a silent privilege bug everywhere else.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  BUILTIN_ROLE_PRESETS,
  PERMISSION_GROUPS,
  ROLE_KIND_ORDER,
  VIEW_PERMISSION_KEYS,
  WILDCARD,
  canDestroyOrganization,
  canManageOrganization,
  countPermissions,
  expandPermissions,
  grantsAll,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isBuiltinRoleId,
  isEditableRole,
  isKnownPermission,
  isValidPermissionKey,
  permissionKey,
  permissionsForGroup,
  presetForKind,
  sortRoles
} from '../lib/permissions';
import {
  ACTIVE_MEMBER_WINDOW_MS,
  MAX_INVITES_PER_REQUEST,
  ORG_CONTEXT_KEY,
  ORG_SCOPED_STORAGE_KEYS,
  clearOrgScopedStorage,
  confirmNameMatches,
  countActiveMembers,
  dedupeEmails,
  isActiveMember,
  isInvitationValid,
  isOrgInputValid,
  isRoleInputValid,
  isValidIpEntry,
  isValidIpv4,
  memberMatchesQuery,
  orgInitials,
  readOrgContext,
  splitEmails,
  validateInvitationInput,
  validateIpAllowlist,
  validateOrgDescription,
  validateOrgInput,
  validateOrgName,
  validateRetentionDays,
  validateRoleInput,
  validateRoleName,
  validateSessionTimeout,
  validateSettings,
  writeOrgContext
} from '../lib/organization';
import { ORG_NAV } from '../lib/orgNav';
import type { Member, Role } from '../types';

function member(patch: Partial<Member> = {}): Member {
  return {
    id: 'mem-1',
    orgId: 'org-1',
    userId: 'u-1',
    name: 'Amani Juma',
    email: 'amani@example.com',
    roleId: 'role-member',
    roleKind: 'member',
    status: 'active',
    joinedAt: 1_700_000_000_000,
    ...patch
  };
}

function role(patch: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    orgId: 'org-1',
    name: 'Support',
    kind: 'custom',
    builtin: false,
    permissions: ['conversation:view'],
    memberCount: 0,
    ...patch
  };
}

describe('permission catalog', () => {
  it('publishes eight groups and twenty-nine distinct rights', () => {
    expect(PERMISSION_GROUPS).toHaveLength(8);
    expect(ALL_PERMISSIONS).toHaveLength(29);
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length);
  });

  it('names every group and right with an i18n key, never display text', () => {
    for (const group of PERMISSION_GROUPS) {
      expect(group.label).toBe('org.permGroup.' + group.key);
      for (const permission of group.permissions) {
        expect(permission.group).toBe(group.key);
        expect(permission.label).toBe('org.perm.' + group.key + '.' + permission.key.split(':')[1]);
        expect(permission.description).toMatch(/^org\.permDesc\./);
      }
    }
  });

  it('builds and validates group:action keys', () => {
    expect(permissionKey('customer', 'delete')).toBe('customer:delete');
    expect(isValidPermissionKey('customer:delete')).toBe(true);
    expect(isValidPermissionKey('customer')).toBe(false);
    expect(isValidPermissionKey('customer:delete:extra')).toBe(false);
    expect(isValidPermissionKey(':delete')).toBe(false);
    expect(isValidPermissionKey('customer:*')).toBe(false);
  });

  it('recognises catalog members only', () => {
    expect(isKnownPermission('workflow:execute')).toBe(true);
    expect(isKnownPermission('workflow:detonate')).toBe(false);
    expect(permissionsForGroup('settings').map((p) => p.key)).toEqual([
      'settings:view',
      'settings:update'
    ]);
    expect(permissionsForGroup('nope')).toEqual([]);
  });

  it('derives the read-only viewer preset from the :view rights', () => {
    expect(VIEW_PERMISSION_KEYS.length).toBeGreaterThan(0);
    for (const key of VIEW_PERMISSION_KEYS) expect(key.endsWith(':view')).toBe(true);
    expect(presetForKind('viewer')?.permissions).toEqual(VIEW_PERMISSION_KEYS);
  });
});

describe('permission matching', () => {
  it('treats the wildcard as everything', () => {
    expect(grantsAll([WILDCARD])).toBe(true);
    expect(grantsAll(['customer:view'])).toBe(false);
    expect(hasPermission([WILDCARD], 'organization:update_settings')).toBe(true);
  });

  it('matches an exact key and a group wildcard', () => {
    expect(hasPermission(['customer:view'], 'customer:view')).toBe(true);
    expect(hasPermission(['customer:view'], 'customer:delete')).toBe(false);
    expect(hasPermission(['customer:*'], 'customer:delete')).toBe(true);
    expect(hasPermission(['customer:*'], 'conversation:view')).toBe(false);
    expect(hasPermission([], 'customer:view')).toBe(false);
  });

  it('combines rights with any/all semantics', () => {
    const held = ['customer:view', 'marketing:send'];
    expect(hasAnyPermission(held, ['workflow:execute', 'marketing:send'])).toBe(true);
    expect(hasAnyPermission(held, ['workflow:execute'])).toBe(false);
    expect(hasAllPermissions(held, ['customer:view', 'marketing:send'])).toBe(true);
    expect(hasAllPermissions(held, ['customer:view', 'marketing:create'])).toBe(false);
    /* Vacuous truth: nothing requested means nothing to deny. */
    expect(hasAnyPermission(held, [])).toBe(false);
    expect(hasAllPermissions(held, [])).toBe(true);
  });

  it('expands wildcards and drops keys outside the catalog', () => {
    expect(expandPermissions([WILDCARD])).toEqual(ALL_PERMISSION_KEYS);
    expect(expandPermissions(['settings:*'])).toEqual(['settings:view', 'settings:update']);
    expect(expandPermissions(['customer:view', 'made:up'])).toEqual(['customer:view']);
    expect(countPermissions([WILDCARD])).toBe(ALL_PERMISSION_KEYS.length);
    expect(countPermissions(['settings:view', 'settings:update'])).toBe(2);
  });
});

describe('built-in role presets', () => {
  it('defines exactly owner, admin, member and viewer', () => {
    expect(BUILTIN_ROLE_PRESETS.map((p) => p.kind)).toEqual(['owner', 'admin', 'member', 'viewer']);
    for (const preset of BUILTIN_ROLE_PRESETS) {
      expect(isBuiltinRoleId(preset.id)).toBe(true);
      expect(preset.nameKey).toBe('org.role.' + preset.kind);
      expect(preset.descriptionKey).toBe('org.roleDesc.' + preset.kind);
    }
    expect(isBuiltinRoleId('role-custom')).toBe(false);
  });

  it('gives the owner the wildcard and nobody else', () => {
    expect(presetForKind('owner')?.permissions).toEqual([WILDCARD]);
    for (const kind of ['admin', 'member', 'viewer'] as const) {
      expect(presetForKind(kind)?.permissions).not.toContain(WILDCARD);
    }
    expect(presetForKind('custom')).toBeUndefined();
  });

  it('keeps organisation management out of the admin preset', () => {
    const admin = presetForKind('admin')?.permissions ?? [];
    expect(admin.some((key) => key.startsWith('organization:'))).toBe(false);
    expect(admin).toContain('customer:delete');
    expect(admin).toContain('workflow:execute');
  });

  it('scopes the member preset to day-to-day operations', () => {
    const memberKeys = presetForKind('member')?.permissions ?? [];
    expect(memberKeys).toContain('conversation:reply');
    expect(memberKeys).toContain('marketing:send');
    expect(memberKeys).toContain('analytics:view');
    expect(memberKeys).not.toContain('analytics:export');
    expect(memberKeys).not.toContain('settings:update');
    expect(memberKeys.some((key) => key.startsWith('organization:'))).toBe(false);
  });

  it('orders kinds most privileged first and sorts a mixed list', () => {
    expect(ROLE_KIND_ORDER.owner).toBeLessThan(ROLE_KIND_ORDER.admin);
    expect(ROLE_KIND_ORDER.admin).toBeLessThan(ROLE_KIND_ORDER.member);
    expect(ROLE_KIND_ORDER.member).toBeLessThan(ROLE_KIND_ORDER.viewer);
    expect(ROLE_KIND_ORDER.viewer).toBeLessThan(ROLE_KIND_ORDER.custom);

    const mixed = [
      role({ id: 'c', name: 'Zebra', kind: 'custom' }),
      role({ id: 'v', name: 'Viewer', kind: 'viewer', builtin: true }),
      role({ id: 'o', name: 'Owner', kind: 'owner', builtin: true })
    ];
    expect(sortRoles(mixed).map((r) => r.id)).toEqual(['o', 'v', 'c']);
    /* Sorting must not mutate the caller's array. */
    expect(mixed.map((r) => r.id)).toEqual(['c', 'v', 'o']);
  });

  it('allows editing and deletion of custom roles only', () => {
    expect(isEditableRole({ builtin: false, kind: 'custom' })).toBe(true);
    expect(isEditableRole({ builtin: true, kind: 'admin' })).toBe(false);
    expect(isEditableRole({ builtin: false, kind: 'member' })).toBe(false);
  });

  it('reserves management for owner and admin, destruction for owner', () => {
    expect(canManageOrganization('owner')).toBe(true);
    expect(canManageOrganization('admin')).toBe(true);
    expect(canManageOrganization('member')).toBe(false);
    expect(canManageOrganization('viewer')).toBe(false);
    expect(canManageOrganization('custom')).toBe(false);
    expect(canDestroyOrganization('owner')).toBe(true);
    expect(canDestroyOrganization('admin')).toBe(false);
  });
});

describe('organisation context storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('round-trips the active tenant', () => {
    const context = { orgId: 'org-9', orgName: 'Kili', roleId: 'role-admin', roleKind: 'admin' as const };
    writeOrgContext(context);
    expect(readOrgContext()).toEqual(context);
    writeOrgContext(null);
    expect(readOrgContext()).toBeNull();
    expect(localStorage.getItem(ORG_CONTEXT_KEY)).toBeNull();
  });

  it('falls back to no tenant on corrupted or empty storage', () => {
    localStorage.setItem(ORG_CONTEXT_KEY, '{not json');
    expect(readOrgContext()).toBeNull();
    localStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify({ orgId: '' }));
    expect(readOrgContext()).toBeNull();
    localStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify({ nope: 1 }));
    expect(readOrgContext()).toBeNull();
  });
});

describe('tenant cache isolation', () => {
  beforeEach(() => localStorage.clear());

  it('clears only the org-scoped ui keys and reports what it dropped', () => {
    expect(ORG_SCOPED_STORAGE_KEYS.length).toBeGreaterThan(0);
    localStorage.setItem('ks-ui-locale', 'fr');
    localStorage.setItem(ORG_SCOPED_STORAGE_KEYS[0], '1');
    localStorage.setItem(ORG_CONTEXT_KEY, '{}');

    const cleared = clearOrgScopedStorage();

    expect(cleared).toEqual([ORG_SCOPED_STORAGE_KEYS[0]]);
    expect(localStorage.getItem(ORG_SCOPED_STORAGE_KEYS[0])).toBeNull();
    /* Locale and the tenant marker are session state, not tenant data. */
    expect(localStorage.getItem('ks-ui-locale')).toBe('fr');
    expect(localStorage.getItem(ORG_CONTEXT_KEY)).toBe('{}');
    expect(clearOrgScopedStorage()).toEqual([]);
  });
});

describe('organisation form rules', () => {
  it('bounds the organisation name and description', () => {
    expect(validateOrgName('Kili')).toBeNull();
    expect(validateOrgName('  ')).toBe('org.error.nameRequired');
    expect(validateOrgName('K')).toBe('org.error.nameTooShort');
    expect(validateOrgName('x'.repeat(61))).toBe('org.error.nameTooLong');
    expect(validateOrgDescription('x'.repeat(201))).toBe('org.error.descriptionTooLong');
    expect(validateOrgDescription('fine')).toBeNull();
  });

  it('collects every field error at once', () => {
    expect(validateOrgInput({ name: '', description: 'x'.repeat(201) })).toEqual({
      name: 'org.error.nameRequired',
      description: 'org.error.descriptionTooLong'
    });
    expect(isOrgInputValid({ name: 'Kili Social' })).toBe(true);
    expect(isOrgInputValid({ name: '' })).toBe(false);
  });
});

describe('invitation address parsing and rules', () => {
  it('splits on commas, semicolons, spaces and newlines', () => {
    expect(splitEmails('a@x.com, b@x.com;c@x.com\nd@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com'
    ]);
    expect(splitEmails('   ')).toEqual([]);
  });

  it('dedupes case-insensitively but keeps the first spelling', () => {
    expect(dedupeEmails(['A@X.com', 'a@x.com', 'b@x.com'])).toEqual(['A@X.com', 'b@x.com']);
  });

  it('rejects an empty batch before anything else', () => {
    expect(validateInvitationInput({ emails: [], roleId: 'role-member' })).toEqual({
      emails: 'org.error.emailRequired'
    });
  });

  it('caps a batch at the documented maximum', () => {
    const emails = Array.from({ length: MAX_INVITES_PER_REQUEST + 1 }, (_, i) => 'u' + i + '@x.com');
    expect(validateInvitationInput({ emails, roleId: 'role-member' })).toEqual({
      emails: 'org.error.tooManyInvites'
    });
  });

  it('reports malformed addresses before already-enrolled ones', () => {
    expect(
      validateInvitationInput({ emails: ['nope'], roleId: 'role-member' }).emails
    ).toBe('org.error.emailInvalid');
    expect(
      validateInvitationInput({ emails: ['a@x.com'], roleId: 'role-member' }, ['A@X.com']).emails
    ).toBe('org.error.emailAlreadyMember');
  });

  it('requires a role and bounds the personal message', () => {
    const errors = validateInvitationInput({
      emails: ['a@x.com'],
      roleId: '',
      message: 'x'.repeat(201)
    });
    expect(errors.roleId).toBe('org.error.roleRequired');
    expect(errors.message).toBe('org.error.messageTooLong');
    expect(isInvitationValid({ emails: ['a@x.com'], roleId: 'role-member' })).toBe(true);
  });
});

describe('role form rules', () => {
  it('bounds the role name and description', () => {
    expect(validateRoleName('Support')).toBeNull();
    expect(validateRoleName('')).toBe('org.error.roleNameRequired');
    expect(validateRoleName('S')).toBe('org.error.roleNameTooShort');
    expect(validateRoleName('x'.repeat(41))).toBe('org.error.roleNameTooLong');
    expect(validateRoleInput({ name: 'A', description: 'x'.repeat(161), permissions: ['customer:view'] }).description)
      .toBe('org.error.roleDescriptionTooLong');
  });

  it('rejects a name already taken, ignoring case', () => {
    expect(validateRoleInput({ name: 'support', permissions: ['customer:view'] }, ['Support']).name)
      .toBe('org.error.roleNameTaken');
  });

  it('rejects unknown rights before an empty selection', () => {
    expect(validateRoleInput({ name: 'Support', permissions: ['customer:detonate'] }).permissions)
      .toBe('org.error.permissionUnknown');
    expect(validateRoleInput({ name: 'Support', permissions: [] }).permissions)
      .toBe('org.error.permissionRequired');
    expect(isRoleInputValid({ name: 'Support', permissions: ['customer:view'] })).toBe(true);
  });
});

describe('ip allowlist, timeout and retention rules', () => {
  it('accepts dotted quads inside range and rejects the rest', () => {
    expect(isValidIpv4('10.0.0.1')).toBe(true);
    expect(isValidIpv4('255.255.255.255')).toBe(true);
    expect(isValidIpv4('256.0.0.1')).toBe(false);
    expect(isValidIpv4('10.0.0')).toBe(false);
    expect(isValidIpv4('ten.zero.zero.one')).toBe(false);
  });

  it('accepts a bare address or a /0-/32 block', () => {
    expect(isValidIpEntry('10.0.0.1')).toBe(true);
    expect(isValidIpEntry('10.0.0.0/24')).toBe(true);
    expect(isValidIpEntry('10.0.0.0/0')).toBe(true);
    expect(isValidIpEntry('10.0.0.0/32')).toBe(true);
    expect(isValidIpEntry('10.0.0.0/33')).toBe(false);
    expect(isValidIpEntry('10.0.0.0/')).toBe(false);
    expect(isValidIpEntry('')).toBe(false);
  });

  it('fails the whole allowlist on the first bad entry', () => {
    expect(validateIpAllowlist(['10.0.0.1', '10.0.0.0/24'])).toBeNull();
    expect(validateIpAllowlist(['10.0.0.1', '999.1.1.1'])).toBe('org.error.ipInvalid');
    expect(validateIpAllowlist([])).toBeNull();
  });

  it('accepts only the offered timeout and retention choices', () => {
    expect(validateSessionTimeout(30)).toBeNull();
    expect(validateSessionTimeout(45)).toBe('org.error.sessionTimeoutInvalid');
    expect(validateSessionTimeout(0)).toBe('org.error.sessionTimeoutInvalid');
    expect(validateRetentionDays(90)).toBeNull();
    expect(validateRetentionDays(91)).toBe('org.error.retentionInvalid');
  });

  it('reports every offending settings section', () => {
    const errors = validateSettings({
      security: { twoFactorRequired: false, ipAllowlist: ['bad'], sessionTimeoutMinutes: 7 },
      notifications: { memberJoined: true, memberRemoved: true, roleChanged: true, criticalAction: true },
      data: { messageRetentionDays: 10, logRetentionDays: 90 }
    });
    expect(errors.ipAllowlist).toBe('org.error.ipInvalid');
    expect(errors.sessionTimeoutMinutes).toBe('org.error.sessionTimeoutInvalid');
    expect(errors.messageRetentionDays).toBe('org.error.retentionInvalid');
    expect(errors.logRetentionDays).toBeUndefined();
  });
});

describe('destructive-action confirmation', () => {
  it('ignores surrounding space and case, and rejects anything else', () => {
    expect(confirmNameMatches('  kili social ', 'Kili Social')).toBe(true);
    expect(confirmNameMatches('Kili Sociel', 'Kili Social')).toBe(false);
    expect(confirmNameMatches('', 'Kili Social')).toBe(false);
  });
});

describe('activity window and roster helpers', () => {
  const NOW = 1_700_000_000_000;

  it('counts a login inside the seven-day window as active', () => {
    expect(ACTIVE_MEMBER_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(isActiveMember(NOW - 1000, NOW)).toBe(true);
    expect(isActiveMember(NOW - ACTIVE_MEMBER_WINDOW_MS, NOW)).toBe(true);
    expect(isActiveMember(NOW - ACTIVE_MEMBER_WINDOW_MS - 1, NOW)).toBe(false);
    expect(isActiveMember(undefined, NOW)).toBe(false);
    /* A clock skew into the future is not activity. */
    expect(isActiveMember(NOW + 5000, NOW)).toBe(false);
  });

  it('counts active members across a roster', () => {
    const roster = [
      member({ id: 'a', lastLoginAt: NOW - 1000 }),
      member({ id: 'b', lastLoginAt: NOW - ACTIVE_MEMBER_WINDOW_MS - 1 }),
      member({ id: 'c' })
    ];
    expect(countActiveMembers(roster, NOW)).toBe(1);
  });

  it('reduces a name to two initials with sensible fallbacks', () => {
    expect(orgInitials('Kili Social')).toBe('KS');
    expect(orgInitials('kilisocial')).toBe('KI');
    expect(orgInitials('   ')).toBe('?');
  });

  it('matches a member by name or email, case-insensitively', () => {
    const row = member();
    expect(memberMatchesQuery(row, '')).toBe(true);
    expect(memberMatchesQuery(row, 'AMANI')).toBe(true);
    expect(memberMatchesQuery(row, 'example.com')).toBe(true);
    expect(memberMatchesQuery(row, 'zzz')).toBe(false);
  });
});

describe('organisation sub-navigation', () => {
  it('lists the five pages and gates three of them', () => {
    expect(ORG_NAV.map((item) => item.key)).toEqual([
      'overview',
      'members',
      'roles',
      'settings',
      'switch'
    ]);
    const gated = ORG_NAV.filter((item) => item.permission);
    expect(gated.map((item) => item.key)).toEqual(['members', 'roles', 'settings']);
    for (const item of ORG_NAV) {
      expect(item.path.startsWith('/dashboard/organization')).toBe(true);
      expect(item.labelKey.startsWith('org.')).toBe(true);
    }
  });
});
