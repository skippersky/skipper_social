/**
 * Role and permission-catalog management (Sprint 13).
 *
 * Adds the one piece of state the role editor needs that a store should not hold:
 * the in-progress permission selection. The catalog itself is tenant-independent
 * and cached by the store, so opening the editor twice costs one request.
 */
import { computed, ref } from 'vue';
import { useOrganizationStore } from '../stores/organization';
import {
  countPermissions,
  isEditableRole,
  PERMISSION_GROUPS,
  presetForKind,
  sortRoles
} from '../lib/permissions';
import { validateRoleInput } from '../lib/organization';
import type { ValidationErrors } from '../lib/settingsValidation';
import type { OrgRoleKind, PermissionGroup, Role, RoleInput } from '../types';

export function useRole() {
  const store = useOrganizationStore();

  /** Scratch selection for the create/edit dialog; empty means "nothing open". */
  const draftPermissions = ref<string[]>([]);
  const draftId = ref<string | null>(null);

  const roles = computed(() => store.roles);
  const builtinRoles = computed(() => store.builtinRoles);
  const customRoles = computed(() => store.customRoles);
  const currentRole = computed(() => store.currentRole);
  const permissionGroups = computed<PermissionGroup[]>(
    () => (store.permissionGroups.length > 0 ? store.permissionGroups : PERMISSION_GROUPS)
  );
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);

  const sortedRoles = computed(() => sortRoles(roles.value));
  const draftCount = computed(() => countPermissions(draftPermissions.value));

  async function loadRoles(orgId?: string): Promise<Role[]> {
    return store.fetchRoles(orgId);
  }

  async function loadRole(roleId: string, orgId?: string): Promise<Role | null> {
    return store.fetchRole(roleId, orgId);
  }

  /** The catalog is fetched once per session; the store memoises the promise. */
  async function loadPermissions(): Promise<PermissionGroup[]> {
    return store.fetchPermissions();
  }

  function validate(input: RoleInput): ValidationErrors {
    const taken = roles.value
      .filter((role) => role.id !== draftId.value)
      .map((role) => role.name);
    return validateRoleInput(input, taken);
  }

  /** Opens the editor for an existing role, or blank for a new one. */
  function startEdit(role?: Role | null): void {
    draftId.value = role ? role.id : null;
    draftPermissions.value = role ? [...role.permissions] : [];
  }

  function closeEdit(): void {
    draftId.value = null;
    draftPermissions.value = [];
  }

  function togglePermission(key: string): void {
    draftPermissions.value = draftPermissions.value.includes(key)
      ? draftPermissions.value.filter((entry) => entry !== key)
      : [...draftPermissions.value, key];
  }

  /** Select or clear a whole group in one click. */
  function toggleGroup(groupKey: string): void {
    const keys = permissionGroups.value
      .find((group) => group.key === groupKey)
      ?.permissions.map((permission) => permission.key) ?? [];
    const allOn = keys.length > 0 && keys.every((key) => draftPermissions.value.includes(key));
    draftPermissions.value = allOn
      ? draftPermissions.value.filter((key) => !keys.includes(key))
      : [...new Set([...draftPermissions.value, ...keys])];
  }

  function isGroupComplete(groupKey: string): boolean {
    const keys = permissionGroups.value
      .find((group) => group.key === groupKey)
      ?.permissions.map((permission) => permission.key) ?? [];
    return keys.length > 0 && keys.every((key) => draftPermissions.value.includes(key));
  }

  function isPermissionSelected(key: string): boolean {
    return draftPermissions.value.includes(key);
  }

  async function createRole(input: RoleInput, orgId?: string): Promise<Role | null> {
    if (Object.keys(validate(input)).length > 0) return null;
    const created = await store.createRole(input, orgId);
    if (created) closeEdit();
    return created;
  }

  async function updateRole(
    roleId: string,
    input: Partial<RoleInput>,
    orgId?: string
  ): Promise<Role | null> {
    const target = roles.value.find((role) => role.id === roleId);
    if (target && !canEdit(target)) return null;
    const updated = await store.updateRole(roleId, input, orgId);
    if (updated) closeEdit();
    return updated;
  }

  async function deleteRole(roleId: string, orgId?: string): Promise<boolean> {
    const target = roles.value.find((role) => role.id === roleId);
    if (target && !canEdit(target)) return false;
    return store.deleteRole(roleId, orgId);
  }

  /** Built-ins are read-only, which is what the roles grid renders. */
  function canEdit(role: Pick<Role, 'builtin' | 'kind'>): boolean {
    return isEditableRole(role);
  }

  function canDelete(role: Role): boolean {
    return isEditableRole(role) && role.memberCount === 0;
  }

  /** Display name for a role id, falling back to the preset's i18n key. */
  function roleLabel(role: Pick<Role, 'name' | 'kind'>): string {
    if (!role.name.startsWith('org.role.')) return role.name;
    return role.name;
  }

  function permissionsFor(kind: OrgRoleKind): string[] {
    return presetForKind(kind)?.permissions ?? [];
  }

  return {
    roles,
    builtinRoles,
    customRoles,
    currentRole,
    permissionGroups,
    loading,
    saving,
    error,
    sortedRoles,
    draftPermissions,
    draftId,
    draftCount,
    loadRoles,
    loadRole,
    loadPermissions,
    validate,
    startEdit,
    closeEdit,
    togglePermission,
    toggleGroup,
    isGroupComplete,
    isPermissionSelected,
    createRole,
    updateRole,
    deleteRole,
    canEdit,
    canDelete,
    roleLabel,
    permissionsFor
  };
}
