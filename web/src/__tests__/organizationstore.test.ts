/**
 * Sprint 13 organisation store.
 *
 * The four api modules are mocked, so what is under test is the store's own
 * contract: which state a call moves, what it does with no tenant selected, how
 * failures are surfaced, and above all what a tenant switch throws away. That last
 * one is the reason this sprint exists - a cached customer row from organisation A
 * showing up inside organisation B is a data leak, not a cosmetic bug - so the
 * switch assertions are the ones that matter most here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { ApiError, ORG_HEADER, getRequestContext, setRequestContext } from '../api/http';
import { ORG_CONTEXT_KEY, ORG_SCOPED_STORAGE_KEYS } from '../lib/organization';
import {
  EMPTY_OVERVIEW,
  MEMBER_PAGE_SIZE,
  SWITCH_RELOAD_ROUTE,
  reloadAfterSwitch,
  useOrganizationStore
} from '../stores/organization';
import type {
  Invitation,
  Member,
  OrgContext,
  Organization,
  PermissionGroup,
  Role
} from '../types';

vi.mock('../api/organization');
vi.mock('../api/member');
vi.mock('../api/role');
vi.mock('../api/permission');

const orgApi = vi.mocked(organizationApi);
const memApi = vi.mocked(memberApi);
const rolApi = vi.mocked(roleApi);
const perApi = vi.mocked(permissionApi);

function org(patch: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Kili Social',
    description: 'Demo tenant',
    ownerId: 'u-owner',
    memberCount: 3,
    myRoleId: 'role-owner',
    myRoleKind: 'owner',
    createdAt: 1_700_000_000_000,
    ...patch
  };
}

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
    lastLoginAt: 1_700_000_500_000,
    ...patch
  };
}

function role(patch: Partial<Role> = {}): Role {
  return {
    id: 'role-member',
    orgId: 'org-1',
    name: 'Member',
    kind: 'member',
    builtin: true,
    permissions: ['conversation:view'],
    memberCount: 2,
    ...patch
  };
}

function invitation(patch: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    orgId: 'org-1',
    email: 'new@example.com',
    roleId: 'role-member',
    roleKind: 'member',
    invitedByName: 'Amani Juma',
    token: 'tok-1',
    status: 'pending',
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_600_000_000,
    ...patch
  };
}

const CATALOG: PermissionGroup[] = [
  {
    key: 'customer',
    label: 'org.permGroup.customer',
    permissions: [
      { key: 'customer:view', group: 'customer', label: 'org.perm.customer.view' },
      { key: 'customer:delete', group: 'customer', label: 'org.perm.customer.delete' }
    ]
  }
];

/** The second tenant every fixture can switch to. */
const OTHER = 'org-2';

/**
 * Signs the store into one organisation the way bootstrap leaves it: the list is
 * loaded as well as the current row, because the switcher needs both.
 */
async function signedIn(patch: Partial<Organization> = {}, withOthers = true) {
  const store = useOrganizationStore();
  const current = org(patch);
  const others = withOthers
    ? [org({ id: OTHER, name: 'Second', myRoleId: 'role-admin', myRoleKind: 'admin' })]
    : [];
  orgApi.getOrganizations.mockResolvedValue([current, ...others]);
  orgApi.getCurrentOrganization.mockResolvedValue(current);
  await store.fetchOrganizations();
  await store.fetchCurrentOrganization();
  return store;
}

beforeEach(() => {
  localStorage.clear();
  setRequestContext(null);
  setActivePinia(createPinia());
  vi.clearAllMocks();
  orgApi.getOrganizations.mockResolvedValue([]);
  orgApi.getCurrentOrganization.mockResolvedValue(null);
  orgApi.createOrganization.mockImplementation(async (input) => org({ id: 'org-new', name: input.name }));
  orgApi.updateOrganization.mockImplementation(async (id, input) => org({ id, name: input.name ?? 'Kili Social' }));
  orgApi.deleteOrganization.mockResolvedValue(true);
  orgApi.switchOrganization.mockImplementation(async (id) => ({
    orgId: id,
    orgName: 'Switched',
    roleId: 'role-admin',
    roleKind: 'admin'
  }));
  orgApi.getOrganizationSettings.mockResolvedValue({
    security: { twoFactorRequired: false, ipAllowlist: [], sessionTimeoutMinutes: 60 },
    notifications: { memberJoined: true, memberRemoved: true, roleChanged: true, criticalAction: true },
    data: { messageRetentionDays: 180, logRetentionDays: 90 }
  });
  orgApi.updateOrganizationSettings.mockImplementation(async (_id, input) => ({
    security: { twoFactorRequired: false, ipAllowlist: [], sessionTimeoutMinutes: 60, ...(input.security ?? {}) },
    notifications: { memberJoined: true, memberRemoved: true, roleChanged: true, criticalAction: true, ...(input.notifications ?? {}) },
    data: { messageRetentionDays: 180, logRetentionDays: 90, ...(input.data ?? {}) }
  }));
  orgApi.getOrganizationOverview.mockResolvedValue({
    totalMembers: 3,
    activeMembers: 2,
    customRoles: 1,
    pendingInvitations: 1
  });
  orgApi.getOrganizationActivity.mockResolvedValue([]);
  orgApi.transferOwnership.mockResolvedValue(org({ myRoleId: 'role-member', myRoleKind: 'member' }));
  memApi.getMembers.mockResolvedValue({ items: [member()], total: 1, hasMore: false });
  memApi.inviteMember.mockResolvedValue([invitation()]);
  memApi.removeMember.mockResolvedValue(true);
  memApi.updateMemberRole.mockImplementation(async (_o, id, data) => member({ id, roleId: data.roleId }));
  memApi.setMemberStatus.mockImplementation(async (_o, id, status) => member({ id, status }));
  memApi.getInvitations.mockResolvedValue([invitation()]);
  memApi.cancelInvitation.mockResolvedValue(true);
  memApi.resendInvitation.mockResolvedValue(invitation({ id: 'inv-1' }));
  memApi.getInvitationPreview.mockResolvedValue({
    token: 'tok-1',
    orgName: 'Kili Social',
    inviterName: 'Amani Juma',
    roleName: 'Member',
    roleKind: 'member',
    email: 'new@example.com',
    status: 'pending',
    expiresAt: 1_700_600_000_000
  });
  memApi.acceptInvitation.mockResolvedValue(member({ id: 'mem-self', orgId: 'org-2' }));
  rolApi.getRoles.mockResolvedValue([role(), role({ id: 'role-custom', name: 'Support', kind: 'custom', builtin: false })]);
  rolApi.getRole.mockImplementation(async (_o, id) => role({ id }));
  rolApi.createRole.mockImplementation(async (_o, data) =>
    role({ id: 'role-new', name: data.name, kind: 'custom', builtin: false, permissions: data.permissions })
  );
  rolApi.updateRole.mockImplementation(async (_o, id, data) => role({ id, name: data.name ?? 'Member' }));
  rolApi.deleteRole.mockResolvedValue(true);
  perApi.getPermissions.mockResolvedValue(CATALOG);
  perApi.getUserPermissions.mockResolvedValue(['customer:view']);
  perApi.checkPermission.mockImplementation(async (permission) => ({ permission, allowed: true }));
  perApi.checkPermissions.mockImplementation(async (permissions) =>
    permissions.map((permission) => ({ permission, allowed: permission === 'customer:view' }))
  );
});

afterEach(() => {
  setRequestContext(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('reading organisations', () => {
  it('stores the list and flags a demo directory', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([org({ demo: true })]);

    const list = await store.fetchOrganizations();

    expect(list).toHaveLength(1);
    expect(store.organizations).toHaveLength(1);
    expect(store.demo).toBe(true);
    expect(store.hasDemoData).toBe(true);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('records an i18n error key and yields an empty list on failure', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockRejectedValue(new ApiError('HTTP_500', 'boom'));

    const list = await store.fetchOrganizations();

    expect(list).toEqual([]);
    expect(store.error).toBeTruthy();
    expect(store.error).not.toBe('HTTP_500');
  });

  it('binds the tenant header and persists the context on load', async () => {
    const store = await signedIn({ id: 'org-42', name: 'Kili' });

    expect(store.currentOrganization?.id).toBe('org-42');
    expect(store.currentOrgId).toBe('org-42');
    expect(store.isAuthenticatedOrg).toBe(true);
    expect(getRequestContext()[ORG_HEADER]).toBe('org-42');
    expect(JSON.parse(localStorage.getItem(ORG_CONTEXT_KEY) ?? 'null')).toEqual({
      orgId: 'org-42',
      orgName: 'Kili',
      roleId: 'role-owner',
      roleKind: 'owner'
    });
  });

  it('clears the context when the server reports no tenant', async () => {
    localStorage.setItem(ORG_CONTEXT_KEY, JSON.stringify({ orgId: 'stale' }));
    const store = useOrganizationStore();
    orgApi.getCurrentOrganization.mockResolvedValue(null);

    await store.fetchCurrentOrganization();

    expect(store.currentOrganization).toBeNull();
    expect(store.context).toBeNull();
    expect(getRequestContext()[ORG_HEADER]).toBeUndefined();
    expect(localStorage.getItem(ORG_CONTEXT_KEY)).toBeNull();
  });
});

describe('writing organisations', () => {
  it('appends a new organisation and makes it current', async () => {
    const store = await signedIn();

    const created = await store.createOrganization({ name: 'Second' });

    expect(created?.id).toBe('org-new');
    expect(store.organizations.map((o) => o.id)).toEqual(['org-1', OTHER, 'org-new']);
    expect(store.currentOrganization?.id).toBe('org-new');
    expect(getRequestContext()[ORG_HEADER]).toBe('org-new');
    expect(store.saving).toBe(false);
  });

  it('replaces the row in the list and keeps the context name in sync', async () => {
    const store = await signedIn({ id: 'org-1', name: 'Before' });

    const updated = await store.updateOrganization('org-1', { name: 'After' });

    expect(updated?.name).toBe('After');
    expect(store.currentOrganization?.name).toBe('After');
    expect(store.context?.orgName).toBe('After');
  });

  it('switches to a surviving organisation after a delete', async () => {
    const store = await signedIn();

    const ok = await store.deleteOrganization('org-1');

    expect(ok).toBe(true);
    expect(store.organizations.map((o) => o.id)).toEqual([OTHER]);
    expect(orgApi.switchOrganization).toHaveBeenCalledWith(OTHER);
    expect(store.pendingReload).toBe(true);
  });

  it('drops the context entirely when the last organisation goes', async () => {
    const store = await signedIn({}, false);

    await store.deleteOrganization('org-1');

    expect(store.organizations).toEqual([]);
    expect(store.currentOrganization).toBeNull();
    expect(getRequestContext()[ORG_HEADER]).toBeUndefined();
  });

  it('transfers ownership and demotes the caller', async () => {
    const store = await signedIn();

    const updated = await store.transferOwnership('mem-2');

    expect(orgApi.transferOwnership).toHaveBeenCalledWith('org-1', 'mem-2');
    expect(updated?.myRoleKind).toBe('member');
    expect(store.isOwner).toBe(false);
    expect(store.canDestroy).toBe(false);
    expect(store.context?.roleKind).toBe('member');
  });
});

describe('overview, activity and settings', () => {
  it('returns neutral values with no tenant selected', async () => {
    const store = useOrganizationStore();

    expect(await store.fetchOverview()).toEqual(EMPTY_OVERVIEW);
    expect(await store.fetchActivity()).toEqual([]);
    expect(await store.fetchSettings()).toBeNull();
    expect(await store.updateSettings({ data: { logRetentionDays: 30 } })).toBeNull();
    expect(orgApi.getOrganizationOverview).not.toHaveBeenCalled();
  });

  it('loads the four overview counts and the activity trail', async () => {
    const store = await signedIn();

    const stats = await store.fetchOverview();
    const trail = await store.fetchActivity(undefined, 4);

    expect(stats).toEqual({ totalMembers: 3, activeMembers: 2, customRoles: 1, pendingInvitations: 1 });
    expect(store.overview).toEqual(stats);
    expect(orgApi.getOrganizationActivity).toHaveBeenCalledWith('org-1', 4);
    expect(trail).toEqual([]);
  });

  it('saves only the section it was given', async () => {
    const store = await signedIn();

    const saved = await store.updateSettings({ security: { twoFactorRequired: true } });

    expect(orgApi.updateOrganizationSettings).toHaveBeenCalledWith('org-1', {
      security: { twoFactorRequired: true }
    });
    expect(saved?.security.twoFactorRequired).toBe(true);
    expect(saved?.notifications.memberJoined).toBe(true);
    expect(store.settings).toEqual(saved);
  });
});

describe('members', () => {
  it('replaces the page on a fresh query and appends on an offset', async () => {
    const store = await signedIn();

    await store.fetchMembers({ limit: MEMBER_PAGE_SIZE, offset: 0 });
    expect(store.members).toHaveLength(1);
    expect(store.memberTotal).toBe(1);

    memApi.getMembers.mockResolvedValue({
      items: [member({ id: 'mem-2' })],
      total: 2,
      hasMore: true
    });
    await store.fetchMembers({ limit: MEMBER_PAGE_SIZE, offset: 1 });

    expect(store.members.map((m) => m.id)).toEqual(['mem-1', 'mem-2']);
    expect(store.memberHasMore).toBe(true);
  });

  it('pages from the length of what is already loaded', async () => {
    const store = await signedIn();
    await store.fetchMembers();

    await store.loadMoreMembers({ limit: MEMBER_PAGE_SIZE });

    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: MEMBER_PAGE_SIZE,
      offset: 1
    });
  });

  it('defaults the page size when the caller passes none', async () => {
    const store = await signedIn();

    await store.fetchMembers();

    expect(memApi.getMembers).toHaveBeenCalledWith('org-1', { limit: MEMBER_PAGE_SIZE });
  });

  it('removes a member and decrements both counters', async () => {
    const store = await signedIn();
    await store.fetchMembers();

    const ok = await store.removeMember('mem-1');

    expect(ok).toBe(true);
    expect(store.members).toEqual([]);
    expect(store.memberTotal).toBe(0);
    expect(store.currentOrganization?.memberCount).toBe(2);
  });

  it('updates a role in place and refreshes the role list', async () => {
    const store = await signedIn();
    await store.fetchMembers();

    const updated = await store.updateMemberRole('mem-1', 'role-admin');

    expect(updated?.roleId).toBe('role-admin');
    expect(store.members[0].roleId).toBe('role-admin');
    expect(rolApi.getRoles).toHaveBeenCalledWith('org-1');
  });

  it('toggles a member between active and disabled', async () => {
    const store = await signedIn();
    await store.fetchMembers();

    const updated = await store.setMemberStatus('mem-1', 'disabled');

    expect(updated?.status).toBe('disabled');
    expect(store.members[0].status).toBe('disabled');
    expect(store.activeMembers).toEqual([]);
  });

  it('returns empty results rather than calling out with no tenant', async () => {
    const store = useOrganizationStore();

    expect(await store.fetchMembers()).toEqual([]);
    expect(await store.removeMember('mem-1')).toBe(false);
    expect(await store.updateMemberRole('mem-1', 'role-admin')).toBeNull();
    expect(await store.setMemberStatus('mem-1', 'disabled')).toBeNull();
    expect(memApi.getMembers).not.toHaveBeenCalled();
  });
});

describe('invitations', () => {
  it('prepends created invitations so the newest is on top', async () => {
    const store = await signedIn();
    await store.fetchInvitations();
    memApi.inviteMember.mockResolvedValue([invitation({ id: 'inv-2', email: 'second@example.com' })]);

    const created = await store.inviteMember({ emails: ['second@example.com'], roleId: 'role-member' });

    expect(created).toHaveLength(1);
    expect(store.invitations.map((i) => i.id)).toEqual(['inv-2', 'inv-1']);
  });

  it('marks a cancelled invitation instead of dropping it', async () => {
    const store = await signedIn();
    await store.fetchInvitations();

    const ok = await store.cancelInvitation('inv-1');

    expect(ok).toBe(true);
    expect(store.invitations[0].status).toBe('cancelled');
    expect(store.pendingInvitations).toEqual([]);
  });

  it('resends and previews an invitation', async () => {
    const store = await signedIn();

    const sent = await store.resendInvitation('inv-1');
    expect(sent?.id).toBe('inv-1');

    const preview = await store.fetchInvitationPreview('tok-1');
    expect(preview?.orgName).toBe('Kili Social');
    expect(store.invitationPreview).toEqual(preview);
  });

  it('moves the tenant when an invitation is accepted', async () => {
    const store = await signedIn();

    const joined = await store.acceptInvitation('tok-1');

    expect(joined?.orgId).toBe('org-2');
    expect(orgApi.getOrganizations).toHaveBeenCalled();
    expect(orgApi.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(getRequestContext()[ORG_HEADER]).toBe('org-2');
  });
});

describe('roles', () => {
  it('splits built-in from custom roles', async () => {
    const store = await signedIn();

    const roles = await store.fetchRoles();

    expect(roles).toHaveLength(2);
    expect(store.builtinRoles.map((r) => r.id)).toEqual(['role-member']);
    expect(store.customRoles.map((r) => r.id)).toEqual(['role-custom']);
    expect(store.currentOrgRoles).toHaveLength(2);
  });

  it('loads one role, creates, updates and deletes', async () => {
    const store = await signedIn();

    const one = await store.fetchRole('role-member');
    expect(one?.id).toBe('role-member');
    expect(store.currentRole?.id).toBe('role-member');

    const created = await store.createRole({ name: 'Support', permissions: ['conversation:view'] });
    expect(created?.id).toBe('role-new');
    expect(store.roles.map((r) => r.id)).toContain('role-new');

    const updated = await store.updateRole('role-new', { name: 'Support II' });
    expect(updated?.name).toBe('Support II');

    const ok = await store.deleteRole('role-new');
    expect(ok).toBe(true);
    expect(store.roles.map((r) => r.id)).not.toContain('role-new');
  });

  it('clears the open role when it is deleted', async () => {
    const store = await signedIn();
    await store.fetchRole('role-member');

    await store.deleteRole('role-member');

    expect(store.currentRole).toBeNull();
  });

  it('re-reads the caller rights when their own role changes', async () => {
    const store = await signedIn();
    await store.loadUserPermissions();
    perApi.getUserPermissions.mockClear();

    await store.updateRole('role-owner', { name: 'Owner' });

    expect(perApi.getUserPermissions).toHaveBeenCalledWith('org-1');
  });

  it('does not re-read rights when somebody else role changes', async () => {
    const store = await signedIn();
    perApi.getUserPermissions.mockClear();

    await store.updateRole('role-member', { name: 'Member' });

    expect(perApi.getUserPermissions).not.toHaveBeenCalled();
  });
});

describe('permissions', () => {
  it('fetches the catalog once per session', async () => {
    const store = useOrganizationStore();

    await Promise.all([store.fetchPermissions(), store.fetchPermissions(), store.fetchPermissions()]);

    expect(perApi.getPermissions).toHaveBeenCalledTimes(1);
    expect(store.permissionGroups).toEqual(CATALOG);
  });

  it('exposes synchronous checks over the cached set', async () => {
    const store = await signedIn();
    perApi.getUserPermissions.mockResolvedValue(['customer:view', 'marketing:*']);

    await store.loadUserPermissions();

    expect(store.can('customer:view')).toBe(true);
    expect(store.can('customer:delete')).toBe(false);
    expect(store.can('marketing:send')).toBe(true);
    expect(store.canAny(['customer:delete', 'marketing:send'])).toBe(true);
    expect(store.canAll(['customer:view', 'marketing:send'])).toBe(true);
    expect(store.canAll(['customer:view', 'customer:delete'])).toBe(false);
    expect(store.currentUserPermissions).toContain('customer:view');
  });

  it('grants everything to a wildcard holder', async () => {
    const store = await signedIn();
    perApi.getUserPermissions.mockResolvedValue(['*']);

    await store.loadUserPermissions();

    expect(store.can('organization:update_settings')).toBe(true);
  });

  it('empties the cached rights when no tenant is selected', async () => {
    const store = useOrganizationStore();

    expect(await store.loadUserPermissions()).toEqual([]);
    expect(perApi.getUserPermissions).not.toHaveBeenCalled();
  });

  it('merges a server-confirmed right into the cache', async () => {
    const store = await signedIn();
    await store.loadUserPermissions();

    const result = await store.checkPermission('customer:delete');

    expect(result).toEqual({ permission: 'customer:delete', allowed: true });
    expect(store.userPermissions).toEqual(['customer:view', 'customer:delete']);
  });

  it('merges only the granted entries of a batch check', async () => {
    const store = await signedIn();
    await store.loadUserPermissions();

    const results = await store.checkPermissions(['customer:view', 'customer:delete']);

    expect(results).toHaveLength(2);
    expect(store.userPermissions).toEqual(['customer:view']);
  });

  it('falls back to the cached answer when the check endpoint fails', async () => {
    const store = await signedIn();
    await store.loadUserPermissions();
    perApi.checkPermission.mockRejectedValue(new ApiError('HTTP_500', 'boom'));

    const result = await store.checkPermission('customer:view');

    expect(result).toEqual({ permission: 'customer:view', allowed: true });
  });
});

describe('role-derived getters', () => {
  it('reports owner rights from the context role kind', async () => {
    const store = await signedIn({ myRoleKind: 'owner' });

    expect(store.currentRoleKind).toBe('owner');
    expect(store.isOwner).toBe(true);
    expect(store.isAdmin).toBe(false);
    expect(store.canManage).toBe(true);
    expect(store.canDestroy).toBe(true);
  });

  it('reports admin rights without destruction', async () => {
    const store = await signedIn({ myRoleKind: 'admin', myRoleId: 'role-admin' });

    expect(store.isAdmin).toBe(true);
    expect(store.canManage).toBe(true);
    expect(store.canDestroy).toBe(false);
  });

  it('denies management to a viewer', async () => {
    const store = await signedIn({ myRoleKind: 'viewer' });

    expect(store.canManage).toBe(false);
    expect(store.canDestroy).toBe(false);
  });

  it('resolves a role name and a member by id', async () => {
    const store = await signedIn();
    await Promise.all([store.fetchRoles(), store.fetchMembers()]);

    expect(store.roleName('role-member')).toBe('Member');
    expect(store.roleName('role-missing')).toBe('role-missing');
    expect(store.memberById('mem-1')?.name).toBe('Amani Juma');
    expect(store.memberById('nope')).toBeUndefined();
  });

  it('exposes the pending invitation count', async () => {
    const store = await signedIn();
    await store.fetchInvitations();

    expect(store.pendingInvitations).toHaveLength(1);
  });
});

describe('tenant switch and data isolation', () => {
  it('drops the previous tenant rows and asks for a reload', async () => {
    const store = await signedIn({ id: 'org-1' });
    await Promise.all([store.fetchMembers(), store.fetchInvitations(), store.fetchRoles()]);
    await store.fetchOverview();
    expect(store.members).toHaveLength(1);

    const context = await store.switchOrganization('org-2');

    expect(context).toEqual({
      orgId: 'org-2',
      orgName: 'Switched',
      roleId: 'role-admin',
      roleKind: 'admin'
    });
    /* The roster is emptied and left to the page that needs it; roles are re-read. */
    expect(store.members).toEqual([]);
    expect(store.invitations).toEqual([]);
    expect(store.roles).toHaveLength(2);
    expect(store.overview).toEqual(EMPTY_OVERVIEW);
    expect(store.settings).toBeNull();
    expect(store.pendingReload).toBe(true);
    expect(getRequestContext()[ORG_HEADER]).toBe('org-2');
    expect(store.currentOrganization?.myRoleKind).toBe('admin');
  });

  it('clears the org-scoped ui storage keys', async () => {
    for (const key of ORG_SCOPED_STORAGE_KEYS) localStorage.setItem(key, '1');
    localStorage.setItem('ks-ui-locale', 'fr');
    const store = await signedIn();

    await store.switchOrganization('org-2');

    for (const key of ORG_SCOPED_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    /* Locale and theme are the user's, not the tenant's. */
    expect(localStorage.getItem('ks-ui-locale')).toBe('fr');
  });

  it('keeps the current tenant when the switch call fails', async () => {
    const store = await signedIn({ id: 'org-1' });
    orgApi.switchOrganization.mockRejectedValue(new ApiError('HTTP_500', 'boom'));

    const context = await store.switchOrganization('org-2');

    expect(context).toBeNull();
    expect(getRequestContext()[ORG_HEADER]).toBe('org-1');
    expect(store.error).toBeTruthy();
  });

  it('hands the reload flag to the caller exactly once', async () => {
    const store = await signedIn();
    await store.switchOrganization('org-2');

    expect(store.consumePendingReload()).toBe(true);
    expect(store.consumePendingReload()).toBe(false);
  });

  it('hard-navigates to the workspace after a switch', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    expect(SWITCH_RELOAD_ROUTE).toBe('/home');
    reloadAfterSwitch();
    expect(assign).toHaveBeenCalledWith('/home');
    reloadAfterSwitch('/dashboard/organization');
    expect(assign).toHaveBeenLastCalledWith('/dashboard/organization');
  });
});

describe('bootstrap and teardown', () => {
  it('resolves once and reuses the same promise', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([org()]);
    orgApi.getCurrentOrganization.mockResolvedValue(org());

    await Promise.all([store.bootstrap(), store.bootstrap(), store.bootstrap()]);

    expect(orgApi.getOrganizations).toHaveBeenCalledTimes(1);
    expect(store.currentOrganization?.id).toBe('org-1');
    expect(store.userPermissions).toEqual(['customer:view']);
  });

  it('restores the stored tenant when the server names no current one', async () => {
    localStorage.setItem(
      ORG_CONTEXT_KEY,
      JSON.stringify({ orgId: 'org-2', orgName: 'Stored', roleId: 'role-admin', roleKind: 'admin' } satisfies OrgContext)
    );
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([org(), org({ id: 'org-2', name: 'Stored' })]);
    orgApi.getCurrentOrganization.mockResolvedValue(null);

    await store.bootstrap();

    expect(orgApi.switchOrganization).toHaveBeenCalledWith('org-2');
    /* A restore is not a user-initiated switch, so it must not force a reload. */
    expect(store.pendingReload).toBe(false);
  });

  it('leaves an account with no organisation unbound', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([]);

    await store.bootstrap();

    expect(store.currentOrganization).toBeNull();
    expect(store.context).toBeNull();
    expect(perApi.getUserPermissions).not.toHaveBeenCalled();
  });

  it('can be forced to re-resolve', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([org()]);

    await store.bootstrap();
    store.invalidateBootstrap();
    await store.bootstrap();

    expect(orgApi.getOrganizations).toHaveBeenCalledTimes(2);
  });

  it('wipes every trace of the tenant on sign-out', async () => {
    const store = await signedIn();
    await Promise.all([store.fetchMembers(), store.fetchRoles(), store.fetchInvitations()]);
    await store.fetchPermissions();

    store.clearOrganization();

    expect(store.organizations).toEqual([]);
    expect(store.currentOrganization).toBeNull();
    expect(store.members).toEqual([]);
    expect(store.roles).toEqual([]);
    expect(store.invitations).toEqual([]);
    expect(store.permissionGroups).toEqual([]);
    expect(store.userPermissions).toEqual([]);
    expect(store.overview).toEqual(EMPTY_OVERVIEW);
    expect(store.settings).toBeNull();
    expect(store.invitationPreview).toBeNull();
    expect(store.pendingReload).toBe(false);
    expect(localStorage.getItem(ORG_CONTEXT_KEY)).toBeNull();
    expect(getRequestContext()[ORG_HEADER]).toBeUndefined();
  });

  it('bootstraps again after a sign-out', async () => {
    const store = useOrganizationStore();
    orgApi.getOrganizations.mockResolvedValue([org()]);
    orgApi.getCurrentOrganization.mockResolvedValue(org());
    await store.bootstrap();

    store.clearOrganization();
    await store.bootstrap();

    expect(orgApi.getOrganizations).toHaveBeenCalledTimes(2);
    expect(store.currentOrganization?.id).toBe('org-1');
  });
});
