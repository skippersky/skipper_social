/**
 * Role endpoints (Sprint 13).
 *
 * The demo path derives the four built-in roles from lib/permissions instead of
 * storing them, so a built-in can never be edited, deleted or lost offline. That
 * matches the rule the roles page enforces in the ui: built-ins are read-only.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './http';
import { isMissingBackend } from './demo';
import {
  demoCreateRole,
  demoDeleteRole,
  demoRoleById,
  demoRoles,
  demoUpdateRole
} from './demoOrganization';
import type { Role, RoleInput } from '../types';

const ORGANIZATIONS = '/api/v1/organizations';

function id(value: string): string {
  return encodeURIComponent(value);
}

function rolesPath(orgId: string): string {
  return ORGANIZATIONS + '/' + id(orgId) + '/roles';
}

export async function getRoles(orgId: string): Promise<Role[]> {
  try {
    return await apiGet<Role[]>(rolesPath(orgId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRoles(orgId);
  }
}

export async function getRole(orgId: string, roleId: string): Promise<Role> {
  try {
    return await apiGet<Role>(rolesPath(orgId) + '/' + id(roleId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRoleById(orgId, roleId);
  }
}

export async function createRole(orgId: string, data: RoleInput): Promise<Role> {
  try {
    return await apiPost<Role>(rolesPath(orgId), data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateRole(orgId, data);
  }
}

export async function updateRole(
  orgId: string,
  roleId: string,
  data: Partial<RoleInput>
): Promise<Role> {
  try {
    return await apiPut<Role>(rolesPath(orgId) + '/' + id(roleId), data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateRole(orgId, roleId, data);
  }
}

export async function deleteRole(orgId: string, roleId: string): Promise<boolean> {
  try {
    return await apiDelete<boolean>(rolesPath(orgId) + '/' + id(roleId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoDeleteRole(orgId, roleId);
  }
}
