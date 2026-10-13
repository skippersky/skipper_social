/**
 * Organisation sub-navigation table (Sprint 13).
 *
 * Lifted out of OrgPageShell because a <script setup> block cannot carry ES module
 * exports, and the five organisation pages plus the guard tests all want the same
 * list of tabs. Keeping it here means one source of truth for "which page exists
 * and which right opens it", and the shell stays a pure renderer.
 *
 * The permission on each entry mirrors the route meta in router/index.ts, so a tab
 * is hidden exactly when the guard would have bounced the click with a 403.
 */
export interface OrgNavItem {
  key: string;
  path: string;
  labelKey: string;
  /** Omitted means "always visible". */
  permission?: string;
}

export const ORG_NAV: OrgNavItem[] = [
  { key: 'overview', path: '/dashboard/organization', labelKey: 'org.overview.title' },
  {
    key: 'members',
    path: '/dashboard/organization/members',
    labelKey: 'org.members.title',
    permission: 'organization:view_members'
  },
  {
    key: 'roles',
    path: '/dashboard/organization/roles',
    labelKey: 'org.roles.title',
    permission: 'organization:manage_roles'
  },
  {
    key: 'settings',
    path: '/dashboard/organization/settings',
    labelKey: 'org.settings.title',
    permission: 'organization:update_settings'
  },
  { key: 'switch', path: '/dashboard/organization/switch', labelKey: 'org.switch.title' }
];
