/**
 * Permission catalog and built-in role presets (Sprint 13).
 *
 * Pure data plus pure functions: no store, no api, no Vue. The api layer seeds
 * its demo catalog from here and the server is expected to return the same keys,
 * so a permission string means the same thing on both paths.
 *
 * Labels are i18n keys, not display text. The ui translates them with
 * i18n.t(perm.label), which keeps this module free of any locale table and turns
 * a missing translation into a visible key rather than a silent English string.
 */
import type { OrgRoleKind, Permission, PermissionGroup, Role } from '../types';

/** Matches every permission; only the owner role carries it. */
export const WILDCARD = '*';

interface GroupSeed {
  key: string;
  actions: string[];
}

const GROUP_SEEDS: GroupSeed[] = [
  { key: 'customer', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'conversation', actions: ['view', 'reply', 'assign', 'delete'] },
  { key: 'analytics', actions: ['view', 'export'] },
  { key: 'marketing', actions: ['view', 'create', 'edit', 'delete', 'send'] },
  { key: 'workflow', actions: ['view', 'create', 'edit', 'delete', 'execute'] },
  { key: 'notification', actions: ['view', 'manage'] },
  { key: 'organization', actions: ['view_members', 'invite_members', 'manage_roles', 'update_settings'] },
  { key: 'settings', actions: ['view', 'update'] }
];

/** group:action, the only shape the catalog and the guards accept. */
export function permissionKey(group: string, action: string): string {
  return group + ':' + action;
}

export function isValidPermissionKey(key: string): boolean {
  const parts = key.split(':');
  return parts.length === 2 && parts[0] !== '' && parts[1] !== '' && !parts[1].includes('*');
}

function buildGroups(): PermissionGroup[] {
  return GROUP_SEEDS.map((seed) => ({
    key: seed.key,
    label: 'org.permGroup.' + seed.key,
    permissions: seed.actions.map((action) => ({
      key: permissionKey(seed.key, action),
      group: seed.key,
      label: 'org.perm.' + seed.key + '.' + action,
      description: 'org.permDesc.' + seed.key + '.' + action
    }))
  }));
}

/** The full catalog, grouped for the role editor tree. */
export const PERMISSION_GROUPS: PermissionGroup[] = buildGroups();

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);

export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSIONS.map((p) => p.key);

const KEY_SET = new Set(ALL_PERMISSION_KEYS);

export function isKnownPermission(key: string): boolean {
  return KEY_SET.has(key);
}

export function permissionsForGroup(groupKey: string): Permission[] {
  const found = PERMISSION_GROUPS.find((g) => g.key === groupKey);
  return found ? found.permissions : [];
}

/** Read-only view permissions, one per group that defines a 'view' action. */
export const VIEW_PERMISSION_KEYS: string[] = ALL_PERMISSION_KEYS.filter((k) => k.endsWith(':view'));

/** Everything except the organization group: the admin preset. */
const NON_ORG_KEYS: string[] = ALL_PERMISSION_KEYS.filter((k) => !k.startsWith('organization:'));

/** Day-to-day operating rights: the member preset. */
const MEMBER_KEYS: string[] = ALL_PERMISSION_KEYS.filter(
  (k) =>
    k.startsWith('customer:') ||
    k.startsWith('conversation:') ||
    k.startsWith('marketing:') ||
    k.startsWith('workflow:') ||
    k === 'analytics:view' ||
    k === 'notification:view'
);

export interface BuiltinRolePreset {
  kind: Exclude<OrgRoleKind, 'custom'>;
  id: string;
  nameKey: string;
  descriptionKey: string;
  permissions: string[];
}

/**
 * The four system roles. Owner holds the wildcard and is the only role that may
 * be transferred rather than edited; the other three are fixed lists so a
 * server that never returns them still yields a consistent catalog offline.
 */
export const BUILTIN_ROLE_PRESETS: BuiltinRolePreset[] = [
  {
    kind: 'owner',
    id: 'role-owner',
    nameKey: 'org.role.owner',
    descriptionKey: 'org.roleDesc.owner',
    permissions: [WILDCARD]
  },
  {
    kind: 'admin',
    id: 'role-admin',
    nameKey: 'org.role.admin',
    descriptionKey: 'org.roleDesc.admin',
    permissions: NON_ORG_KEYS
  },
  {
    kind: 'member',
    id: 'role-member',
    nameKey: 'org.role.member',
    descriptionKey: 'org.roleDesc.member',
    permissions: MEMBER_KEYS
  },
  {
    kind: 'viewer',
    id: 'role-viewer',
    nameKey: 'org.role.viewer',
    descriptionKey: 'org.roleDesc.viewer',
    permissions: VIEW_PERMISSION_KEYS
  }
];

export function presetForKind(kind: OrgRoleKind): BuiltinRolePreset | undefined {
  return BUILTIN_ROLE_PRESETS.find((p) => p.kind === kind);
}

export function isBuiltinRoleId(roleId: string): boolean {
  return BUILTIN_ROLE_PRESETS.some((p) => p.id === roleId);
}

/** A wildcard grants everything, so matching short-circuits on it. */
export function grantsAll(permissions: readonly string[]): boolean {
  return permissions.includes(WILDCARD);
}

export function hasPermission(permissions: readonly string[], key: string): boolean {
  if (grantsAll(permissions)) return true;
  if (permissions.includes(key)) return true;
  const group = key.split(':')[0];
  return permissions.includes(group + ':*');
}

export function hasAnyPermission(permissions: readonly string[], keys: readonly string[]): boolean {
  return keys.some((key) => hasPermission(permissions, key));
}

export function hasAllPermissions(permissions: readonly string[], keys: readonly string[]): boolean {
  return keys.every((key) => hasPermission(permissions, key));
}

/** Expands wildcards so a count or a checklist can be shown to the user. */
export function expandPermissions(permissions: readonly string[]): string[] {
  if (grantsAll(permissions)) return [...ALL_PERMISSION_KEYS];
  const out = new Set<string>();
  for (const entry of permissions) {
    if (entry === WILDCARD) continue;
    if (entry.endsWith(':*')) {
      for (const key of ALL_PERMISSION_KEYS) {
        if (key.startsWith(entry.slice(0, -1))) out.add(key);
      }
      continue;
    }
    if (isKnownPermission(entry)) out.add(entry);
  }
  return [...out];
}

export function countPermissions(permissions: readonly string[]): number {
  return grantsAll(permissions) ? ALL_PERMISSION_KEYS.length : expandPermissions(permissions).length;
}

/** True when the role may be renamed, re-scoped or deleted. */
export function isEditableRole(role: Pick<Role, 'builtin' | 'kind'>): boolean {
  return !role.builtin && role.kind === 'custom';
}

/** Owners and admins may reach the organisation pages; nobody else may. */
export function canManageOrganization(roleKind: OrgRoleKind): boolean {
  return roleKind === 'owner' || roleKind === 'admin';
}

/** Only the owner may transfer ownership or delete the organisation. */
export function canDestroyOrganization(roleKind: OrgRoleKind): boolean {
  return roleKind === 'owner';
}

/** Preset ordering for the role grid: most privileged first. */
export const ROLE_KIND_ORDER: Record<OrgRoleKind, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
  custom: 4
};

export function sortRoles(roles: readonly Role[]): Role[] {
  return [...roles].sort((a, b) => {
    const byKind = ROLE_KIND_ORDER[a.kind] - ROLE_KIND_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    return a.name.localeCompare(b.name);
  });
}
