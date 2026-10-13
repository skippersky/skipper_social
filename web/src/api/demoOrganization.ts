/**
 * On-device organisation directory (Sprint 13).
 *
 * The localStorage-backed twin of the tenant endpoints, reached only when the
 * backend is missing, exactly like demoWorkflow and demoMarketing. It exists so
 * every organisation page, the permission directive and the tenant switch stay
 * demonstrable and testable with no server, no database and no network.
 *
 * Backward compatibility lives in seed(): a user with no organisation is given
 * the default one and becomes its owner, which is the migration the spec asks
 * for. Nothing here mutates the accepted demo user directory; it only reads the
 * current identity through api/auth so the owner is whoever is signed in.
 */
import { ApiError } from './http';
import { demoCurrentUser } from './auth';
import {
  ACTIVE_MEMBER_WINDOW_MS,
  countActiveMembers,
  memberMatchesQuery,
  ORG_PAGE_SIZE,
  readOrgContext,
  writeOrgContext
} from '../lib/organization';
import {
  ALL_PERMISSION_KEYS,
  BUILTIN_ROLE_PRESETS,
  expandPermissions,
  hasPermission,
  PERMISSION_GROUPS,
  presetForKind,
  sortRoles,
  WILDCARD
} from '../lib/permissions';
import type {
  Invitation,
  InvitationInput,
  InvitationPreview,
  Member,
  MemberListParams,
  OrgActivity,
  OrgActivityKind,
  OrgContext,
  OrgOverviewStats,
  Organization,
  OrganizationInput,
  OrganizationSettings,
  OrganizationSettingsInput,
  OrgRoleKind,
  PagedMembers,
  PermissionCheckResult,
  PermissionGroup,
  Role,
  RoleInput
} from '../types';

const MODE_KEY = 'ks-demo-mode';
const ORGS_KEY = 'ks-demo-orgs';
const MEMBERS_KEY = 'ks-demo-org-members';
const INVITES_KEY = 'ks-demo-org-invitations';
const ROLES_KEY = 'ks-demo-org-roles';
const ACTIVITY_KEY = 'ks-demo-org-activity';
const SETTINGS_KEY = 'ks-demo-org-settings';

/** Invitation lifetime; matches the expiry the server is expected to apply. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_ORG_ID = 'org-default';
export const DEFAULT_ORG_NAME = 'KiliSocial Demo';

const DAY_MS = 24 * 60 * 60 * 1000;

function enterDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode */
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the current session still works from memory-free reads */
  }
}

function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

function actorName(): string {
  const user = demoCurrentUser();
  return user ? user.nickname || user.email : 'Demo Merchant';
}

function actorId(): string {
  return demoCurrentUser()?.id ?? 'demo-1';
}

export function defaultSettings(): OrganizationSettings {
  return {
    security: { twoFactorRequired: false, ipAllowlist: [], sessionTimeoutMinutes: 60 },
    notifications: {
      memberJoined: true,
      memberRemoved: true,
      roleChanged: true,
      criticalAction: true
    },
    data: { messageRetentionDays: 180, logRetentionDays: 90 }
  };
}

/** Built-in roles are derived, never stored, so they can never drift or be lost. */
function builtinRoles(orgId: string): Role[] {
  return BUILTIN_ROLE_PRESETS.map((preset) => ({
    id: preset.id,
    orgId,
    name: preset.nameKey,
    description: preset.descriptionKey,
    kind: preset.kind,
    builtin: true,
    permissions: [...preset.permissions],
    memberCount: 0
  }));
}

interface SeedMember {
  name: string;
  email: string;
  kind: OrgRoleKind;
  status: Member['status'];
  joinedDaysAgo: number;
  lastLoginDaysAgo?: number;
}

const SEED_MEMBERS: SeedMember[] = [
  { name: 'Amina Hassan', email: 'amina@kilisocial.app', kind: 'admin', status: 'active', joinedDaysAgo: 120, lastLoginDaysAgo: 0 },
  { name: 'Joseph Mwangi', email: 'joseph@kilisocial.app', kind: 'member', status: 'active', joinedDaysAgo: 96, lastLoginDaysAgo: 2 },
  { name: 'Neema Charles', email: 'neema@kilisocial.app', kind: 'member', status: 'active', joinedDaysAgo: 61, lastLoginDaysAgo: 5 },
  { name: 'Grace Okello', email: 'grace@kilisocial.app', kind: 'viewer', status: 'active', joinedDaysAgo: 40, lastLoginDaysAgo: 21 },
  { name: 'Daniel Kimaro', email: 'daniel@kilisocial.app', kind: 'member', status: 'disabled', joinedDaysAgo: 200, lastLoginDaysAgo: 88 },
  { name: 'Fatuma Ali', email: 'fatuma@kilisocial.app', kind: 'custom', status: 'active', joinedDaysAgo: 18, lastLoginDaysAgo: 1 }
];

function roleIdForKind(kind: OrgRoleKind): string {
  return presetForKind(kind === 'custom' ? 'member' : kind)?.id ?? 'role-custom-support';
}

function seed(now: number): void {
  const orgId = DEFAULT_ORG_ID;
  const owner: Organization = {
    id: orgId,
    name: DEFAULT_ORG_NAME,
    description: 'Default organisation created for the signed-in account.',
    ownerId: actorId(),
    memberCount: SEED_MEMBERS.length + 1,
    myRoleId: 'role-owner',
    myRoleKind: 'owner',
    createdAt: now - 140 * DAY_MS,
    demo: true
  };
  write(ORGS_KEY, [owner]);

  const members: Member[] = [
    {
      id: 'mem-self',
      orgId,
      userId: actorId(),
      name: actorName(),
      email: demoCurrentUser()?.email ?? 'demo@kilisocial.app',
      roleId: 'role-owner',
      roleKind: 'owner',
      status: 'active',
      joinedAt: now - 140 * DAY_MS,
      lastLoginAt: now - 60 * 60 * 1000
    },
    ...SEED_MEMBERS.map((seedMember, index) => ({
      id: 'mem-' + (index + 1),
      orgId,
      userId: 'user-' + (index + 1),
      name: seedMember.name,
      email: seedMember.email,
      roleId: seedMember.kind === 'custom' ? 'role-custom-support' : roleIdForKind(seedMember.kind),
      roleKind: seedMember.kind,
      status: seedMember.status,
      joinedAt: now - seedMember.joinedDaysAgo * DAY_MS,
      lastLoginAt:
        seedMember.lastLoginDaysAgo === undefined
          ? undefined
          : now - seedMember.lastLoginDaysAgo * DAY_MS
    }))
  ];
  write(MEMBERS_KEY, members);

  const roles: Role[] = [
    {
      id: 'role-custom-support',
      orgId,
      name: 'Support Lead',
      description: 'Handles every conversation and may export the customer list.',
      kind: 'custom',
      builtin: false,
      permissions: [
        'conversation:view',
        'conversation:reply',
        'conversation:assign',
        'customer:view',
        'customer:edit',
        'customer:export',
        'notification:view'
      ],
      memberCount: 1
    }
  ];
  write(ROLES_KEY, roles);

  const invitations: Invitation[] = [
    {
      id: 'inv-1',
      orgId,
      email: 'baraka@kilisocial.app',
      roleId: 'role-member',
      roleKind: 'member',
      invitedByName: actorName(),
      message: 'Join us for the Dar es Salaam launch week.',
      token: 'demo-token-pending',
      status: 'pending',
      createdAt: now - 2 * DAY_MS,
      expiresAt: now - 2 * DAY_MS + INVITATION_TTL_MS
    },
    {
      id: 'inv-2',
      orgId,
      email: 'zawadi@kilisocial.app',
      roleId: 'role-viewer',
      roleKind: 'viewer',
      invitedByName: actorName(),
      token: 'demo-token-expired',
      status: 'expired',
      createdAt: now - 20 * DAY_MS,
      expiresAt: now - 13 * DAY_MS
    },
    {
      id: 'inv-3',
      orgId,
      email: 'salma@kilisocial.app',
      roleId: 'role-admin',
      roleKind: 'admin',
      invitedByName: actorName(),
      token: 'demo-token-cancelled',
      status: 'cancelled',
      createdAt: now - 9 * DAY_MS,
      expiresAt: now - 2 * DAY_MS
    }
  ];
  write(INVITES_KEY, invitations);

  const kinds: OrgActivityKind[] = [
    'org_created',
    'member_joined',
    'role_created',
    'invitation_sent',
    'role_changed',
    'settings_updated',
    'member_joined',
    'member_disabled'
  ];
  const activity: OrgActivity[] = kinds.map((kind, index) => ({
    id: 'act-' + (index + 1),
    orgId,
    kind,
    actorName: index % 2 === 0 ? actorName() : 'Amina Hassan',
    targetName: index === 1 ? 'Joseph Mwangi' : index === 4 ? 'Neema Charles' : undefined,
    createdAt: now - (index + 1) * 9 * 60 * 60 * 1000
  }));
  write(ACTIVITY_KEY, activity);

  const settings: Record<string, OrganizationSettings> = { [orgId]: defaultSettings() };
  write(SETTINGS_KEY, settings);
}

/** Idempotent: seeds once, then every later read is a plain storage read. */
function ensureSeeded(): void {
  enterDemoMode();
  const orgs = read<Organization[] | null>(ORGS_KEY, null);
  if (orgs === null || orgs.length === 0) seed(Date.now());
}

function orgs(): Organization[] {
  ensureSeeded();
  return read<Organization[]>(ORGS_KEY, []);
}

function allMembers(): Member[] {
  ensureSeeded();
  return read<Member[]>(MEMBERS_KEY, []);
}

function allInvitations(): Invitation[] {
  ensureSeeded();
  return read<Invitation[]>(INVITES_KEY, []);
}

function customRoles(): Role[] {
  ensureSeeded();
  return read<Role[]>(ROLES_KEY, []);
}

function allActivity(): OrgActivity[] {
  ensureSeeded();
  return read<OrgActivity[]>(ACTIVITY_KEY, []);
}

function requireOrg(orgId: string): Organization {
  const found = orgs().find((o) => o.id === orgId);
  if (!found) throw new ApiError('NOT_FOUND', 'organisation not found');
  return found;
}

/** Built-ins first, then this organisation's custom roles, with live counts. */
function rolesFor(orgId: string): Role[] {
  const members = allMembers().filter((m) => m.orgId === orgId);
  const countFor = (roleId: string) => members.filter((m) => m.roleId === roleId).length;
  const builtins = builtinRoles(orgId).map((role) => ({ ...role, memberCount: countFor(role.id) }));
  const customs = customRoles()
    .filter((role) => role.orgId === orgId)
    .map((role) => ({ ...role, permissions: [...role.permissions], memberCount: countFor(role.id) }));
  return sortRoles([...builtins, ...customs]);
}

function roleById(orgId: string, roleId: string): Role {
  const found = rolesFor(orgId).find((r) => r.id === roleId);
  if (!found) throw new ApiError('NOT_FOUND', 'role not found');
  return found;
}

function logActivity(orgId: string, kind: OrgActivityKind, targetName?: string, detail?: string): OrgActivity {
  const entry: OrgActivity = {
    id: uid('act'),
    orgId,
    kind,
    actorName: actorName(),
    targetName,
    detail,
    createdAt: Date.now()
  };
  write(ACTIVITY_KEY, [entry, ...allActivity()].slice(0, 60));
  return entry;
}

/** Refreshes the persisted org context so a reload keeps the same tenant. */
function syncContext(org: Organization, role: Role): OrgContext {
  const context: OrgContext = {
    orgId: org.id,
    orgName: org.name,
    roleId: role.id,
    roleKind: role.kind
  };
  writeOrgContext(context);
  return context;
}

/** The org the user was last in, or the first one they belong to. */
function resolveCurrentOrgId(): string | null {
  const list = orgs();
  if (list.length === 0) return null;
  const stored = readOrgContext();
  if (stored && list.some((o) => o.id === stored.orgId)) return stored.orgId;
  return list[0].id;
}

/* -------------------------------------------------------- organisations */

export function demoOrganizations(): Organization[] {
  return orgs().map((org) => ({ ...org }));
}

export function demoCurrentOrganization(orgId?: string | null): Organization | null {
  const target = orgId ?? resolveCurrentOrgId();
  if (!target) return null;
  const found = orgs().find((o) => o.id === target);
  return found ? { ...found } : null;
}

export function demoOrganizationById(orgId: string): Organization {
  return { ...requireOrg(orgId) };
}

export function demoCreateOrganization(input: OrganizationInput): Organization {
  const now = Date.now();
  const id = uid('org');
  const org: Organization = {
    id,
    name: input.name.trim(),
    logoUrl: input.logoUrl,
    description: input.description?.trim() || undefined,
    ownerId: actorId(),
    memberCount: 1,
    myRoleId: 'role-owner',
    myRoleKind: 'owner',
    createdAt: now,
    demo: true
  };
  write(ORGS_KEY, [...orgs(), org]);

  const self: Member = {
    id: uid('mem'),
    orgId: id,
    userId: actorId(),
    name: actorName(),
    email: demoCurrentUser()?.email ?? 'demo@kilisocial.app',
    roleId: 'role-owner',
    roleKind: 'owner',
    status: 'active',
    joinedAt: now,
    lastLoginAt: now
  };
  write(MEMBERS_KEY, [...allMembers(), self]);
  logActivity(id, 'org_created', org.name);
  syncContext(org, roleById(id, 'role-owner'));
  return { ...org };
}

export function demoUpdateOrganization(orgId: string, input: Partial<OrganizationInput>): Organization {
  const target = requireOrg(orgId);
  const updated: Organization = {
    ...target,
    name: input.name !== undefined ? input.name.trim() : target.name,
    logoUrl: input.logoUrl !== undefined ? input.logoUrl : target.logoUrl,
    description: input.description !== undefined ? input.description.trim() : target.description
  };
  write(ORGS_KEY, orgs().map((o) => (o.id === orgId ? updated : o)));
  const context = readOrgContext();
  if (context && context.orgId === orgId) {
    writeOrgContext({ ...context, orgName: updated.name });
  }
  return { ...updated };
}

export function demoDeleteOrganization(orgId: string): boolean {
  const target = requireOrg(orgId);
  if (target.myRoleKind !== 'owner') {
    throw new ApiError('FORBIDDEN', 'only the owner can delete an organisation');
  }
  write(ORGS_KEY, orgs().filter((o) => o.id !== orgId));
  write(MEMBERS_KEY, allMembers().filter((m) => m.orgId !== orgId));
  write(INVITES_KEY, allInvitations().filter((i) => i.orgId !== orgId));
  write(ROLES_KEY, customRoles().filter((r) => r.orgId !== orgId));
  write(ACTIVITY_KEY, allActivity().filter((a) => a.orgId !== orgId));
  const settings = read<Record<string, OrganizationSettings>>(SETTINGS_KEY, {});
  delete settings[orgId];
  write(SETTINGS_KEY, settings);
  const context = readOrgContext();
  if (!context || context.orgId !== orgId) return true;
  const next = orgs()[0];
  if (next) syncContext(next, roleById(next.id, next.myRoleId));
  else writeOrgContext(null);
  return true;
}

export function demoSwitchOrganization(orgId: string): OrgContext {
  const org = requireOrg(orgId);
  const self = allMembers().find((m) => m.orgId === orgId && m.userId === actorId());
  const roleId = self?.roleId ?? org.myRoleId;
  return syncContext({ ...org, myRoleId: roleId }, roleById(orgId, roleId));
}

export function demoOrganizationSettings(orgId: string): OrganizationSettings {
  requireOrg(orgId);
  const all = read<Record<string, OrganizationSettings>>(SETTINGS_KEY, {});
  const found = all[orgId];
  return found ? JSON.parse(JSON.stringify(found)) as OrganizationSettings : defaultSettings();
}

export function demoUpdateOrganizationSettings(
  orgId: string,
  input: OrganizationSettingsInput
): OrganizationSettings {
  requireOrg(orgId);
  const current = demoOrganizationSettings(orgId);
  const next: OrganizationSettings = {
    security: { ...current.security, ...(input.security ?? {}) },
    notifications: { ...current.notifications, ...(input.notifications ?? {}) },
    data: { ...current.data, ...(input.data ?? {}) }
  };
  next.security.ipAllowlist = [...(input.security?.ipAllowlist ?? current.security.ipAllowlist)];
  const all = read<Record<string, OrganizationSettings>>(SETTINGS_KEY, {});
  all[orgId] = next;
  write(SETTINGS_KEY, all);
  logActivity(orgId, 'settings_updated');
  return JSON.parse(JSON.stringify(next)) as OrganizationSettings;
}

export function demoOverviewStats(orgId: string, now: number = Date.now()): OrgOverviewStats {
  requireOrg(orgId);
  const members = allMembers().filter((m) => m.orgId === orgId);
  const pending = allInvitations().filter((i) => i.orgId === orgId && i.status === 'pending');
  return {
    totalMembers: members.length,
    activeMembers: countActiveMembers(members, now),
    customRoles: customRoles().filter((r) => r.orgId === orgId).length,
    pendingInvitations: pending.length
  };
}

export function demoOrgActivity(orgId: string, limit = 10): OrgActivity[] {
  return allActivity()
    .filter((a) => a.orgId === orgId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((a) => ({ ...a }));
}

export function demoTransferOwnership(orgId: string, memberId: string): Organization {
  const org = requireOrg(orgId);
  if (org.myRoleKind !== 'owner') {
    throw new ApiError('FORBIDDEN', 'only the owner can transfer ownership');
  }
  const members = allMembers().filter((m) => m.orgId === orgId);
  const target = members.find((m) => m.id === memberId);
  if (!target) throw new ApiError('NOT_FOUND', 'member not found');
  if (target.userId === org.ownerId) {
    throw new ApiError('CONFLICT', 'that member already owns the organisation');
  }
  const previousOwner = members.find((m) => m.userId === org.ownerId);
  const nextMembers = members.map((m) => {
    if (m.id === target.id) return { ...m, roleId: 'role-owner', roleKind: 'owner' as OrgRoleKind };
    if (previousOwner && m.id === previousOwner.id) {
      return { ...m, roleId: 'role-admin', roleKind: 'admin' as OrgRoleKind };
    }
    return m;
  });
  write(MEMBERS_KEY, [
    ...allMembers().filter((m) => m.orgId !== orgId),
    ...nextMembers
  ]);
  const updated: Organization = {
    ...org,
    ownerId: target.userId,
    myRoleId: 'role-admin',
    myRoleKind: 'admin'
  };
  write(ORGS_KEY, orgs().map((o) => (o.id === orgId ? updated : o)));
  logActivity(orgId, 'ownership_transferred', target.name);
  return { ...updated };
}

/* -------------------------------------------------------------- members */

export function demoMembers(orgId: string, params?: MemberListParams): PagedMembers {
  requireOrg(orgId);
  const limit = params?.limit ?? ORG_PAGE_SIZE;
  const offset = params?.offset ?? 0;
  const query = params?.query ?? '';
  const status = params?.status ?? 'all';
  const filtered = allMembers()
    .filter((m) => m.orgId === orgId)
    .filter((m) => memberMatchesQuery(m, query))
    .filter((m) => status === 'all' || m.status === status)
    .filter((m) => (params?.roleId ? m.roleId === params.roleId : true))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const items = filtered.slice(offset, offset + limit).map((m) => ({ ...m }));
  return { items, total: filtered.length, hasMore: offset + items.length < filtered.length };
}

export function demoMemberById(orgId: string, memberId: string): Member {
  const found = allMembers().find((m) => m.orgId === orgId && m.id === memberId);
  if (!found) throw new ApiError('NOT_FOUND', 'member not found');
  return { ...found };
}

export function demoUpdateMemberRole(orgId: string, memberId: string, roleId: string): Member {
  const org = requireOrg(orgId);
  const role = roleById(orgId, roleId);
  const members = allMembers().filter((m) => m.orgId === orgId);
  const target = members.find((m) => m.id === memberId);
  if (!target) throw new ApiError('NOT_FOUND', 'member not found');
  if (target.userId === org.ownerId) {
    throw new ApiError('CONFLICT', 'transfer ownership before changing the owner role');
  }
  const updated: Member = { ...target, roleId: role.id, roleKind: role.kind };
  write(MEMBERS_KEY, allMembers().map((m) => (m.id === memberId ? updated : m)));
  logActivity(orgId, 'role_changed', target.name, role.name);
  return { ...updated };
}

export function demoSetMemberStatus(orgId: string, memberId: string, status: Member['status']): Member {
  const org = requireOrg(orgId);
  const target = demoMemberById(orgId, memberId);
  if (target.userId === org.ownerId) {
    throw new ApiError('CONFLICT', 'the owner cannot be disabled');
  }
  const updated: Member = { ...target, status };
  write(MEMBERS_KEY, allMembers().map((m) => (m.id === memberId ? updated : m)));
  logActivity(orgId, status === 'active' ? 'member_joined' : 'member_disabled', target.name);
  return { ...updated };
}

export function demoRemoveMember(orgId: string, memberId: string): boolean {
  const org = requireOrg(orgId);
  const target = demoMemberById(orgId, memberId);
  if (target.userId === org.ownerId) {
    throw new ApiError('CONFLICT', 'the owner cannot be removed');
  }
  write(MEMBERS_KEY, allMembers().filter((m) => !(m.orgId === orgId && m.id === memberId)));
  write(ORGS_KEY, orgs().map((o) =>
    o.id === orgId ? { ...o, memberCount: Math.max(0, o.memberCount - 1) } : o
  ));
  logActivity(orgId, 'member_removed', target.name);
  return true;
}

/* ----------------------------------------------------------- invitations */

function refreshExpiry(invitation: Invitation, now: number): Invitation {
  if (invitation.status === 'pending' && invitation.expiresAt <= now) {
    return { ...invitation, status: 'expired' };
  }
  return invitation;
}

/** Pending invitations age into expired on read, so the panel is never stale. */
export function demoInvitations(orgId: string, now: number = Date.now()): Invitation[] {
  requireOrg(orgId);
  const refreshed = allInvitations()
    .filter((i) => i.orgId === orgId)
    .map((i) => refreshExpiry(i, now));
  write(INVITES_KEY, [
    ...allInvitations().filter((i) => i.orgId !== orgId),
    ...refreshed
  ]);
  return refreshed.sort((a, b) => b.createdAt - a.createdAt).map((i) => ({ ...i }));
}

export function demoInviteMember(orgId: string, input: InvitationInput): Invitation[] {
  const org = requireOrg(orgId);
  const role = roleById(orgId, input.roleId);
  const now = Date.now();
  const taken = new Set(
    allMembers().filter((m) => m.orgId === orgId).map((m) => m.email.toLowerCase())
  );
  const created: Invitation[] = [];
  for (const raw of input.emails) {
    const email = raw.trim();
    if (email === '' || taken.has(email.toLowerCase())) continue;
    created.push({
      id: uid('inv'),
      orgId,
      email,
      roleId: role.id,
      roleKind: role.kind,
      invitedByName: actorName(),
      message: input.message?.trim() || undefined,
      token: uid('tok'),
      status: 'pending',
      createdAt: now,
      expiresAt: now + INVITATION_TTL_MS
    });
  }
  if (created.length === 0) {
    throw new ApiError('CONFLICT', 'every address is already a member');
  }
  write(INVITES_KEY, [...created, ...allInvitations()]);
  void org;
  for (const invitation of created) logActivity(orgId, 'invitation_sent', invitation.email);
  return created.map((i) => ({ ...i }));
}

export function demoCancelInvitation(orgId: string, invitationId: string): boolean {
  const found = allInvitations().find((i) => i.orgId === orgId && i.id === invitationId);
  if (!found) throw new ApiError('NOT_FOUND', 'invitation not found');
  if (found.status !== 'pending') {
    throw new ApiError('CONFLICT', 'only a pending invitation can be cancelled');
  }
  write(INVITES_KEY, allInvitations().map((i) =>
    i.id === invitationId ? { ...i, status: 'cancelled' as Invitation['status'] } : i
  ));
  logActivity(orgId, 'invitation_cancelled', found.email);
  return true;
}

export function demoResendInvitation(orgId: string, invitationId: string): Invitation {
  const found = allInvitations().find((i) => i.orgId === orgId && i.id === invitationId);
  if (!found) throw new ApiError('NOT_FOUND', 'invitation not found');
  const now = Date.now();
  const updated: Invitation = {
    ...found,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITATION_TTL_MS,
    token: uid('tok')
  };
  write(INVITES_KEY, allInvitations().map((i) => (i.id === invitationId ? updated : i)));
  logActivity(orgId, 'invitation_sent', updated.email);
  return { ...updated };
}

export function demoInvitationPreview(token: string, now: number = Date.now()): InvitationPreview {
  const found = allInvitations().find((i) => i.token === token);
  if (!found) throw new ApiError('NOT_FOUND', 'invitation not found');
  const live = refreshExpiry(found, now);
  if (live.status !== found.status) {
    write(INVITES_KEY, allInvitations().map((i) => (i.id === live.id ? live : i)));
  }
  const org = requireOrg(live.orgId);
  const role = roleById(live.orgId, live.roleId);
  return {
    token: live.token,
    orgName: org.name,
    orgLogoUrl: org.logoUrl,
    inviterName: live.invitedByName,
    roleName: role.name,
    roleKind: role.kind,
    email: live.email,
    status: live.status,
    expiresAt: live.expiresAt
  };
}

/** Accepting turns an invitation into a membership and switches the tenant. */
export function demoAcceptInvitation(token: string, now: number = Date.now()): Member {
  const found = allInvitations().find((i) => i.token === token);
  if (!found) throw new ApiError('NOT_FOUND', 'invitation not found');
  const live = refreshExpiry(found, now);
  if (live.status !== 'pending') {
    throw new ApiError('CONFLICT', 'invitation is no longer pending');
  }
  const org = requireOrg(live.orgId);
  const role = roleById(live.orgId, live.roleId);
  const existing = allMembers().find(
    (m) => m.orgId === live.orgId && m.email.toLowerCase() === live.email.toLowerCase()
  );
  if (existing) {
    write(INVITES_KEY, allInvitations().map((i) =>
      i.id === live.id ? { ...i, status: 'accepted' as Invitation['status'] } : i
    ));
    return { ...existing };
  }
  const member: Member = {
    id: uid('mem'),
    orgId: live.orgId,
    userId: actorId(),
    name: actorName(),
    email: live.email,
    roleId: role.id,
    roleKind: role.kind,
    status: 'active',
    joinedAt: now,
    lastLoginAt: now
  };
  write(MEMBERS_KEY, [...allMembers(), member]);
  write(INVITES_KEY, allInvitations().map((i) =>
    i.id === live.id ? { ...i, status: 'accepted' as Invitation['status'] } : i
  ));
  write(ORGS_KEY, orgs().map((o) =>
    o.id === org.id ? { ...o, memberCount: o.memberCount + 1 } : o
  ));
  logActivity(live.orgId, 'member_joined', member.name);
  return { ...member };
}

/* ------------------------------------------------------------------ roles */

export function demoRoles(orgId: string): Role[] {
  requireOrg(orgId);
  return rolesFor(orgId);
}

export function demoRoleById(orgId: string, roleId: string): Role {
  requireOrg(orgId);
  return roleById(orgId, roleId);
}

export function demoCreateRole(orgId: string, input: RoleInput): Role {
  requireOrg(orgId);
  const role: Role = {
    id: uid('role'),
    orgId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    kind: 'custom',
    builtin: false,
    permissions: [...new Set(input.permissions)],
    memberCount: 0
  };
  write(ROLES_KEY, [...customRoles(), role]);
  logActivity(orgId, 'role_created', role.name);
  return { ...role, permissions: [...role.permissions] };
}

export function demoUpdateRole(orgId: string, roleId: string, input: Partial<RoleInput>): Role {
  const existing = roleById(orgId, roleId);
  if (existing.builtin) {
    throw new ApiError('FORBIDDEN', 'built-in roles cannot be modified');
  }
  const updated: Role = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    description: input.description !== undefined ? input.description.trim() : existing.description,
    permissions: input.permissions ? [...new Set(input.permissions)] : existing.permissions
  };
  write(ROLES_KEY, customRoles().map((r) => (r.id === roleId ? updated : r)));
  logActivity(orgId, 'role_updated', updated.name);
  return { ...updated, permissions: [...updated.permissions] };
}

export function demoDeleteRole(orgId: string, roleId: string): boolean {
  const existing = roleById(orgId, roleId);
  if (existing.builtin) {
    throw new ApiError('FORBIDDEN', 'built-in roles cannot be deleted');
  }
  if (existing.memberCount > 0) {
    throw new ApiError('CONFLICT', 'reassign every member before deleting the role');
  }
  write(ROLES_KEY, customRoles().filter((r) => r.id !== roleId));
  logActivity(orgId, 'role_deleted', existing.name);
  return true;
}

/* ------------------------------------------------------------ permissions */

export function demoPermissionGroups(): PermissionGroup[] {
  return JSON.parse(JSON.stringify(PERMISSION_GROUPS)) as PermissionGroup[];
}

/**
 * Permissions of the signed-in user inside one organisation. The owner wildcard
 * is expanded here so the ui can render a checklist without knowing about '*'.
 */
export function demoUserPermissions(orgId: string): string[] {
  const org = requireOrg(orgId);
  const self = allMembers().find((m) => m.orgId === orgId && m.userId === actorId());
  const roleId = self?.roleId ?? org.myRoleId;
  const role = roleById(orgId, roleId);
  return role.permissions.includes(WILDCARD) ? [...ALL_PERMISSION_KEYS] : expandPermissions(role.permissions);
}

export function demoCheckPermission(orgId: string, permission: string): PermissionCheckResult {
  return { permission, allowed: hasPermission(demoUserPermissions(orgId), permission) };
}

export function demoCheckPermissions(
  orgId: string,
  permissions: readonly string[]
): PermissionCheckResult[] {
  const owned = demoUserPermissions(orgId);
  return permissions.map((permission) => ({
    permission,
    allowed: hasPermission(owned, permission)
  }));
}

/* ----------------------------------------------------------------- reset */

/** Drops every organisation key so a test can start from the seeded state. */
export function demoResetOrganizations(): void {
  for (const key of [ORGS_KEY, MEMBERS_KEY, INVITES_KEY, ROLES_KEY, ACTIVITY_KEY, SETTINGS_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode */
    }
  }
  writeOrgContext(null);
}

/** Exposed for tests that need to assert the seven-day active window. */
export const DEMO_ACTIVE_WINDOW_MS = ACTIVE_MEMBER_WINDOW_MS;

