/**
 * Sprint 13 composables and the v-permission directive.
 *
 * The composables are the seam the spec asks for: a view talks to one of them and
 * never to the api. These tests pin the two things a view actually relies on - that
 * view-local state such as a filter or a draft permission selection lives in the
 * composable and not in the store, and that a composable refuses an invalid payload
 * before it reaches the network.
 *
 * The directive is tested both as pure functions and mounted, because its whole job
 * is a DOM side effect: hiding in place, disabling with a reason, and re-granting
 * the element when the permission set arrives after bootstrap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  resolveDirective,
  withDirectives,
  type Directive
} from 'vue';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { setRequestContext } from '../api/http';
import { useMember } from '../composables/useMember';
import { useOrganization } from '../composables/useOrganization';
import { usePermission } from '../composables/usePermission';
import { useRole } from '../composables/useRole';
import {
  PERMISSION_DISABLED_CLASS,
  PERMISSION_HIDDEN_ATTR,
  PERMISSION_REASON_ATTR,
  denyElement,
  isPermissionAllowed,
  normalizePermission,
  permissionDirective,
  readOwnedPermissions,
  registerPermissionDirective,
  restoreElement,
  type PermissionValue
} from '../directives/permission';
import { MEMBER_PAGE_SIZE, useOrganizationStore } from '../stores/organization';
import type { Member, Organization, Role } from '../types';

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
    ownerId: 'u-owner',
    memberCount: 2,
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
    memberCount: 1,
    ...patch
  };
}

let pinia: Pinia;

async function withOrg() {
  const store = useOrganizationStore();
  orgApi.getCurrentOrganization.mockResolvedValue(org());
  await store.fetchCurrentOrganization();
  return store;
}

beforeEach(() => {
  localStorage.clear();
  setRequestContext(null);
  pinia = createPinia();
  setActivePinia(pinia);
  vi.clearAllMocks();
  orgApi.getOrganizations.mockResolvedValue([org()]);
  orgApi.getCurrentOrganization.mockResolvedValue(org());
  orgApi.createOrganization.mockImplementation(async (input) => org({ id: 'org-new', name: input.name }));
  orgApi.updateOrganization.mockImplementation(async (id, input) => org({ id, name: input.name ?? 'Kili Social' }));
  orgApi.deleteOrganization.mockResolvedValue(true);
  orgApi.switchOrganization.mockImplementation(async (id) => ({
    orgId: id,
    orgName: 'Switched',
    roleId: 'role-member',
    roleKind: 'member'
  }));
  orgApi.getOrganizationOverview.mockResolvedValue({
    totalMembers: 2,
    activeMembers: 1,
    customRoles: 1,
    pendingInvitations: 0
  });
  orgApi.getOrganizationActivity.mockResolvedValue([]);
  orgApi.getOrganizationSettings.mockResolvedValue({
    security: { twoFactorRequired: false, ipAllowlist: [], sessionTimeoutMinutes: 60 },
    notifications: { memberJoined: true, memberRemoved: true, roleChanged: true, criticalAction: true },
    data: { messageRetentionDays: 180, logRetentionDays: 90 }
  });
  orgApi.updateOrganizationSettings.mockResolvedValue({
    security: { twoFactorRequired: true, ipAllowlist: [], sessionTimeoutMinutes: 60 },
    notifications: { memberJoined: true, memberRemoved: true, roleChanged: true, criticalAction: true },
    data: { messageRetentionDays: 180, logRetentionDays: 90 }
  });
  orgApi.transferOwnership.mockResolvedValue(org());
  memApi.getMembers.mockResolvedValue({ items: [member()], total: 1, hasMore: false });
  memApi.getInvitations.mockResolvedValue([]);
  memApi.inviteMember.mockResolvedValue([
    {
      id: 'inv-1',
      orgId: 'org-1',
      email: 'new@example.com',
      roleId: 'role-member',
      roleKind: 'member',
      invitedByName: 'Amani Juma',
      token: 'tok-1',
      status: 'pending',
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_600_000_000
    }
  ]);
  rolApi.getRoles.mockResolvedValue([role(), role({ id: 'role-custom', name: 'Support', kind: 'custom', builtin: false })]);
  rolApi.getRole.mockImplementation(async (_o, id) => role({ id }));
  rolApi.createRole.mockImplementation(async (_o, data) =>
    role({ id: 'role-new', name: data.name, kind: 'custom', builtin: false })
  );
  /* The server echoes back the role it stored. Only a custom role is editable,
     so the echo keeps the role the composable is then allowed to delete. */
  rolApi.updateRole.mockImplementation(async (_o, id, data) =>
    role({ id, name: data.name ?? 'Member', kind: 'custom', builtin: false })
  );
  rolApi.deleteRole.mockResolvedValue(true);
  perApi.getPermissions.mockResolvedValue([
    {
      key: 'customer',
      label: 'org.permGroup.customer',
      permissions: [
        { key: 'customer:view', group: 'customer', label: 'org.perm.customer.view' },
        { key: 'customer:create', group: 'customer', label: 'org.perm.customer.create' },
        { key: 'customer:delete', group: 'customer', label: 'org.perm.customer.delete' }
      ]
    },
    {
      key: 'settings',
      label: 'org.permGroup.settings',
      permissions: [
        { key: 'settings:view', group: 'settings', label: 'org.perm.settings.view' },
        { key: 'settings:update', group: 'settings', label: 'org.perm.settings.update' }
      ]
    }
  ]);
  perApi.getUserPermissions.mockResolvedValue(['customer:view', 'customer:create']);
  perApi.checkPermission.mockImplementation(async (permission) => ({ permission, allowed: true }));
  perApi.checkPermissions.mockImplementation(async (permissions) =>
    permissions.map((permission) => ({ permission, allowed: true }))
  );
});

afterEach(() => {
  setRequestContext(null);
  localStorage.clear();
});

describe('useOrganization', () => {
  it('mirrors the store and derives onboarding and switch flags', async () => {
    const { organizations, needsOnboarding, canSwitch, loadOrganizations } = useOrganization();

    /* The org guard awaits bootstrap() before a dashboard view mounts, so these
       flags are read from a settled list, never from the empty initial one. */
    await loadOrganizations();

    expect(organizations.value.map((entry) => entry.id)).toEqual(['org-1']);
    expect(needsOnboarding.value).toBe(false);
    expect(canSwitch.value).toBe(false);

    orgApi.getOrganizations.mockResolvedValue([]);
    await loadOrganizations();

    expect(organizations.value).toEqual([]);
    expect(needsOnboarding.value).toBe(true);
    expect(canSwitch.value).toBe(false);
  });

  it('offers the switcher once a second tenant exists', async () => {
    orgApi.getOrganizations.mockResolvedValue([org(), org({ id: 'org-2' })]);
    const { canSwitch, loadOrganizations } = useOrganization();

    await loadOrganizations();

    expect(canSwitch.value).toBe(true);
  });

  it('blocks an invalid create before calling out', async () => {
    const { createOrganization } = useOrganization();

    expect(await createOrganization({ name: '' })).toBeNull();
    expect(orgApi.createOrganization).not.toHaveBeenCalled();
  });

  it('creates a valid organisation', async () => {
    const { createOrganization, currentOrganization } = useOrganization();

    const created = await createOrganization({ name: 'Second Team' });

    expect(created?.id).toBe('org-new');
    expect(currentOrganization.value?.id).toBe('org-new');
  });

  it('refuses to delete unless the typed name matches', async () => {
    const { loadOrganizations, deleteOrganization } = useOrganization();
    await loadOrganizations();

    expect(await deleteOrganization('org-1', 'wrong')).toBe(false);
    expect(orgApi.deleteOrganization).not.toHaveBeenCalled();

    expect(await deleteOrganization('org-1', ' KILI SOCIAL ')).toBe(true);
  });

  it('refuses to delete an organisation it does not know', async () => {
    const { deleteOrganization } = useOrganization();

    expect(await deleteOrganization('org-unknown', 'anything')).toBe(false);
  });

  it('switches tenant and reports the new context', async () => {
    const { loadOrganizations, switchOrganization } = useOrganization();
    await loadOrganizations();

    const context = await switchOrganization('org-2');

    expect(context?.orgId).toBe('org-2');
  });

  it('hands the reload side effect to the view', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const { loadOrganizations, switchAndReload } = useOrganization();
    await loadOrganizations();

    expect(await switchAndReload('org-2', '/dashboard/customers')).toBe(true);
    expect(assign).toHaveBeenCalledWith('/dashboard/customers');

    orgApi.switchOrganization.mockRejectedValue(new Error('boom'));
    expect(await switchAndReload('org-3')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('loads the overview, activity and settings through the facade', async () => {
    await withOrg();
    const { loadOverview, loadActivity, loadSettings, saveSettings, overview, emptyOverview } =
      useOrganization();

    expect(await loadOverview()).toEqual({
      totalMembers: 2,
      activeMembers: 1,
      customRoles: 1,
      pendingInvitations: 0
    });
    expect(overview.value.totalMembers).toBe(2);
    expect(await loadActivity()).toEqual([]);
    expect((await loadSettings())?.security.sessionTimeoutMinutes).toBe(60);
    expect((await saveSettings({ security: { twoFactorRequired: true } }))?.security.twoFactorRequired).toBe(true);
    expect(emptyOverview()).toEqual({
      totalMembers: 0,
      activeMembers: 0,
      customRoles: 0,
      pendingInvitations: 0
    });
  });

  it('transfers ownership only with the confirmed name', async () => {
    await withOrg();
    const { transferOwnership } = useOrganization();

    expect(await transferOwnership('mem-2', 'nope')).toBeNull();
    expect(await transferOwnership('mem-2', 'Kili Social')).not.toBeNull();
    expect(orgApi.transferOwnership).toHaveBeenCalledWith('org-1', 'mem-2');
  });

  it('bootstraps idempotently', async () => {
    const { bootstrap } = useOrganization();

    await Promise.all([bootstrap(), bootstrap()]);

    expect(orgApi.getOrganizations).toHaveBeenCalledTimes(1);
  });

  it('exposes the management flags for the role in context', async () => {
    await withOrg();
    const { isOwner, canManage, hasDemoData, loading, saving, error } = useOrganization();

    expect(isOwner.value).toBe(true);
    expect(canManage.value).toBe(true);
    expect(hasDemoData.value).toBe(false);
    expect(loading.value).toBe(false);
    expect(saving.value).toBe(false);
    expect(error.value).toBeNull();
  });
});

describe('useMember', () => {
  it('builds list params from the filter state and omits blanks', async () => {
    const { listParams, query, roleFilter, statusFilter } = useMember();

    expect(listParams()).toEqual({ limit: MEMBER_PAGE_SIZE, offset: 0 });

    query.value = '  ama  ';
    roleFilter.value = 'role-member';
    statusFilter.value = 'disabled';
    expect(listParams(20)).toEqual({
      limit: MEMBER_PAGE_SIZE,
      offset: 20,
      query: 'ama',
      roleId: 'role-member',
      status: 'disabled'
    });
  });

  it('searches, filters by role and filters by status through the api', async () => {
    await withOrg();
    const { search, filterByRole, filterByStatus, loadMore, query, roleFilter, statusFilter } =
      useMember();

    await search('amani');
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: MEMBER_PAGE_SIZE,
      offset: 0,
      query: 'amani'
    });

    /* The filter bar is cumulative: a role narrows the current search rather
       than replacing it, which is what two visible filters promise the user. */
    await filterByRole('role-admin');
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: MEMBER_PAGE_SIZE,
      offset: 0,
      query: 'amani',
      roleId: 'role-admin'
    });

    await filterByStatus('active');
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: MEMBER_PAGE_SIZE,
      offset: 0,
      query: 'amani',
      roleId: 'role-admin',
      status: 'active'
    });

    /* Clearing the bar drops every optional key again. */
    query.value = '';
    roleFilter.value = '';
    statusFilter.value = 'all';
    await loadMore();
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: MEMBER_PAGE_SIZE,
      offset: 1
    });
  });

  it('splits and dedupes a pasted address list', () => {
    const { parseEmails } = useMember();

    expect(parseEmails('a@x.com, A@X.com; b@x.com\nc@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com'
    ]);
    expect(parseEmails('')).toEqual([]);
  });

  it('validates an invite against the current roster', async () => {
    await withOrg();
    const { loadMembers, validateInvitation } = useMember();
    await loadMembers();

    expect(validateInvitation({ emails: ['amani@example.com'], roleId: 'role-member' }).emails).toBe(
      'org.error.emailAlreadyMember'
    );
    expect(validateInvitation({ emails: ['new@example.com'], roleId: 'role-member' })).toEqual({});
  });

  it('blocks an invalid invite and sends a valid one', async () => {
    await withOrg();
    const { inviteMember, invitations } = useMember();

    expect(await inviteMember({ emailsRaw: 'not-an-email', roleId: 'role-member' })).toBeNull();
    expect(memApi.inviteMember).not.toHaveBeenCalled();

    const sent = await inviteMember({ emailsRaw: 'new@example.com', roleId: 'role-member', message: 'Join us' });

    expect(sent).toHaveLength(1);
    expect(invitations.value).toHaveLength(1);
    expect(memApi.inviteMember).toHaveBeenCalledWith('org-1', {
      emails: ['new@example.com'],
      roleId: 'role-member',
      message: 'Join us'
    });
  });

  it('cancels, resends, previews and accepts invitations', async () => {
    await withOrg();
    memApi.cancelInvitation.mockResolvedValue(true);
    memApi.resendInvitation.mockResolvedValue({
      id: 'inv-1',
      orgId: 'org-1',
      email: 'new@example.com',
      roleId: 'role-member',
      roleKind: 'member',
      invitedByName: 'Amani Juma',
      token: 'tok-1',
      status: 'pending',
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_600_000_000
    });
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
    memApi.acceptInvitation.mockResolvedValue(member({ orgId: 'org-2' }));
    const { cancelInvitation, resendInvitation, loadInvitationPreview, acceptInvitation } = useMember();

    expect(await cancelInvitation('inv-1')).toBe(true);
    expect((await resendInvitation('inv-1'))?.id).toBe('inv-1');
    expect((await loadInvitationPreview('tok-1'))?.orgName).toBe('Kili Social');
    expect((await acceptInvitation('tok-1'))?.orgId).toBe('org-2');
  });

  it('reports the member write helpers', async () => {
    await withOrg();
    memApi.updateMemberRole.mockResolvedValue(member({ roleId: 'role-admin' }));
    memApi.removeMember.mockResolvedValue(true);
    memApi.setMemberStatus.mockResolvedValue(member({ status: 'disabled' }));
    const { loadMembers, members, updateMemberRole, removeMember, setMemberStatus, total, hasMore } =
      useMember();
    await loadMembers();

    expect(members.value).toHaveLength(1);
    expect(total.value).toBe(1);
    expect(hasMore.value).toBe(false);
    expect((await updateMemberRole('mem-1', 'role-admin'))?.roleId).toBe('role-admin');
    expect((await setMemberStatus('mem-1', 'disabled'))?.status).toBe('disabled');
    expect(await removeMember('mem-1')).toBe(true);
    expect(members.value).toEqual([]);
  });
});

describe('useRole', () => {
  it('splits the catalog and sorts it most privileged first', async () => {
    await withOrg();
    const { loadRoles, sortedRoles, builtinRoles, customRoles } = useRole();

    await loadRoles();

    expect(builtinRoles.value.map((r) => r.id)).toEqual(['role-member']);
    expect(customRoles.value.map((r) => r.id)).toEqual(['role-custom']);
    expect(sortedRoles.value.map((r) => r.id)).toEqual(['role-member', 'role-custom']);
  });

  it('falls back to the local catalog when the server has none', async () => {
    perApi.getPermissions.mockResolvedValue([]);
    const { loadPermissions, permissionGroups } = useRole();

    await loadPermissions();

    expect(permissionGroups.value).toHaveLength(8);
  });

  it('uses the server catalog when it answers', async () => {
    const { loadPermissions, permissionGroups } = useRole();

    await loadPermissions();

    expect(permissionGroups.value.map((g) => g.key)).toEqual(['customer', 'settings']);
  });

  it('keeps a draft selection separate per role', async () => {
    await withOrg();
    const { loadRoles, startEdit, draftPermissions, draftId, draftCount, closeEdit } = useRole();
    await loadRoles();

    startEdit();
    expect(draftId.value).toBeNull();
    expect(draftPermissions.value).toEqual([]);

    startEdit({ ...role({ id: 'role-custom', permissions: ['customer:view'] }) } as Role);
    expect(draftId.value).toBe('role-custom');
    expect(draftPermissions.value).toEqual(['customer:view']);
    expect(draftCount.value).toBe(1);

    closeEdit();
    expect(draftId.value).toBeNull();
    expect(draftPermissions.value).toEqual([]);
  });

  it('toggles single rights and whole groups', async () => {
    await withOrg();
    const { loadPermissions, togglePermission, toggleGroup, isGroupComplete, isPermissionSelected, draftPermissions } =
      useRole();
    await loadPermissions();

    togglePermission('customer:view');
    expect(isPermissionSelected('customer:view')).toBe(true);
    togglePermission('customer:view');
    expect(isPermissionSelected('customer:view')).toBe(false);

    toggleGroup('customer');
    expect(draftPermissions.value).toEqual(['customer:view', 'customer:create', 'customer:delete']);
    expect(isGroupComplete('customer')).toBe(true);

    toggleGroup('customer');
    expect(draftPermissions.value).toEqual([]);
    expect(isGroupComplete('customer')).toBe(false);
    /* An unknown group has no keys, so it is never "complete". */
    expect(isGroupComplete('nope')).toBe(false);
    toggleGroup('nope');
    expect(draftPermissions.value).toEqual([]);
  });

  it('validates a role before creating it', async () => {
    await withOrg();
    const { loadRoles, validate, createRole } = useRole();
    await loadRoles();

    expect(validate({ name: 'Member', permissions: ['customer:view'] }).name).toBe(
      'org.error.roleNameTaken'
    );
    expect(validate({ name: 'Support', permissions: [] }).name).toBe('org.error.roleNameTaken');
    expect(await createRole({ name: '', permissions: [] })).toBeNull();
    expect(rolApi.createRole).not.toHaveBeenCalled();

    const created = await createRole({ name: 'Field Team', permissions: ['customer:view'] });
    expect(created?.id).toBe('role-new');
  });

  it('refuses to edit or delete a built-in role', async () => {
    await withOrg();
    const { loadRoles, updateRole, deleteRole, canEdit, canDelete } = useRole();
    await loadRoles();

    expect(canEdit({ builtin: true, kind: 'member' })).toBe(false);
    expect(canDelete(role({ builtin: true, kind: 'member' }))).toBe(false);
    expect(canDelete(role({ id: 'role-custom', builtin: false, kind: 'custom', memberCount: 2 }))).toBe(false);
    expect(canDelete(role({ id: 'role-custom', builtin: false, kind: 'custom', memberCount: 0 }))).toBe(true);

    expect(await updateRole('role-member', { name: 'Nope' })).toBeNull();
    expect(await deleteRole('role-member')).toBe(false);
    expect(rolApi.updateRole).not.toHaveBeenCalled();
  });

  it('updates and deletes a custom role and closes the draft', async () => {
    await withOrg();
    const { loadRoles, loadRole, startEdit, updateRole, deleteRole, draftId, currentRole } = useRole();
    await loadRoles();
    startEdit(role({ id: 'role-custom', builtin: false, kind: 'custom' }));

    const updated = await updateRole('role-custom', { name: 'Support II' });
    expect(updated?.name).toBe('Support II');
    expect(draftId.value).toBeNull();

    expect((await loadRole('role-custom'))?.id).toBe('role-custom');
    expect(currentRole.value?.id).toBe('role-custom');
    expect(await deleteRole('role-custom')).toBe(true);
  });

  it('reports a preset permission list per role kind', () => {
    const { permissionsFor } = useRole();

    expect(permissionsFor('owner')).toEqual(['*']);
    expect(permissionsFor('viewer').every((key) => key.endsWith(':view'))).toBe(true);
    expect(permissionsFor('custom')).toEqual([]);
  });

  it('labels a role from its own record', () => {
    const { roleLabel } = useRole();

    expect(roleLabel({ name: 'Support', kind: 'custom' })).toBe('Support');
  });
});

describe('usePermission', () => {
  it('answers synchronously from the cached set', async () => {
    await withOrg();
    const { loadUserPermissions, hasPermission, hasPermissions, hasAnyPermission, hasAllPermissions, userPermissions } =
      usePermission();

    await loadUserPermissions();

    expect(userPermissions.value).toEqual(['customer:view', 'customer:create']);
    expect(hasPermission('customer:view')).toBe(true);
    expect(hasPermission('customer:delete')).toBe(false);
    expect(hasPermissions(['customer:view', 'customer:create'])).toBe(true);
    expect(hasAnyPermission(['customer:delete', 'customer:create'])).toBe(true);
    expect(hasAllPermissions(['customer:view', 'customer:delete'])).toBe(false);
  });

  it('exposes the role flags and defers the server checks', async () => {
    await withOrg();
    const { roleKind, isOwner, isAdmin, canManage, checkPermission, checkPermissions } = usePermission();

    expect(roleKind.value).toBe('owner');
    expect(isOwner.value).toBe(true);
    expect(isAdmin.value).toBe(false);
    expect(canManage.value).toBe(true);

    expect(await checkPermission('customer:delete')).toEqual({
      permission: 'customer:delete',
      allowed: true
    });
    expect(await checkPermissions(['customer:view'])).toHaveLength(1);
  });
});

describe('v-permission normalisation', () => {
  const noModifiers = {} as Record<string, boolean>;

  it('accepts a single key, a list, or an options object', () => {
    expect(normalizePermission({ value: 'customer:view', modifiers: noModifiers } as never)).toEqual({
      keys: ['customer:view'],
      mode: 'hide',
      all: false,
      reason: undefined
    });
    expect(
      normalizePermission({ value: ['a:x', 'b:y'], modifiers: noModifiers } as never).keys
    ).toEqual(['a:x', 'b:y']);
    expect(
      normalizePermission({
        value: { permissions: ['a:x', 'b:y'], mode: 'disable', all: true, reason: 'Ask an admin' },
        modifiers: noModifiers
      } as never)
    ).toEqual({ keys: ['a:x', 'b:y'], mode: 'disable', all: true, reason: 'Ask an admin' });
  });

  it('lets a modifier force disable and all, and prefers permission over permissions', () => {
    expect(
      normalizePermission({ value: 'a:x', modifiers: { disable: true, all: true } } as never)
    ).toEqual({ keys: ['a:x'], mode: 'disable', all: true, reason: undefined });
    expect(
      normalizePermission({
        value: { permission: 'a:x', permissions: ['b:y'] },
        modifiers: noModifiers
      } as never).keys
    ).toEqual(['a:x']);
  });

  it('treats an unknown mode as hide and an empty value as no keys', () => {
    expect(normalizePermission({ value: { mode: 'sideways' }, modifiers: noModifiers } as never).mode).toBe('hide');
    expect(normalizePermission({ value: {}, modifiers: noModifiers } as never).keys).toEqual([]);
  });
});

describe('v-permission element policy', () => {
  it('fails closed with no pinia and open with no keys', () => {
    setActivePinia(createPinia());
    expect(readOwnedPermissions()).toEqual([]);
    expect(isPermissionAllowed([], true)).toBe(true);
    expect(isPermissionAllowed(['customer:view'], false)).toBe(false);
  });

  it('hides an element in place and restores it exactly', () => {
    const el = document.createElement('button');
    el.style.display = 'inline-flex';

    denyElement(el, 'hide');
    expect(el.style.display).toBe('none');
    expect(el.getAttribute(PERMISSION_HIDDEN_ATTR)).toBe('true');
    expect(el.getAttribute('aria-hidden')).toBe('true');

    restoreElement(el);
    expect(el.style.display).toBe('inline-flex');
    expect(el.getAttribute(PERMISSION_HIDDEN_ATTR)).toBeNull();
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });

  it('disables a control and carries the reason', () => {
    const el = document.createElement('button');

    denyElement(el, 'disable', 'Ask an administrator');

    expect(el.disabled).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.classList.contains(PERMISSION_DISABLED_CLASS)).toBe(true);
    expect(el.style.pointerEvents).toBe('none');
    expect(el.getAttribute(PERMISSION_REASON_ATTR)).toBe('Ask an administrator');
    expect(el.getAttribute('title')).toBe('Ask an administrator');

    restoreElement(el);
    expect(el.disabled).toBe(false);
    expect(el.classList.contains(PERMISSION_DISABLED_CLASS)).toBe(false);
    expect(el.getAttribute('title')).toBeNull();
  });

  it('disables a non-form element without touching a disabled property', () => {
    const el = document.createElement('div');

    denyElement(el, 'disable');

    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect((el as unknown as { disabled?: boolean }).disabled).toBeUndefined();
  });
});

describe('v-permission mounted', () => {
  /**
   * The directive is applied with withDirectives rather than an inline template,
   * because the test host runs the runtime-only build of Vue and withDirectives is
   * exactly what the compiler emits for v-permission. The label prop exists only to
   * force an update pass, which is how the updated hook gets exercised.
   */
  const live: VueWrapper[] = [];

  function mountGuarded(value: PermissionValue, modifiers: Record<string, boolean> = {}) {
    const Component = defineComponent({
      props: { label: { type: String, default: 'Delete' } },
      setup: (props) => () =>
        withDirectives(
          h('button', { id: 'guarded', style: { display: 'inline-flex' } }, props.label),
          [[permissionDirective, value, '', modifiers]]
        )
    });
    const wrapper = mount(Component, {
      global: { plugins: [pinia] },
      attachTo: document.body
    });
    live.push(wrapper);
    return { wrapper, el: wrapper.element as HTMLButtonElement };
  }

  afterEach(() => {
    for (const wrapper of live.splice(0)) {
      if (wrapper.exists()) wrapper.unmount();
    }
    document.body.innerHTML = '';
  });

  it('hides a control the cached rights do not cover', async () => {
    const store = await withOrg();
    store.userPermissions = ['customer:view'];

    const { el } = mountGuarded('customer:delete');

    expect(el.style.display).toBe('none');
    expect(el.getAttribute(PERMISSION_HIDDEN_ATTR)).toBe('true');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.disabled).toBe(false);
  });

  it('leaves a covered control exactly as the template wrote it', async () => {
    const store = await withOrg();
    store.userPermissions = ['customer:delete'];

    const { el } = mountGuarded('customer:delete');

    expect(el.style.display).toBe('inline-flex');
    expect(el.getAttribute(PERMISSION_HIDDEN_ATTR)).toBeNull();
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
    expect(el.disabled).toBe(false);
  });

  it('re-grants the element when the permission set arrives after bootstrap', async () => {
    const store = await withOrg();
    store.userPermissions = [];

    const { el } = mountGuarded({ permissions: ['customer:delete'], reason: 'Ask an admin' });
    expect(el.style.display).toBe('none');

    store.userPermissions = ['customer:delete'];
    await nextTick();

    expect(el.style.display).toBe('inline-flex');
    expect(el.getAttribute(PERMISSION_HIDDEN_ATTR)).toBeNull();
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('disables instead of hiding when the disable modifier is set', async () => {
    const store = await withOrg();
    store.userPermissions = [];

    const { el } = mountGuarded(
      { permission: 'customer:delete', reason: 'Ask an admin' },
      { disable: true }
    );

    expect(el.style.display).toBe('inline-flex');
    expect(el.disabled).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.classList.contains(PERMISSION_DISABLED_CLASS)).toBe(true);
    expect(el.getAttribute(PERMISSION_REASON_ATTR)).toBe('Ask an admin');
    expect(el.getAttribute('title')).toBe('Ask an admin');

    store.userPermissions = ['customer:delete'];
    await nextTick();

    expect(el.disabled).toBe(false);
    expect(el.classList.contains(PERMISSION_DISABLED_CLASS)).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('needs any one right by default and every right under all', async () => {
    const store = await withOrg();
    const wanted = ['customer:view', 'customer:delete'];
    store.userPermissions = ['customer:view'];

    const anyOne = mountGuarded(wanted);
    expect(anyOne.el.style.display).toBe('inline-flex');

    const needAll = mountGuarded({ permissions: wanted, all: true });
    expect(needAll.el.style.display).toBe('none');

    store.userPermissions = wanted;
    await nextTick();
    expect(needAll.el.style.display).toBe('inline-flex');
  });

  it('re-applies on update and releases the watcher on unmount', async () => {
    const store = await withOrg();
    store.userPermissions = [];

    const { wrapper, el } = mountGuarded('customer:delete');
    expect(el.style.display).toBe('none');

    /* Something else restores the element; the next patch puts the policy back. */
    restoreElement(el);
    expect(el.style.display).toBe('inline-flex');

    await wrapper.setProps({ label: 'Remove' });
    expect(el.textContent).toBe('Remove');
    expect(el.style.display).toBe('none');

    wrapper.unmount();
    store.userPermissions = ['customer:delete'];
    await nextTick();
    /* The stopped watcher leaves the detached element at its last applied state. */
    expect(el.style.display).toBe('none');
  });
});

describe('registerPermissionDirective', () => {
  it('installs v-permission under the name a template resolves', () => {
    const directive = vi.fn();
    const app = { directive } as never;

    registerPermissionDirective(app);

    expect(directive).toHaveBeenCalledWith('permission', permissionDirective);
  });

  it('drives a resolved directive on a real app', async () => {
    const store = await withOrg();
    store.userPermissions = ['customer:view'];

    const host = document.createElement('div');
    document.body.appendChild(host);
    const Component = defineComponent({
      setup() {
        const directive = resolveDirective('permission');
        expect(directive, 'v-permission should resolve once registered').toBeTruthy();
        return () =>
          withDirectives(h('button', { id: 'from-app' }, 'Export'), [
            [directive as Directive, 'customer:delete']
          ]);
      }
    });
    const app = createApp(Component);
    app.use(pinia);
    registerPermissionDirective(app);
    app.mount(host);
    await nextTick();

    const button = host.querySelector('#from-app') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.style.display).toBe('none');
    expect(button.getAttribute(PERMISSION_HIDDEN_ATTR)).toBe('true');

    app.unmount();
    host.remove();
  });
});
