/**
 * Multi-tenancy and permission domain types (Sprint 13).
 *
 * Kept in their own module and re-exported from types/index.ts with a single
 * added line, exactly like the Sprint 12 workflow types, so the accepted type
 * surface stays untouched. Nothing here is tenant-aware by accident: every
 * record that belongs to an organisation carries its orgId, and every list the
 * ui renders is already filtered by the caller.
 */

/** Built-in role kinds are fixed by the product; 'custom' is user-defined. */
export type OrgRoleKind = 'owner' | 'admin' | 'member' | 'viewer' | 'custom';

export type MemberStatus = 'active' | 'disabled';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/** What changed, for the activity feed on the organisation overview page. */
export type OrgActivityKind =
  | 'org_created'
  | 'member_joined'
  | 'member_removed'
  | 'member_disabled'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'role_changed'
  | 'invitation_sent'
  | 'invitation_cancelled'
  | 'settings_updated'
  | 'ownership_transferred';

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  ownerId: string;
  memberCount: number;
  /** Role id the signed-in user holds in this organisation. */
  myRoleId: string;
  myRoleKind: OrgRoleKind;
  createdAt: number;
  /** True when the row came from the on-device demo directory. */
  demo?: boolean;
}

export interface OrganizationInput {
  name: string;
  logoUrl?: string;
  description?: string;
}

export interface OrgSecuritySettings {
  twoFactorRequired: boolean;
  /** Empty list means "no restriction"; enterprise tier only. */
  ipAllowlist: string[];
  sessionTimeoutMinutes: number;
}

export interface OrgNotificationSettings {
  memberJoined: boolean;
  memberRemoved: boolean;
  roleChanged: boolean;
  criticalAction: boolean;
}

export interface OrgDataSettings {
  messageRetentionDays: number;
  logRetentionDays: number;
}

export interface OrganizationSettings {
  security: OrgSecuritySettings;
  notifications: OrgNotificationSettings;
  data: OrgDataSettings;
}

/** Every section is independently optional so one form can save one section. */
export interface OrganizationSettingsInput {
  security?: Partial<OrgSecuritySettings>;
  notifications?: Partial<OrgNotificationSettings>;
  data?: Partial<OrgDataSettings>;
}

export interface Member {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  roleId: string;
  roleKind: OrgRoleKind;
  status: MemberStatus;
  joinedAt: number;
  lastLoginAt?: number;
}

export interface MemberListParams {
  query?: string;
  roleId?: string;
  status?: MemberStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface PagedMembers {
  items: Member[];
  total: number;
  hasMore: boolean;
}

export interface InvitationInput {
  /** One or more addresses; the ui splits a comma separated field into this. */
  emails: string[];
  roleId: string;
  message?: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  roleKind: OrgRoleKind;
  invitedByName: string;
  message?: string;
  token: string;
  status: InvitationStatus;
  createdAt: number;
  expiresAt: number;
}

/** What an invite link renders before the recipient has authenticated. */
export interface InvitationPreview {
  token: string;
  orgName: string;
  orgLogoUrl?: string;
  inviterName: string;
  roleName: string;
  roleKind: OrgRoleKind;
  email: string;
  status: InvitationStatus;
  expiresAt: number;
}

export interface Role {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  kind: OrgRoleKind;
  /** Built-in roles cannot be edited or deleted. */
  builtin: boolean;
  permissions: string[];
  memberCount: number;
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export interface Permission {
  key: string;
  group: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: Permission[];
}

export interface PermissionCheckResult {
  permission: string;
  allowed: boolean;
}

export interface OrgActivity {
  id: string;
  orgId: string;
  kind: OrgActivityKind;
  actorName: string;
  targetName?: string;
  detail?: string;
  createdAt: number;
}

export interface OrgOverviewStats {
  totalMembers: number;
  /** Members whose last login is within the trailing seven days. */
  activeMembers: number;
  customRoles: number;
  pendingInvitations: number;
}

/** Persisted so a reload lands the user back in the organisation they chose. */
export interface OrgContext {
  orgId: string;
  orgName: string;
  roleId: string;
  roleKind: OrgRoleKind;
}
