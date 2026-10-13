/**
 * Permission checks (Sprint 13).
 *
 * The synchronous helpers read the cached set the store loaded at bootstrap, so
 * a directive or a v-if costs nothing. The async helpers hit the authoritative
 * endpoints and merge the answer back into the cache, which keeps a later
 * synchronous check correct without a second round trip.
 */
import { computed } from 'vue';
import { useOrganizationStore } from '../stores/organization';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission as matchPermission
} from '../lib/permissions';
import type { PermissionCheckResult } from '../types';

export function usePermission() {
  const store = useOrganizationStore();

  const userPermissions = computed(() => store.userPermissions);
  const loading = computed(() => store.loading);
  const roleKind = computed(() => store.currentRoleKind);
  const isOwner = computed(() => store.isOwner);
  const isAdmin = computed(() => store.isAdmin);
  const canManage = computed(() => store.canManage);

  function hasPermission(permission: string): boolean {
    return matchPermission(userPermissions.value, permission);
  }

  /** Alias of hasAllPermissions, named as the spec lists it. */
  function hasPermissions(permissions: readonly string[]): boolean {
    return hasAllPermissions(userPermissions.value, permissions);
  }

  function hasAnyPermissionOf(permissions: readonly string[]): boolean {
    return hasAnyPermission(userPermissions.value, permissions);
  }

  function hasAllPermissionsOf(permissions: readonly string[]): boolean {
    return hasAllPermissions(userPermissions.value, permissions);
  }

  async function loadUserPermissions(orgId?: string): Promise<string[]> {
    return store.loadUserPermissions(orgId);
  }

  async function checkPermission(permission: string): Promise<PermissionCheckResult> {
    return store.checkPermission(permission);
  }

  async function checkPermissions(permissions: string[]): Promise<PermissionCheckResult[]> {
    return store.checkPermissions(permissions);
  }

  return {
    userPermissions,
    loading,
    roleKind,
    isOwner,
    isAdmin,
    canManage,
    hasPermission,
    hasPermissions,
    hasAnyPermission: hasAnyPermissionOf,
    hasAllPermissions: hasAllPermissionsOf,
    loadUserPermissions,
    checkPermission,
    checkPermissions
  };
}
