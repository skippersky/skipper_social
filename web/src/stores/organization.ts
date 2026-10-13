/**
 * Organisation, member, role and permission state (Sprint 13).
 *
 * One store, four concerns, because they share a single tenant context: which
 * organisation is active decides which members, which roles and which
 * permissions are even meaningful. The composables slice this store for the
 * views, so a page never reaches past its own composable.
 *
 * Tenant isolation is explicit rather than hopeful. A switch clears the
 * org-scoped localStorage keys, resets the two accepted stores that publish a
 * $reset (marketing, workflow), rebinds the http tenant header and then asks the
 * caller to perform a hard reload, which is the only way to guarantee that the
 * twelve stores with no reset entry point cannot leak rows from the previous
 * tenant. Nothing accepted in Sprints 3-12 was modified to make that work.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { apiErrorI18nKey } from '../api/http';
import { setOrganizationHeader } from '../api/http';
import {
  clearOrgContext,
  clearOrgScopedStorage,
  ORG_PAGE_SIZE,
  readOrgContext,
  writeOrgContext
} from '../lib/organization';
import { canDestroyOrganization, canManageOrganization, hasPermission } from '../lib/permissions';
import { useMarketingStore } from './marketing';
import { useWorkflowStore } from './workflow';
import type {
  Invitation,
  InvitationInput,
  InvitationPreview,
  Member,
  MemberListParams,
  MemberStatus,
  OrgActivity,
  OrgContext,
  OrgOverviewStats,
  Organization,
  OrganizationInput,
  OrganizationSettings,
  OrganizationSettingsInput,
  OrgRoleKind,
  PermissionCheckResult,
  PermissionGroup,
  Role,
  RoleInput
} from '../types';

export const MEMBER_PAGE_SIZE = ORG_PAGE_SIZE;

export const EMPTY_OVERVIEW: OrgOverviewStats = {
  totalMembers: 0,
  activeMembers: 0,
  customRoles: 0,
  pendingInvitations: 0
};

export const useOrganizationStore = defineStore('organization', () => {
  /* -------------------------------------------------------------- state */

  const organizations = ref<Organization[]>([]);
  const currentOrganization = ref<Organization | null>(null);
  const context = ref<OrgContext | null>(readOrgContext());
  const members = ref<Member[]>([]);
  const memberTotal = ref(0);
  const memberHasMore = ref(false);
  const invitations = ref<Invitation[]>([]);
  const roles = ref<Role[]>([]);
  const currentRole = ref<Role | null>(null);
  const permissionGroups = ref<PermissionGroup[]>([]);
  const userPermissions = ref<string[]>([]);
  const activity = ref<OrgActivity[]>([]);
  const overview = ref<OrgOverviewStats>({ ...EMPTY_OVERVIEW });
  const settings = ref<OrganizationSettings | null>(null);
  const invitationPreview = ref<InvitationPreview | null>(null);

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  /** True when any organisation row came from the on-device demo directory. */
  const demo = ref(false);
  /** Set by switchOrganization; the view performs the reload. */
  const pendingReload = ref(false);
  let bootstrapped: Promise<void> | null = null;

  /* ------------------------------------------------------------ getters */

  const isAuthenticatedOrg = computed(() => currentOrganization.value !== null);
  const currentOrgId = computed(() => currentOrganization.value?.id ?? null);
  const currentOrgMembers = computed(() => members.value);
  const currentOrgRoles = computed(() => roles.value);
  const currentUserPermissions = computed(() => userPermissions.value);
  const currentRoleKind = computed<OrgRoleKind>(
    () => context.value?.roleKind ?? currentOrganization.value?.myRoleKind ?? 'viewer'
  );
  const isOwner = computed(() => currentRoleKind.value === 'owner');
  const isAdmin = computed(() => currentRoleKind.value === 'admin');
  const canManage = computed(() => canManageOrganization(currentRoleKind.value));
  const canDestroy = computed(() => canDestroyOrganization(currentRoleKind.value));
  const hasDemoData = computed(
    () => demo.value || organizations.value.some((org) => org.demo === true)
  );
  const builtinRoles = computed(() => roles.value.filter((role) => role.builtin));
  const customRoles = computed(() => roles.value.filter((role) => !role.builtin));
  const pendingInvitations = computed(() =>
    invitations.value.filter((invitation) => invitation.status === 'pending')
  );
  const activeMembers = computed(() => members.value.filter((m) => m.status === 'active'));

  /** Synchronous check against the cached set; safe inside a render or directive. */
  function can(permission: string): boolean {
    return hasPermission(userPermissions.value, permission);
  }

  function canAny(permissions: readonly string[]): boolean {
    return permissions.some((permission) => can(permission));
  }

  function canAll(permissions: readonly string[]): boolean {
    return permissions.every((permission) => can(permission));
  }

  function roleName(roleId: string): string {
    return roles.value.find((role) => role.id === roleId)?.name ?? roleId;
  }

  function memberById(memberId: string): Member | undefined {
    return members.value.find((member) => member.id === memberId);
  }

  /* ------------------------------------------------------- error helper */

  function fail(unknownError: unknown): string {
    const key = apiErrorI18nKey(unknownError);
    error.value = key;
    return key;
  }

  /* -------------------------------------------- context and tenant header */

  /** Binds the http layer so every later request carries the tenant header. */
  function applyContext(next: OrgContext | null): void {
    context.value = next;
    writeOrgContext(next);
    setOrganizationHeader(next ? next.orgId : null);
  }

  /* ------------------------------------------------- organisation actions */

  async function fetchOrganizations(): Promise<Organization[]> {
    loading.value = true;
    error.value = null;
    try {
      organizations.value = await organizationApi.getOrganizations();
      demo.value = organizations.value.some((org) => org.demo === true);
      return organizations.value;
    } catch (unknownError) {
      fail(unknownError);
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchCurrentOrganization(): Promise<Organization | null> {
    loading.value = true;
    error.value = null;
    try {
      const org = await organizationApi.getCurrentOrganization();
      currentOrganization.value = org;
      if (org) {
        applyContext({
          orgId: org.id,
          orgName: org.name,
          roleId: org.myRoleId,
          roleKind: org.myRoleKind
        });
      } else {
        applyContext(null);
      }
      return org;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createOrganization(input: OrganizationInput): Promise<Organization | null> {
    saving.value = true;
    error.value = null;
    try {
      const created = await organizationApi.createOrganization(input);
      organizations.value = [...organizations.value, created];
      currentOrganization.value = created;
      applyContext({
        orgId: created.id,
        orgName: created.name,
        roleId: created.myRoleId,
        roleKind: created.myRoleKind
      });
      return created;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function updateOrganization(
    orgId: string,
    input: Partial<OrganizationInput>
  ): Promise<Organization | null> {
    saving.value = true;
    error.value = null;
    try {
      const updated = await organizationApi.updateOrganization(orgId, input);
      organizations.value = organizations.value.map((org) => (org.id === orgId ? updated : org));
      if (currentOrganization.value?.id === orgId) {
        currentOrganization.value = updated;
        if (context.value?.orgId === orgId) {
          applyContext({ ...context.value, orgName: updated.name });
        }
      }
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteOrganization(orgId: string): Promise<boolean> {
    saving.value = true;
    error.value = null;
    try {
      const ok = await organizationApi.deleteOrganization(orgId);
      organizations.value = organizations.value.filter((org) => org.id !== orgId);
      if (currentOrganization.value?.id === orgId) {
        currentOrganization.value = null;
        const next = organizations.value[0] ?? null;
        if (next) await switchOrganization(next.id);
        else applyContext(null);
      }
      return ok;
    } catch (unknownError) {
      fail(unknownError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function fetchOverview(orgId?: string): Promise<OrgOverviewStats> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return { ...EMPTY_OVERVIEW };
    try {
      overview.value = await organizationApi.getOrganizationOverview(target);
    } catch (unknownError) {
      fail(unknownError);
      overview.value = { ...EMPTY_OVERVIEW };
    }
    return overview.value;
  }

  async function fetchActivity(orgId?: string, limit = 10): Promise<OrgActivity[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return [];
    try {
      activity.value = await organizationApi.getOrganizationActivity(target, limit);
    } catch (unknownError) {
      fail(unknownError);
      activity.value = [];
    }
    return activity.value;
  }

  async function fetchSettings(orgId?: string): Promise<OrganizationSettings | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    loading.value = true;
    error.value = null;
    try {
      settings.value = await organizationApi.getOrganizationSettings(target);
      return settings.value;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateSettings(
    input: OrganizationSettingsInput,
    orgId?: string
  ): Promise<OrganizationSettings | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      settings.value = await organizationApi.updateOrganizationSettings(target, input);
      return settings.value;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function transferOwnership(memberId: string, orgId?: string): Promise<Organization | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await organizationApi.transferOwnership(target, memberId);
      currentOrganization.value = updated;
      organizations.value = organizations.value.map((org) => (org.id === target ? updated : org));
      applyContext({
        orgId: updated.id,
        orgName: updated.name,
        roleId: updated.myRoleId,
        roleKind: updated.myRoleKind
      });
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /* ------------------------------------------------------ member actions */

  async function fetchMembers(params?: MemberListParams, orgId?: string): Promise<Member[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return [];
    loading.value = true;
    error.value = null;
    try {
      const page = await memberApi.getMembers(target, {
        limit: MEMBER_PAGE_SIZE,
        ...params
      });
      if (params?.offset && params.offset > 0) {
        members.value = [...members.value, ...page.items];
      } else {
        members.value = page.items;
      }
      memberTotal.value = page.total;
      memberHasMore.value = page.hasMore;
      return members.value;
    } catch (unknownError) {
      fail(unknownError);
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreMembers(params?: MemberListParams, orgId?: string): Promise<void> {
    await fetchMembers({ ...params, offset: members.value.length }, orgId);
  }

  async function inviteMember(input: InvitationInput, orgId?: string): Promise<Invitation[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return [];
    saving.value = true;
    error.value = null;
    try {
      const created = await memberApi.inviteMember(target, input);
      invitations.value = [...created, ...invitations.value];
      return created;
    } catch (unknownError) {
      fail(unknownError);
      return [];
    } finally {
      saving.value = false;
    }
  }

  async function removeMember(memberId: string, orgId?: string): Promise<boolean> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return false;
    saving.value = true;
    error.value = null;
    try {
      const ok = await memberApi.removeMember(target, memberId);
      members.value = members.value.filter((member) => member.id !== memberId);
      memberTotal.value = Math.max(0, memberTotal.value - 1);
      if (currentOrganization.value?.id === target) {
        currentOrganization.value = {
          ...currentOrganization.value,
          memberCount: Math.max(0, currentOrganization.value.memberCount - 1)
        };
      }
      return ok;
    } catch (unknownError) {
      fail(unknownError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function updateMemberRole(
    memberId: string,
    roleId: string,
    orgId?: string
  ): Promise<Member | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await memberApi.updateMemberRole(target, memberId, { roleId });
      members.value = members.value.map((member) => (member.id === memberId ? updated : member));
      await fetchRoles(target);
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function setMemberStatus(
    memberId: string,
    status: MemberStatus,
    orgId?: string
  ): Promise<Member | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await memberApi.setMemberStatus(target, memberId, status);
      members.value = members.value.map((member) => (member.id === memberId ? updated : member));
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /* -------------------------------------------------- invitation actions */

  async function fetchInvitations(orgId?: string): Promise<Invitation[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return [];
    loading.value = true;
    error.value = null;
    try {
      invitations.value = await memberApi.getInvitations(target);
      return invitations.value;
    } catch (unknownError) {
      fail(unknownError);
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function cancelInvitation(invitationId: string, orgId?: string): Promise<boolean> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return false;
    saving.value = true;
    error.value = null;
    try {
      const ok = await memberApi.cancelInvitation(target, invitationId);
      invitations.value = invitations.value.map((invitation) =>
        invitation.id === invitationId ? { ...invitation, status: 'cancelled' } : invitation
      );
      return ok;
    } catch (unknownError) {
      fail(unknownError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function resendInvitation(invitationId: string, orgId?: string): Promise<Invitation | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await memberApi.resendInvitation(target, invitationId);
      invitations.value = invitations.value.map((invitation) =>
        invitation.id === invitationId ? updated : invitation
      );
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function fetchInvitationPreview(token: string): Promise<InvitationPreview | null> {
    loading.value = true;
    error.value = null;
    try {
      invitationPreview.value = await memberApi.getInvitationPreview(token);
      return invitationPreview.value;
    } catch (unknownError) {
      fail(unknownError);
      invitationPreview.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  /** Accepting joins the org, so the tenant context moves with it. */
  async function acceptInvitation(token: string): Promise<Member | null> {
    saving.value = true;
    error.value = null;
    try {
      const member = await memberApi.acceptInvitation(token);
      await fetchOrganizations();
      await switchOrganization(member.orgId);
      return member;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /* -------------------------------------------------------- role actions */

  async function fetchRoles(orgId?: string): Promise<Role[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return [];
    loading.value = true;
    error.value = null;
    try {
      roles.value = await roleApi.getRoles(target);
      return roles.value;
    } catch (unknownError) {
      fail(unknownError);
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchRole(roleId: string, orgId?: string): Promise<Role | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    loading.value = true;
    error.value = null;
    try {
      currentRole.value = await roleApi.getRole(target, roleId);
      return currentRole.value;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createRole(input: RoleInput, orgId?: string): Promise<Role | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const created = await roleApi.createRole(target, input);
      roles.value = [...roles.value, created];
      return created;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function updateRole(
    roleId: string,
    input: Partial<RoleInput>,
    orgId?: string
  ): Promise<Role | null> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await roleApi.updateRole(target, roleId, input);
      roles.value = roles.value.map((role) => (role.id === roleId ? updated : role));
      if (currentRole.value?.id === roleId) currentRole.value = updated;
      /* The signed-in user's own role changed, so the cached rights are stale. */
      if (updated.id === context.value?.roleId) await loadUserPermissions(target);
      return updated;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteRole(roleId: string, orgId?: string): Promise<boolean> {
    const target = orgId ?? currentOrgId.value;
    if (!target) return false;
    saving.value = true;
    error.value = null;
    try {
      const ok = await roleApi.deleteRole(target, roleId);
      roles.value = roles.value.filter((role) => role.id !== roleId);
      if (currentRole.value?.id === roleId) currentRole.value = null;
      return ok;
    } catch (unknownError) {
      fail(unknownError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /* -------------------------------------------------- permission actions */

  /** The catalog is tenant-independent, so it is fetched once per session. */
  let catalogPromise: Promise<PermissionGroup[]> | null = null;

  function fetchPermissions(): Promise<PermissionGroup[]> {
    catalogPromise ??= (async () => {
      try {
        permissionGroups.value = await permissionApi.getPermissions();
      } catch (unknownError) {
        fail(unknownError);
        permissionGroups.value = [];
      }
      return permissionGroups.value;
    })();
    return catalogPromise;
  }

  async function loadUserPermissions(orgId?: string): Promise<string[]> {
    const target = orgId ?? currentOrgId.value;
    if (!target) {
      userPermissions.value = [];
      return [];
    }
    try {
      userPermissions.value = await permissionApi.getUserPermissions(target);
    } catch (unknownError) {
      fail(unknownError);
      userPermissions.value = [];
    }
    return userPermissions.value;
  }

  /** Server-authoritative single check; the ui prefers the cached can(). */
  async function checkPermission(permission: string): Promise<PermissionCheckResult> {
    try {
      const result = await permissionApi.checkPermission(permission);
      if (result.allowed && !userPermissions.value.includes(permission)) {
        userPermissions.value = [...userPermissions.value, permission];
      }
      return result;
    } catch (unknownError) {
      fail(unknownError);
      return { permission, allowed: can(permission) };
    }
  }

  async function checkPermissions(permissions: string[]): Promise<PermissionCheckResult[]> {
    try {
      const results = await permissionApi.checkPermissions(permissions);
      const granted = results.filter((r) => r.allowed).map((r) => r.permission);
      if (granted.length > 0) {
        userPermissions.value = [...new Set([...userPermissions.value, ...granted])];
      }
      return results;
    } catch (unknownError) {
      fail(unknownError);
      return permissions.map((permission) => ({ permission, allowed: can(permission) }));
    }
  }

  /* ------------------------------------------------- tenant switch + boot */

  /**
   * Drops everything scoped to the previous tenant. Only marketing and workflow
   * publish a $reset, so those are cleared in-session and the rest is covered by
   * the reload the caller performs via reloadAfterSwitch().
   */
  function resetScopedStores(): string[] {
    const cleared = clearOrgScopedStorage();
    const resettable: string[] = [];
    try {
      useMarketingStore().$reset();
      resettable.push('marketing');
    } catch {
      /* store not installed in this test host */
    }
    try {
      useWorkflowStore().$reset();
      resettable.push('workflow');
    } catch {
      /* store not installed in this test host */
    }
    return [...cleared, ...resettable];
  }

  async function switchOrganization(orgId: string): Promise<OrgContext | null> {
    saving.value = true;
    error.value = null;
    try {
      const next = await organizationApi.switchOrganization(orgId);
      resetScopedStores();
      applyContext(next);
      /*
       * The target is normally in the cached list. When it is not - a freshly
       * accepted invitation, a stale list - falling back to the row we already
       * hold beats blanking the tenant after the server confirmed the switch.
       */
      const held = currentOrganization.value;
      const org =
        organizations.value.find((candidate) => candidate.id === orgId) ??
        (held?.id === orgId ? held : undefined);
      currentOrganization.value = org
        ? { ...org, myRoleId: next.roleId, myRoleKind: next.roleKind }
        : null;
      /* Cached rows belong to the old tenant; empty them before reloading. */
      members.value = [];
      invitations.value = [];
      roles.value = [];
      activity.value = [];
      overview.value = { ...EMPTY_OVERVIEW };
      settings.value = null;
      userPermissions.value = [];
      memberTotal.value = 0;
      memberHasMore.value = false;
      pendingReload.value = true;
      await Promise.all([loadUserPermissions(orgId), fetchRoles(orgId)]);
      return next;
    } catch (unknownError) {
      fail(unknownError);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Restores the session's tenant once: organisations first, then the active one,
   * then the rights that decide what the guards may allow. Safe to call from the
   * router guard on every navigation because the work is memoised.
   */
  function bootstrap(): Promise<void> {
    bootstrapped ??= (async () => {
      const list = await fetchOrganizations();
      if (list.length === 0) {
        currentOrganization.value = null;
        applyContext(null);
        return;
      }
      const stored = readOrgContext();
      const org = await fetchCurrentOrganization();
      if (!org && stored) {
        await switchOrganization(stored.orgId);
        pendingReload.value = false;
      }
      if (currentOrganization.value) {
        await Promise.all([
          loadUserPermissions(currentOrganization.value.id),
          fetchPermissions()
        ]);
      }
    })();
    return bootstrapped;
  }

  /** Called after logout so the next session cannot inherit a tenant. */
  function clearOrganization(): void {
    organizations.value = [];
    currentOrganization.value = null;
    members.value = [];
    invitations.value = [];
    roles.value = [];
    currentRole.value = null;
    activity.value = [];
    overview.value = { ...EMPTY_OVERVIEW };
    settings.value = null;
    userPermissions.value = [];
    permissionGroups.value = [];
    invitationPreview.value = null;
    memberTotal.value = 0;
    memberHasMore.value = false;
    error.value = null;
    pendingReload.value = false;
    bootstrapped = null;
    catalogPromise = null;
    clearOrgContext();
    applyContext(null);
  }

  /** Test seam: lets a spec drop the memoised bootstrap and re-resolve. */
  function invalidateBootstrap(): void {
    bootstrapped = null;
    catalogPromise = null;
  }

  function consumePendingReload(): boolean {
    const was = pendingReload.value;
    pendingReload.value = false;
    return was;
  }

  return {
    organizations,
    currentOrganization,
    context,
    members,
    memberTotal,
    memberHasMore,
    invitations,
    roles,
    currentRole,
    permissionGroups,
    userPermissions,
    activity,
    overview,
    settings,
    invitationPreview,
    loading,
    saving,
    error,
    demo,
    pendingReload,
    isAuthenticatedOrg,
    currentOrgId,
    currentOrgMembers,
    currentOrgRoles,
    currentUserPermissions,
    currentRoleKind,
    isOwner,
    isAdmin,
    canManage,
    canDestroy,
    hasDemoData,
    builtinRoles,
    customRoles,
    pendingInvitations,
    activeMembers,
    can,
    canAny,
    canAll,
    roleName,
    memberById,
    applyContext,
    fetchOrganizations,
    fetchCurrentOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    fetchOverview,
    fetchActivity,
    fetchSettings,
    updateSettings,
    transferOwnership,
    fetchMembers,
    loadMoreMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    setMemberStatus,
    fetchInvitations,
    cancelInvitation,
    resendInvitation,
    fetchInvitationPreview,
    acceptInvitation,
    fetchRoles,
    fetchRole,
    createRole,
    updateRole,
    deleteRole,
    fetchPermissions,
    loadUserPermissions,
    checkPermission,
    checkPermissions,
    resetScopedStores,
    switchOrganization,
    bootstrap,
    clearOrganization,
    invalidateBootstrap,
    consumePendingReload
  };
});

/** Route the reload lands on after a tenant switch. */
export const SWITCH_RELOAD_ROUTE = '/home';

/**
 * Performs the hard navigation that finishes a tenant switch. Kept outside the
 * store so the store stays pure and the view owns the browser side effect.
 */
export function reloadAfterSwitch(route: string = SWITCH_RELOAD_ROUTE): void {
  if (typeof window === 'undefined') return;
  window.location.assign(route);
}
