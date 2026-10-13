/**
 * Permission endpoints (Sprint 13).
 *
 * Two layers on purpose. The server calls are authoritative and are what a
 * deployed tenant uses; the cached set returned by getUserPermissions is what the
 * ui checks synchronously, because a directive on every button cannot await a
 * round trip. lib/permissions does the matching in both cases, so the answer is
 * identical whichever path supplied the list.
 *
 * getPermissions() returns the catalog (groups plus their actions) and is not in
 * the spec's list under this module, but the spec does put it on role.ts's
 * endpoint table; it is exported from both so either import site works.
 */
import { apiGet, apiPost } from './http';
import { isMissingBackend } from './demo';
import {
  DEFAULT_ORG_ID,
  demoCheckPermission,
  demoCheckPermissions,
  demoPermissionGroups,
  demoUserPermissions
} from './demoOrganization';
import { readOrgContext } from '../lib/organization';
import type { PermissionCheckResult, PermissionGroup } from '../types';

const PERMISSIONS = '/api/v1/permissions';

/** The demo directory needs an org id; the persisted context supplies it. */
function demoOrgId(): string {
  return readOrgContext()?.orgId ?? DEFAULT_ORG_ID;
}

function orgQuery(orgId?: string): string {
  return orgId ? '?organizationId=' + encodeURIComponent(orgId) : '';
}

export async function checkPermission(permission: string): Promise<PermissionCheckResult> {
  try {
    return await apiPost<PermissionCheckResult>(PERMISSIONS + '/check', { permission });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCheckPermission(demoOrgId(), permission);
  }
}

export async function checkPermissions(
  permissions: string[]
): Promise<PermissionCheckResult[]> {
  try {
    return await apiPost<PermissionCheckResult[]>(PERMISSIONS + '/check-batch', { permissions });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCheckPermissions(demoOrgId(), permissions);
  }
}

/** Every permission the signed-in user holds in the active organisation. */
export async function getUserPermissions(orgId?: string): Promise<string[]> {
  try {
    return await apiGet<string[]>('/api/v1/users/me/permissions' + orgQuery(orgId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUserPermissions(orgId ?? demoOrgId());
  }
}

/** The catalog the role editor renders as a tree. */
export async function getPermissions(): Promise<PermissionGroup[]> {
  try {
    return await apiGet<PermissionGroup[]>(PERMISSIONS);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoPermissionGroups();
  }
}
