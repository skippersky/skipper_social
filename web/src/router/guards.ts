/**
 * Organisation and permission route guards (Sprint 13).
 *
 * The accepted Sprint 3 auth guard stays where it is, inline in index.ts, and
 * this module registers a second beforeEach after it. Order does the work: the
 * auth guard has already turned an anonymous visitor away, so everything here may
 * assume a session and only has to answer two questions - which tenant is active,
 * and may this role see this page.
 *
 * Both answers come from the organisation store's cached permission set, so a
 * navigation never waits on a permission round trip. bootstrap() is memoised, so
 * asking it on every navigation costs one request per session.
 *
 * The tenant question is answered before the permission question on purpose. With
 * no organisation there are no permissions either, and sending that user to a 403
 * would hide the real remedy, which is to create or accept an organisation.
 */
import type { Router, RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useOrganizationStore } from '../stores/organization';

declare module 'vue-router' {
  interface RouteMeta {
    /** False opts a route out of the tenant requirement. */
    requiresOrg?: boolean;
    /** Single right needed to enter the route. */
    permission?: string;
    /** Several rights; holding any one of them is enough. */
    permissions?: string[];
  }
}

export const FORBIDDEN_PATH = '/403';
export const ONBOARDING_PATH = '/onboarding/create-org';
export const INVITATION_PREFIX = '/invitation/';

/**
 * Reachable with no active tenant. Without these the "no organisation" redirect
 * would point at a route that itself demands one, and the router would loop.
 */
export const ORG_FREE_PATHS: readonly string[] = [ONBOARDING_PATH, FORBIDDEN_PATH];

export function isOrgFreePath(path: string): boolean {
  return ORG_FREE_PATHS.includes(path) || path.startsWith(INVITATION_PREFIX);
}

/**
 * An invitation link arrives by email and is often opened signed out, so it has
 * to render its own "sign in to accept" panel rather than bounce to /login and
 * lose the token from view.
 */
export function hasPublicPrefix(path: string): boolean {
  return path.startsWith(INVITATION_PREFIX);
}

/** Route meta may demand one right, or any one of several. */
export function requiredPermissions(meta: RouteLocationNormalized['meta']): string[] {
  const needed: string[] = [];
  if (meta.permission) needed.push(meta.permission);
  for (const entry of meta.permissions ?? []) {
    if (entry && !needed.includes(entry)) needed.push(entry);
  }
  return needed;
}

/** A route needs a tenant when it says so, or when it lives under /dashboard. */
export function requiresOrganization(to: RouteLocationNormalized): boolean {
  if (to.meta.requiresOrg === true) return true;
  if (to.meta.requiresOrg === false) return false;
  return to.path.startsWith('/dashboard/');
}

export async function resolveOrgNavigation(
  to: RouteLocationNormalized
): Promise<true | RouteLocationRaw> {
  const auth = useAuthStore();
  /* Anonymous visitors belong to the auth guard, not to this one. */
  if (!auth.isAuthenticated) return true;
  if (isOrgFreePath(to.path)) return true;

  const org = useOrganizationStore();
  await org.bootstrap();

  if (requiresOrganization(to) && !org.currentOrganization) {
    return { path: ONBOARDING_PATH, query: { redirect: to.fullPath } };
  }

  const needed = requiredPermissions(to.meta);
  if (needed.length > 0 && !org.canAny(needed)) {
    return { path: FORBIDDEN_PATH, query: { from: to.fullPath, needed: needed.join(',') } };
  }
  return true;
}

/** Appended after the auth guard so a session always exists by the time it runs. */
export function registerOrgGuards(router: Router): void {
  router.beforeEach((to) => resolveOrgNavigation(to));
}
