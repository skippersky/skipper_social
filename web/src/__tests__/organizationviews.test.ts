/**
 * Sprint 13 organisation views and route guards.
 *
 * Wiring tests for the eight pages of the module plus the guard that decides who
 * may enter them. Each view is mounted against a real router and mocked api edge,
 * so what is asserted is the contract between view, composable, store and server:
 * which endpoint a page asks for on mount, what it paints from the answer, which
 * toast an action produces and where a click navigates.
 *
 * The guard is tested twice on purpose. Once as the pure function it is, so each
 * branch can be named, and once installed on a router, because a beforeEach that
 * is never registered is a data-isolation hole no unit test would notice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { h, type Component } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteLocationNormalized,
  type Router
} from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { setRequestContext, getRequestContext, ORG_HEADER } from '../api/http';
import { useI18nStore } from '../i18n';
import { PERMISSION_GROUPS } from '../lib/permissions';
import {
  FORBIDDEN_PATH,
  ONBOARDING_PATH,
  hasPublicPrefix,
  isOrgFreePath,
  registerOrgGuards,
  requiredPermissions,
  requiresOrganization,
  resolveOrgNavigation
} from '../router/guards';
import { useAuthStore } from '../stores/auth';
import { useOrganizationStore } from '../stores/organization';
import AcceptView from '../views/invitation/Accept.vue';
import ForbiddenView from '../views/errors/Forbidden.vue';
import CreateOrgView from '../views/onboarding/CreateOrg.vue';
import OverviewView from '../views/dashboard/organization/index.vue';
import MembersView from '../views/dashboard/organization/members.vue';
import RolesView from '../views/dashboard/organization/roles.vue';
import SettingsView from '../views/dashboard/organization/settings.vue';
import SwitchView from '../views/dashboard/organization/switch.vue';
import type {
  Invitation,
  InvitationPreview,
  Member,
  OrgActivity,
  Organization,
  OrganizationSettings,
  Role,
  User
} from '../types';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn(), showConfirmDialog: vi.fn(() => Promise.resolve()) };
});
vi.mock('../api/organization');
vi.mock('../api/member');
vi.mock('../api/role');
vi.mock('../api/permission');

const orgApi = vi.mocked(organizationApi);
const memApi = vi.mocked(memberApi);
const rolApi = vi.mocked(roleApi);
const perApi = vi.mocked(permissionApi);

const NOW = new Date(2026, 8, 14, 9, 0).getTime();

const SETTINGS: OrganizationSettings = {
  security: { twoFactorRequired: false, ipAllowlist: ['10.0.0.1'], sessionTimeoutMinutes: 60 },
  notifications: {
    memberJoined: true,
    memberRemoved: true,
    roleChanged: true,
    criticalAction: true
  },
  data: { messageRetentionDays: 180, logRetentionDays: 90 }
};

function t(key: string, params?: Record<string, string | number>): string {
  return useI18nStore().t(key, params);
}

function toasts(): string[] {
  const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.map((call) => String(call[0]));
}

function org(patch: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'Kili Social',
    ownerId: 'u-owner',
    memberCount: 3,
    myRoleId: 'role-owner',
    myRoleKind: 'owner',
    createdAt: NOW,
    ...patch
  };
}

function member(patch: Partial<Member> = {}): Member {
  return {
    id: 'mem-1',
    orgId: 'org-1',
    userId: 'u-1',
    name: 'Amani Juma',
    email: 'amani@example.com',
    roleId: 'role-member',
    roleKind: 'member',
    status: 'active',
    joinedAt: NOW,
    lastLoginAt: NOW,
    ...patch
  };
}

function role(patch: Partial<Role> = {}): Role {
  return {
    id: 'role-member',
    orgId: 'org-1',
    name: 'org.role.member',
    kind: 'member',
    builtin: true,
    permissions: ['conversation:view'],
    memberCount: 1,
    ...patch
  };
}

function invitation(patch: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    orgId: 'org-1',
    email: 'new@example.com',
    roleId: 'role-member',
    roleKind: 'member',
    invitedByName: 'Amani Juma',
    token: 'tok-1',
    status: 'pending',
    createdAt: NOW,
    expiresAt: NOW + 600_000,
    ...patch
  };
}

function preview(patch: Partial<InvitationPreview> = {}): InvitationPreview {
  return {
    token: 'tok-1',
    orgName: 'Kili Social',
    inviterName: 'Amani Juma',
    roleName: 'org.role.member',
    roleKind: 'member',
    email: 'new@example.com',
    status: 'pending',
    expiresAt: NOW + 600_000,
    ...patch
  };
}

function activity(patch: Partial<OrgActivity> = {}): OrgActivity {
  return {
    id: 'act-1',
    orgId: 'org-1',
    kind: 'member_joined',
    actorName: 'Amani Juma',
    createdAt: NOW,
    ...patch
  };
}

function user(): User {
  return {
    id: 'u-1',
    email: 'amani@example.com',
    nickname: 'Amani',
    timezone: 'Africa/Nairobi',
    language: 'en',
    subscriptionTier: 'free',
    createdAt: NOW
  };
}

const stub = { render: () => h('div') };

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/login', component: stub },
      { path: '/register', component: stub },
      { path: FORBIDDEN_PATH, component: ForbiddenView },
      { path: ONBOARDING_PATH, component: CreateOrgView },
      { path: '/invitation/:token', component: AcceptView },
      { path: '/dashboard/organization', component: OverviewView },
      { path: '/dashboard/organization/members', component: MembersView },
      { path: '/dashboard/organization/roles', component: RolesView },
      { path: '/dashboard/organization/settings', component: SettingsView },
      { path: '/dashboard/organization/switch', component: SwitchView }
    ]
  });
}

let pinia: Pinia;
let router: Router;
const live: VueWrapper[] = [];

async function mountView(component: Component, path: string) {
  router = buildRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, {
    global: { plugins: [pinia, router] },
    attachTo: document.body
  });
  live.push(wrapper);
  await flushPromises();
  return wrapper;
}

/** The guard only reads path, fullPath and meta, so a literal is enough. */
function route(path: string, meta: Record<string, unknown> = {}): RouteLocationNormalized {
  return {
    path,
    fullPath: path,
    meta,
    query: {},
    params: {},
    hash: '',
    matched: [],
    name: undefined,
    redirectedFrom: undefined
  } as unknown as RouteLocationNormalized;
}

/** Signs in and leaves the store holding one tenant the way bootstrap would. */
async function signedInWithTenant(patch: Partial<Organization> = {}): Promise<void> {
  useAuthStore().user = user();
  const store = useOrganizationStore();
  store.organizations = [org(patch)];
  store.currentOrganization = org(patch);
  store.userPermissions = ['*'];
  await flushPromises();
}

beforeEach(() => {
  localStorage.clear();
  setRequestContext(null);
  pinia = createPinia();
  setActivePinia(pinia);
  vi.clearAllMocks();
  useI18nStore().setLocale('en');
  document.body.innerHTML = '';
  document.title = '';

  orgApi.getOrganizations.mockResolvedValue([org()]);
  orgApi.getCurrentOrganization.mockResolvedValue(org());
  orgApi.createOrganization.mockImplementation(async (input) =>
    org({ id: 'org-new', name: input.name })
  );
  orgApi.updateOrganization.mockImplementation(async (id, input) =>
    org({ id, name: input.name ?? 'Kili Social' })
  );
  orgApi.deleteOrganization.mockResolvedValue(true);
  orgApi.switchOrganization.mockResolvedValue({
    orgId: 'org-2',
    orgName: 'Kili Trade',
    roleId: 'role-member',
    roleKind: 'member'
  });
  orgApi.getOrganizationOverview.mockResolvedValue({
    totalMembers: 3,
    activeMembers: 2,
    customRoles: 1,
    pendingInvitations: 1
  });
  orgApi.getOrganizationActivity.mockResolvedValue([activity()]);
  orgApi.getOrganizationSettings.mockResolvedValue(SETTINGS);
  orgApi.updateOrganizationSettings.mockResolvedValue(SETTINGS);
  orgApi.transferOwnership.mockResolvedValue(org());
  memApi.getMembers.mockResolvedValue({ items: [member()], total: 1, hasMore: false });
  memApi.getInvitations.mockResolvedValue([invitation()]);
  memApi.inviteMember.mockResolvedValue([invitation()]);
  memApi.removeMember.mockResolvedValue(true);
  memApi.updateMemberRole.mockImplementation(async (_o, id) => member({ id, roleId: 'role-admin' }));
  memApi.setMemberStatus.mockImplementation(async (_o, id, status) => member({ id, status }));
  memApi.cancelInvitation.mockResolvedValue(true);
  memApi.resendInvitation.mockResolvedValue(invitation());
  memApi.getInvitationPreview.mockResolvedValue(preview());
  memApi.acceptInvitation.mockResolvedValue(member({ id: 'mem-new', orgId: 'org-2' }));
  rolApi.getRoles.mockResolvedValue([
    role({ id: 'role-owner', name: 'org.role.owner', kind: 'owner', permissions: ['*'] }),
    role(),
    role({ id: 'role-custom', name: 'Support', kind: 'custom', builtin: false, memberCount: 0 })
  ]);
  rolApi.getRole.mockImplementation(async (_o, id) => role({ id }));
  rolApi.createRole.mockImplementation(async (_o, data) =>
    role({ id: 'role-new', name: data.name, kind: 'custom', builtin: false })
  );
  rolApi.updateRole.mockImplementation(async (_o, id, data) =>
    role({ id, name: data.name ?? 'Member', kind: 'custom', builtin: false })
  );
  rolApi.deleteRole.mockResolvedValue(true);
  perApi.getPermissions.mockResolvedValue(PERMISSION_GROUPS);
  perApi.getUserPermissions.mockResolvedValue(['*']);
  perApi.checkPermission.mockImplementation(async (permission) => ({ permission, allowed: true }));
  perApi.checkPermissions.mockImplementation(async (permissions) =>
    permissions.map((permission) => ({ permission, allowed: true }))
  );
});

afterEach(() => {
  for (const wrapper of live.splice(0)) {
    if (wrapper.exists()) wrapper.unmount();
  }
  document.body.innerHTML = '';
  setRequestContext(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('org guard helpers', () => {
  it('keeps the onboarding, 403 and invitation routes reachable with no tenant', () => {
    expect(isOrgFreePath(ONBOARDING_PATH)).toBe(true);
    expect(isOrgFreePath(FORBIDDEN_PATH)).toBe(true);
    expect(isOrgFreePath('/invitation/abc')).toBe(true);
    expect(isOrgFreePath('/dashboard/organization')).toBe(false);
  });

  it('treats an invitation link as public so an emailed token survives', () => {
    expect(hasPublicPrefix('/invitation/abc')).toBe(true);
    expect(hasPublicPrefix('/login')).toBe(false);
  });

  it('collects the rights a route asks for without repeating one', () => {
    expect(requiredPermissions({})).toEqual([]);
    expect(requiredPermissions({ permission: 'a:x' })).toEqual(['a:x']);
    expect(
      requiredPermissions({ permission: 'a:x', permissions: ['a:x', 'b:y'] })
    ).toEqual(['a:x', 'b:y']);
  });

  it('needs a tenant under /dashboard, or wherever the meta says so', () => {
    expect(requiresOrganization(route('/dashboard/organization'))).toBe(true);
    expect(requiresOrganization(route('/home'))).toBe(false);
    expect(requiresOrganization(route('/home', { requiresOrg: true }))).toBe(true);
    expect(requiresOrganization(route('/dashboard/x', { requiresOrg: false }))).toBe(false);
  });
});

describe('resolveOrgNavigation', () => {
  it('leaves an anonymous visitor to the auth guard', async () => {
    expect(await resolveOrgNavigation(route('/dashboard/organization'))).toBe(true);
    expect(orgApi.getOrganizations).not.toHaveBeenCalled();
  });

  it('lets an org-free route through without asking for a tenant', async () => {
    useAuthStore().user = user();

    expect(await resolveOrgNavigation(route(ONBOARDING_PATH))).toBe(true);
    expect(await resolveOrgNavigation(route('/invitation/tok'))).toBe(true);
    expect(orgApi.getOrganizations).not.toHaveBeenCalled();
  });

  it('sends a signed-in user with no tenant to onboarding, remembering where they went', async () => {
    useAuthStore().user = user();
    orgApi.getOrganizations.mockResolvedValue([]);

    const result = await resolveOrgNavigation(route('/dashboard/organization/members'));

    expect(result).toEqual({
      path: ONBOARDING_PATH,
      query: { redirect: '/dashboard/organization/members' }
    });
  });

  it('sends a missing right to the 403 with the key that was needed', async () => {
    useAuthStore().user = user();
    perApi.getUserPermissions.mockResolvedValue(['organization:view_members']);

    const result = await resolveOrgNavigation(
      route('/dashboard/organization/settings', { permission: 'organization:update_settings' })
    );

    expect(result).toEqual({
      path: FORBIDDEN_PATH,
      query: {
        from: '/dashboard/organization/settings',
        needed: 'organization:update_settings'
      }
    });
  });

  it('accepts any one of several rights', async () => {
    useAuthStore().user = user();
    perApi.getUserPermissions.mockResolvedValue(['analytics:view']);

    const allowed = await resolveOrgNavigation(
      route('/dashboard/organization', { permissions: ['analytics:view', 'customer:view'] })
    );
    expect(allowed).toBe(true);

    perApi.getUserPermissions.mockResolvedValue([]);
    useOrganizationStore().invalidateBootstrap();
    const denied = await resolveOrgNavigation(
      route('/dashboard/organization', { permissions: ['analytics:view', 'customer:view'] })
    );
    expect(denied).toMatchObject({ path: FORBIDDEN_PATH });
  });

  it('lets a wildcard holder in everywhere', async () => {
    useAuthStore().user = user();
    perApi.getUserPermissions.mockResolvedValue(['*']);

    expect(
      await resolveOrgNavigation(
        route('/dashboard/organization/settings', { permission: 'organization:update_settings' })
      )
    ).toBe(true);
  });

  it('bootstraps once per session however often the guard runs', async () => {
    useAuthStore().user = user();

    await resolveOrgNavigation(route('/dashboard/organization'));
    await resolveOrgNavigation(route('/dashboard/organization/members'));
    await resolveOrgNavigation(route('/dashboard/organization/roles'));

    expect(orgApi.getOrganizations).toHaveBeenCalledTimes(1);
  });

  it('binds the tenant header while resolving, so the next request is scoped', async () => {
    useAuthStore().user = user();

    await resolveOrgNavigation(route('/dashboard/organization'));

    expect(getRequestContext()[ORG_HEADER]).toBe('org-1');
  });
});

describe('registerOrgGuards', () => {
  it('redirects a real navigation to onboarding when there is no tenant', async () => {
    useAuthStore().user = user();
    orgApi.getOrganizations.mockResolvedValue([]);
    const guarded = buildRouter();
    registerOrgGuards(guarded);

    await guarded.push('/dashboard/organization/members');
    await guarded.isReady();

    expect(guarded.currentRoute.value.path).toBe(ONBOARDING_PATH);
    expect(guarded.currentRoute.value.query.redirect).toBe('/dashboard/organization/members');
  });

  it('redirects a real navigation to the 403 when the role is too small', async () => {
    useAuthStore().user = user();
    perApi.getUserPermissions.mockResolvedValue(['organization:view_members']);
    const guarded = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub },
        { path: '/home', component: stub },
        { path: FORBIDDEN_PATH, component: ForbiddenView },
        { path: ONBOARDING_PATH, component: stub },
        {
          path: '/dashboard/organization/settings',
          component: stub,
          meta: { permission: 'organization:update_settings' }
        }
      ]
    });
    registerOrgGuards(guarded);

    await guarded.push('/dashboard/organization/settings');
    await guarded.isReady();

    expect(guarded.currentRoute.value.path).toBe(FORBIDDEN_PATH);
    expect(guarded.currentRoute.value.query.needed).toBe('organization:update_settings');
  });

  it('leaves an org-free navigation alone', async () => {
    useAuthStore().user = user();
    const guarded = buildRouter();
    registerOrgGuards(guarded);

    await guarded.push('/invitation/tok-1');
    await guarded.isReady();

    expect(guarded.currentRoute.value.path).toBe('/invitation/tok-1');
  });
});

describe('Forbidden view', () => {
  it('names the missing right and offers the three ways out', async () => {
    const wrapper = await mountView(
      ForbiddenView,
      '/403?from=/dashboard/organization/settings&needed=organization:update_settings,customer:delete'
    );

    expect(wrapper.find('[data-testid="forbidden-card"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="forbidden-needed-label"]').text()).toBe(
      t('org.forbidden.needed', { permission: 'organization:update_settings, customer:delete' })
    );
    expect(wrapper.findAll('[data-testid="forbidden-needed"] li')).toHaveLength(2);
    expect(document.title).toBe(t('org.forbidden.metaTitle') + ' - KiliSocial');
  });

  it('hides the permission list when the guard did not name one', async () => {
    const wrapper = await mountView(ForbiddenView, '/403');

    expect(wrapper.find('[data-testid="forbidden-needed"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="forbidden-needed-label"]').exists()).toBe(false);
  });

  it('goes back to where the guard turned the user away', async () => {
    const wrapper = await mountView(ForbiddenView, '/403?from=/dashboard/organization/roles');

    await wrapper.get('[data-testid="forbidden-back"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/organization/roles');
  });

  it('falls back to the workspace when there is nowhere to go back to', async () => {
    const wrapper = await mountView(ForbiddenView, '/403');

    await wrapper.get('[data-testid="forbidden-home"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');

    await router.push('/403');
    await wrapper.get('[data-testid="forbidden-switch"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/organization/switch');
  });
});

describe('Accept invitation view', () => {
  it('offers the sign-in door to a signed-out visitor and keeps the tenant in view', async () => {
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    expect(memApi.getInvitationPreview).toHaveBeenCalledWith('tok-1');
    expect(wrapper.get('[data-testid="invitation-signin"]').text()).toBe(
      t('org.invitation.signInFirst')
    );
    expect(wrapper.get('.iv__org').text()).toBe('Kili Social');
    expect(wrapper.find('[data-testid="invitation-accept"]').exists()).toBe(false);
  });

  it('carries the invitation link into sign-in and registration', async () => {
    const wrapper = await mountView(AcceptView, '/invitation/tok-9');

    await wrapper.get('[data-testid="invitation-login"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/invitation/tok-9');

    await router.push('/invitation/tok-9');
    await wrapper.get('[data-testid="invitation-register"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/register');
    expect(router.currentRoute.value.query.redirect).toBe('/invitation/tok-9');
  });

  it('shows the invitation itself to a signed-in recipient', async () => {
    useAuthStore().user = user();
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    expect(wrapper.find('[data-testid="invitation-signin"]').exists()).toBe(false);
    expect(wrapper.get('.iv__org').text()).toBe('Kili Social');
    expect(wrapper.text()).toContain('Amani Juma');
    expect(wrapper.text()).toContain('new@example.com');
    expect(wrapper.text()).toContain(t('org.invitation.roleLabel'));
    expect(wrapper.get('[data-testid="invitation-accept"]').text()).toBe(t('org.invitation.accept'));
  });

  it('names the reason an invitation cannot be used', async () => {
    useAuthStore().user = user();
    const cases: Array<['expired' | 'cancelled' | 'accepted', string]> = [
      ['expired', 'org.invitation.expired'],
      ['cancelled', 'org.invitation.cancelled'],
      ['accepted', 'org.invitation.alreadyAccepted']
    ];
    for (const [status, key] of cases) {
      memApi.getInvitationPreview.mockResolvedValue(preview({ status }));
      const wrapper = await mountView(AcceptView, '/invitation/tok-1');

      expect(wrapper.get('[data-testid="invitation-blocked"]').text(), status).toBe(t(key));
      expect(wrapper.find('[data-testid="invitation-accept"]').exists()).toBe(false);
    }
  });

  it('says the link is unknown when the preview cannot be read', async () => {
    useAuthStore().user = user();
    memApi.getInvitationPreview.mockRejectedValue(new Error('boom'));
    const wrapper = await mountView(AcceptView, '/invitation/missing');

    expect(wrapper.get('[data-testid="invitation-blocked"]').text()).toBe(
      t('org.invitation.notFound')
    );
  });

  it('accepts, toasts and lands inside the tenant just joined', async () => {
    useAuthStore().user = user();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    await wrapper.get('[data-testid="invitation-accept"]').trigger('click');
    await flushPromises();

    expect(memApi.acceptInvitation).toHaveBeenCalledWith('tok-1');
    expect(orgApi.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(toasts().join('|')).toContain(t('org.invitation.acceptedToast'));
    expect(assign).toHaveBeenCalledWith('/dashboard/organization');
  });

  it('offers the switch page when the new tenant cannot be entered', async () => {
    useAuthStore().user = user();
    vi.stubGlobal('location', { assign: vi.fn() });
    orgApi.switchOrganization.mockRejectedValue(new Error('nope'));
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    await wrapper.get('[data-testid="invitation-accept"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/organization/switch');
  });

  it('declines back to the workspace', async () => {
    useAuthStore().user = user();
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    await wrapper.get('[data-testid="invitation-decline"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/home');
    expect(toasts().join('|')).toContain(t('org.invitation.declinedToast'));
  });

  it('puts the sign-in door ahead of a dead link for a signed-out visitor', async () => {
    memApi.getInvitationPreview.mockResolvedValue(preview({ status: 'expired' }));
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    /* The ordering is deliberate: "expired" means nothing to someone who is not
       signed in yet, and bouncing them would take the token off the screen. */
    expect(wrapper.find('[data-testid="invitation-signin"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="invitation-blocked"]').exists()).toBe(false);

    await wrapper.get('[data-testid="invitation-login"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('sends a signed-in visitor away from a dead link to the workspace', async () => {
    useAuthStore().user = user();
    memApi.getInvitationPreview.mockResolvedValue(preview({ status: 'cancelled' }));
    const wrapper = await mountView(AcceptView, '/invitation/tok-1');

    await wrapper.get('[data-testid="invitation-home"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/home');
  });
});

describe('Create organisation view', () => {
  type Wizard = {
    step: { value: number };
    next: () => void;
    finish: () => void;
    skip: () => void;
  };

  /** Walks the wizard to the invite step, creating the tenant on the way. */
  async function toInviteStep(path = ONBOARDING_PATH) {
    const wrapper = await mountView(CreateOrgView, path);
    (wrapper.vm as unknown as Wizard).next();
    await flushPromises();
    await wrapper.get('[data-testid="onboarding-name"]').setValue('Kili Trade');
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await flushPromises();
    return wrapper;
  }

  it('opens on the welcome step and lists what is coming', async () => {
    const wrapper = await mountView(CreateOrgView, ONBOARDING_PATH);

    expect(orgApi.getOrganizations).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="onboarding-step-1"]').exists()).toBe(true);
    expect(wrapper.get('.ob__overline').text()).toBe(
      t('org.onboarding.stepOf', { current: 1, total: 4 })
    );
    expect(wrapper.findAll('.ob__step-dot')).toHaveLength(4);
    expect(wrapper.find('.ob__step-dot.is-active').exists()).toBe(true);
  });

  it('refuses an unnamed organisation before calling out', async () => {
    const wrapper = await mountView(CreateOrgView, ONBOARDING_PATH);
    (wrapper.vm as unknown as Wizard).next();
    await flushPromises();

    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await flushPromises();

    expect(orgApi.createOrganization).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="onboarding-name-error"]').text()).toBe(
      t('org.error.nameRequired')
    );
    expect(wrapper.find('[data-testid="onboarding-step-2"]').exists()).toBe(true);
  });

  it('creates the tenant, reads its roles and moves to the invite step', async () => {
    const wrapper = await toInviteStep();

    expect(orgApi.createOrganization).toHaveBeenCalledWith({
      name: 'Kili Trade',
      logoUrl: undefined,
      description: undefined
    });
    expect(toasts().join('|')).toContain(t('org.onboarding.createdToast'));
    expect(rolApi.getRoles).toHaveBeenCalledWith('org-new');
    expect(wrapper.find('[data-testid="onboarding-step-3"]').exists()).toBe(true);
    /* The default invite role is the member preset, never owner. */
    expect(
      (wrapper.get('[data-testid="onboarding-invite-role"]').element as HTMLSelectElement).value
    ).toBe('role-member');
    expect(wrapper.text()).not.toContain('org.role.member');
  });

  it('steps back to the form without losing the name', async () => {
    const wrapper = await toInviteStep();

    await wrapper.get('[data-testid="onboarding-back"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="onboarding-step-2"]').exists()).toBe(true);
    expect(
      (wrapper.get('[data-testid="onboarding-name"]').element as HTMLInputElement).value
    ).toBe('Kili Trade');
  });

  it('invites nobody when the step is left blank and finishes', async () => {
    const wrapper = await toInviteStep();

    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await flushPromises();

    expect(memApi.inviteMember).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="onboarding-step-4"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="onboarding-created"]').text()).toBe('Kili Trade');
  });

  it('sends the invites against the tenant just created', async () => {
    const wrapper = await toInviteStep();

    await wrapper.get('[data-testid="onboarding-invite-emails"]').setValue('a@x.com, b@x.com');
    expect(wrapper.text()).toContain(t('org.invite.parsedCount', { n: 2 }));

    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await flushPromises();

    expect(memApi.inviteMember).toHaveBeenCalledWith(
      'org-new',
      expect.objectContaining({ emails: ['a@x.com', 'b@x.com'], roleId: 'role-member' })
    );
    expect(toasts().join('|')).toContain(t('org.invite.successToast', { n: 1 }));
    expect(wrapper.find('[data-testid="onboarding-step-4"]').exists()).toBe(true);
  });

  it('finishes where the guard interrupted, and skips to the workspace otherwise', async () => {
    const redirected = await mountView(
      CreateOrgView,
      ONBOARDING_PATH + '?redirect=/dashboard/organization/members'
    );
    (redirected.vm as unknown as Wizard).finish();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/organization/members');

    const plain = await mountView(CreateOrgView, ONBOARDING_PATH);
    (plain.vm as unknown as Wizard).skip();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('surfaces a create the server refused', async () => {
    orgApi.createOrganization.mockRejectedValue(new Error('boom'));
    const wrapper = await toInviteStep();

    expect(wrapper.find('[data-testid="onboarding-step-3"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="onboarding-error"]').exists()).toBe(true);
  });
});

describe('Switch organisation view', () => {
  const TWO = [org(), org({ id: 'org-2', name: 'Kili Trade', myRoleKind: 'member' })];

  it('lists every tenant with the role held in it', async () => {
    orgApi.getOrganizations.mockResolvedValue(TWO);
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    const cards = wrapper.findAll('[data-testid="switch-card"]');
    expect(cards).toHaveLength(2);
    expect(wrapper.text()).toContain('Kili Trade');
    expect(cards[0].attributes('aria-current')).toBe('true');
  });

  it('says so when the user belongs to no tenant', async () => {
    orgApi.getOrganizations.mockResolvedValue([]);
    orgApi.getCurrentOrganization.mockResolvedValue(null);
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    expect(wrapper.get('[data-testid="switch-empty"]').text()).toBe(t('org.switch.empty'));
    expect(wrapper.find('[data-testid="switch-grid"]').exists()).toBe(false);
  });

  it('switches with a hard navigation so no cached row can survive', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    orgApi.getOrganizations.mockResolvedValue(TWO);
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    await wrapper.findAll('[data-testid="switch-card"]')[1].trigger('click');
    await flushPromises();

    expect(orgApi.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(assign).toHaveBeenCalledWith('/home');
  });

  it('reports a switch the server refused instead of navigating', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    orgApi.getOrganizations.mockResolvedValue(TWO);
    orgApi.switchOrganization.mockRejectedValue(new Error('nope'));
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    await wrapper.findAll('[data-testid="switch-card"]')[1].trigger('click');
    await flushPromises();

    expect(assign).not.toHaveBeenCalled();
    expect(toasts().join('|')).toContain(t('org.switch.failedToast'));
  });

  it('ignores a click on the tenant already in use', async () => {
    orgApi.getOrganizations.mockResolvedValue(TWO);
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    await wrapper.findAll('[data-testid="switch-card"]')[0].trigger('click');
    await flushPromises();

    expect(orgApi.switchOrganization).not.toHaveBeenCalled();
  });

  it('routes to onboarding to create another tenant', async () => {
    orgApi.getOrganizations.mockResolvedValue(TWO);
    const wrapper = await mountView(SwitchView, '/dashboard/organization/switch');

    await wrapper.get('[data-testid="switch-create"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe(ONBOARDING_PATH);
  });
});

describe('Overview view', () => {
  /** Every privileged control sits in a guard, so the page needs a signed-in owner. */
  async function mountOverview(patch: Partial<Organization> = {}) {
    orgApi.getCurrentOrganization.mockResolvedValue(org(patch));
    await signedInWithTenant(patch);
    return mountView(OverviewView, '/dashboard/organization');
  }

  it('reads the tenant, its counts, its roles and its trail on mount', async () => {
    const wrapper = await mountOverview();

    expect(orgApi.getOrganizationOverview).toHaveBeenCalledWith('org-1');
    expect(orgApi.getOrganizationActivity).toHaveBeenCalledWith('org-1', 10);
    expect(rolApi.getRoles).toHaveBeenCalledWith('org-1');
    expect(memApi.getInvitations).toHaveBeenCalledWith('org-1');

    const info = wrapper.get('[data-testid="org-info"]');
    expect(info.text()).toContain('Kili Social');
    expect(info.text()).toContain('org-1');
    expect(info.text()).toContain(t('org.membersCount', { n: '3' }));
    expect(info.find('[data-testid="org-edit-info"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-stat]')).toHaveLength(4);
    expect(wrapper.get('[data-stat="totalMembers"]').text()).toBe('3');
    expect(wrapper.get('[data-stat="activeMembers"]').text()).toBe('2');
    expect(wrapper.get('[data-stat="customRoles"]').text()).toBe('1');
    expect(wrapper.get('[data-stat="pendingInvitations"]').text()).toBe('1');
    expect(wrapper.text()).toContain('Amani Juma');
  });

  it('says so when the signed-in user belongs to no tenant', async () => {
    orgApi.getCurrentOrganization.mockResolvedValue(null);
    await signedInWithTenant();
    const wrapper = await mountView(OverviewView, '/dashboard/organization');

    expect(wrapper.get('[data-testid="org-missing"]').text()).toBe(t('org.notFound'));
    expect(wrapper.find('[data-testid="org-info"]').exists()).toBe(false);
    expect(orgApi.getOrganizationOverview).not.toHaveBeenCalled();
  });

  it('labels sample data and lets the notice be dismissed', async () => {
    const wrapper = await mountOverview({ demo: true });

    expect(wrapper.find('[data-testid="org-demo-bar"]').exists()).toBe(true);
    await wrapper.get('[data-testid="org-demo-hide"]').trigger('click');
    expect(wrapper.find('[data-testid="org-demo-bar"]').exists()).toBe(false);
  });

  it('refuses to blank the organisation name', async () => {
    const wrapper = await mountOverview();

    await wrapper.get('[data-testid="org-edit-info"]').trigger('click');
    const form = wrapper.get('[data-testid="org-edit-form"]');
    expect((form.get('[data-testid="org-edit-name"]').element as HTMLInputElement).value).toBe(
      'Kili Social'
    );

    await form.get('[data-testid="org-edit-name"]').setValue('');
    await form.trigger('submit');
    await flushPromises();

    expect(orgApi.updateOrganization).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="org-edit-name-error"]').text()).toBe(
      t('org.error.nameRequired')
    );
  });

  it('saves the inline edit, toasts and refreshes the counts', async () => {
    const wrapper = await mountOverview();

    await wrapper.get('[data-testid="org-edit-info"]').trigger('click');
    const form = wrapper.get('[data-testid="org-edit-form"]');
    await form.get('[data-testid="org-edit-name"]').setValue('Kili Trade');
    await form.get('[data-testid="org-edit-description"]').setValue('  Field team in Arusha  ');
    await form.trigger('submit');
    await flushPromises();

    expect(orgApi.updateOrganization).toHaveBeenCalledWith('org-1', {
      name: 'Kili Trade',
      logoUrl: undefined,
      description: 'Field team in Arusha'
    });
    expect(toasts().join('|')).toContain(t('org.settings.savedToast'));
    expect(wrapper.find('[data-testid="org-edit-form"]').exists()).toBe(false);
    expect(orgApi.getOrganizationOverview).toHaveBeenCalledTimes(2);
  });

  it('cancels the edit without touching the server', async () => {
    const wrapper = await mountOverview();

    await wrapper.get('[data-testid="org-edit-info"]').trigger('click');
    await wrapper.get('[data-testid="org-edit-name"]').setValue('Something else');
    await wrapper.get('[data-testid="org-edit-cancel"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="org-edit-form"]').exists()).toBe(false);
    expect(orgApi.updateOrganization).not.toHaveBeenCalled();
  });

  it('withholds every privileged control when the rights are missing', async () => {
    const wrapper = await mountOverview();
    useOrganizationStore().userPermissions = ['organization:view_members'];
    await flushPromises();

    expect(wrapper.find('[data-testid="org-invite"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="org-edit-info"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="org-quick-roles"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="org-quick-settings"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="org-quick-members"]').exists()).toBe(true);
  });

  it('navigates from the quick actions and the switch button', async () => {
    const wrapper = await mountOverview();
    const hops: Array<[string, string]> = [
      ['org-quick-members', '/dashboard/organization/members'],
      ['org-quick-roles', '/dashboard/organization/roles'],
      ['org-quick-settings', '/dashboard/organization/settings'],
      ['org-goto-switch', '/dashboard/organization/switch']
    ];

    for (const [testid, path] of hops) {
      await router.push('/dashboard/organization');
      await wrapper.get('[data-testid="' + testid + '"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.path, testid).toBe(path);
    }
  });

  it('invites from the overview against the tenant in view', async () => {
    const wrapper = await mountOverview();

    await wrapper.get('[data-testid="org-invite"]').trigger('click');
    const dialog = wrapper.get('[data-testid="invite-dialog"]');
    /* Owner is never offered, and the list only exists because the page loaded roles. */
    const choices = dialog.findAll('[data-testid="invite-role"]');
    expect(choices.map((choice) => choice.attributes('data-role-id'))).toEqual([
      'role-member',
      'role-custom'
    ]);
    expect(choices[0].attributes('aria-checked')).toBe('true');

    await choices[1].trigger('click');
    await dialog.get('[data-testid="invite-emails"]').setValue('new@example.com');
    await dialog.get('[data-testid="invite-submit"]').trigger('click');
    await flushPromises();

    expect(memApi.inviteMember).toHaveBeenCalledWith('org-1', {
      emails: ['new@example.com'],
      roleId: 'role-custom',
      message: undefined
    });
    expect(toasts().join('|')).toContain(t('org.invite.successToast', { n: 1 }));
    expect(wrapper.find('[data-testid="invite-dialog"]').exists()).toBe(false);
    expect(memApi.getInvitations).toHaveBeenCalledTimes(2);
  });
});

describe('Members view', () => {
  async function mountMembers(patch: Partial<Organization> = {}) {
    await signedInWithTenant(patch);
    return mountView(MembersView, '/dashboard/organization/members');
  }

  /** jsdom ships no clipboard, so each case installs the one it needs. */
  function stubClipboard(writeText: (value: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  it('loads the roster, the invitations and the roles the pickers need', async () => {
    const wrapper = await mountMembers();

    expect(memApi.getMembers).toHaveBeenCalledWith('org-1', { limit: 20, offset: 0 });
    expect(memApi.getInvitations).toHaveBeenCalledWith('org-1');
    expect(rolApi.getRoles).toHaveBeenCalledWith('org-1');
    expect(wrapper.get('[data-testid="members-count"]').text()).toBe(
      t('org.members.total', { n: 1 })
    );
    expect(wrapper.get('[data-testid="member-table"]').text()).toContain('Amani Juma');
    expect(wrapper.find('[data-testid="members-load-more"]').exists()).toBe(false);
  });

  it('names roles in the reader language, never by their message key', async () => {
    const wrapper = await mountMembers();

    expect(
      wrapper.findAll('[data-testid="members-role-filter"] option').map((option) => option.text())
    ).toEqual([t('org.members.filterRole'), t('org.role.owner'), t('org.role.member'), 'Support']);

    const picker = wrapper.get('[data-role-select="mem-1"]');
    expect((picker.element as HTMLSelectElement).value).toBe('role-member');
    expect(picker.findAll('option').map((option) => option.text())).toEqual([
      t('org.role.owner'),
      t('org.role.member'),
      'Support'
    ]);
    expect(wrapper.text()).not.toContain('org.role.');
  });

  it('reads differently once a filter emptied the roster', async () => {
    memApi.getMembers.mockResolvedValue({ items: [], total: 0, hasMore: false });
    const wrapper = await mountMembers();

    expect(wrapper.get('.mb__blank-title').text()).toBe(t('org.members.empty'));
    expect(wrapper.get('[data-testid="members-empty-hint"]').text()).toBe(
      t('org.members.emptyHint')
    );

    await wrapper.get('[data-testid="members-search"]').setValue('nobody');
    await wrapper.get('[data-testid="members-search-go"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('.mb__blank-title').text()).toBe(t('org.members.filteredEmpty'));
    expect(wrapper.find('[data-testid="members-empty-hint"]').exists()).toBe(false);
  });

  it('searches from the field and from the button', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="members-search"]').setValue('amani');
    await wrapper.get('[data-testid="members-search"]').trigger('keyup.enter');
    await flushPromises();
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: 20,
      offset: 0,
      query: 'amani'
    });

    await wrapper.get('[data-testid="members-search-go"]').trigger('click');
    await flushPromises();
    expect(memApi.getMembers).toHaveBeenCalledTimes(3);
  });

  it('stacks the role and status filters on one query', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="members-role-filter"]').setValue('role-member');
    await flushPromises();
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: 20,
      offset: 0,
      roleId: 'role-member'
    });

    await wrapper.get('[data-testid="members-status-filter"]').setValue('disabled');
    await flushPromises();
    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', {
      limit: 20,
      offset: 0,
      roleId: 'role-member',
      status: 'disabled'
    });
  });

  it('appends the next page instead of replacing the first', async () => {
    memApi.getMembers
      .mockResolvedValueOnce({ items: [member()], total: 3, hasMore: true })
      .mockResolvedValueOnce({
        items: [member({ id: 'mem-2', name: 'Joseph Mwangi', email: 'joseph@example.com' })],
        total: 3,
        hasMore: false
      });
    const wrapper = await mountMembers();

    expect(wrapper.findAll('[data-member-id]')).toHaveLength(1);
    await wrapper.get('[data-testid="members-load-more"]').trigger('click');
    await flushPromises();

    expect(memApi.getMembers).toHaveBeenLastCalledWith('org-1', { limit: 20, offset: 1 });
    expect(wrapper.findAll('[data-member-id]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Joseph Mwangi');
    expect(wrapper.find('[data-testid="members-load-more"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="members-count"]').text()).toBe(
      t('org.members.total', { n: 3 })
    );
  });

  it('changes a role from the row and says so', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-role-select="mem-1"]').setValue('role-custom');
    await flushPromises();

    expect(memApi.updateMemberRole).toHaveBeenCalledWith('org-1', 'mem-1', {
      roleId: 'role-custom'
    });
    expect(toasts().join('|')).toContain(t('org.members.roleUpdatedToast'));
  });

  it('asks before removing, then removes', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-remove="mem-1"]').trigger('click');
    await flushPromises();

    expect(showConfirmDialog).toHaveBeenCalledWith({
      title: t('org.members.removeTitle'),
      message: t('org.members.removeMessage', { name: 'Amani Juma' })
    });
    expect(memApi.removeMember).toHaveBeenCalledWith('org-1', 'mem-1');
    expect(toasts().join('|')).toContain(t('org.members.removedToast'));
  });

  it('keeps the owner row locked and explains why', async () => {
    memApi.getMembers.mockResolvedValue({
      items: [
        member({
          id: 'mem-owner',
          userId: 'u-owner',
          roleId: 'role-owner',
          roleKind: 'owner'
        }),
        member({ id: 'mem-2', name: 'Joseph Mwangi', email: 'joseph@example.com' })
      ],
      total: 2,
      hasMore: false
    });
    const wrapper = await mountMembers();

    expect(wrapper.get('[data-testid="members-owner-note"]').text()).toBe(
      t('org.members.ownerLocked')
    );
    expect(wrapper.find('[data-role-select="mem-owner"]').exists()).toBe(false);
    expect(wrapper.find('[data-remove="mem-owner"]').exists()).toBe(false);
    expect(wrapper.find('[data-remove="mem-2"]').exists()).toBe(true);
    expect(wrapper.get('[data-member-id="mem-owner"]').text()).toContain(t('org.role.owner'));
  });

  it('opens the member detail and toggles the account from it', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-detail="mem-1"]').trigger('click');
    const dialog = wrapper.get('[data-testid="member-detail"]');
    expect(dialog.attributes('aria-label')).toBe(t('org.members.detailTitle'));
    expect(dialog.text()).toContain('amani@example.com');
    expect(dialog.text()).toContain(t('org.members.colEmail'));

    await dialog.get('[data-testid="member-detail-toggle"]').trigger('click');
    await flushPromises();
    expect(memApi.setMemberStatus).toHaveBeenCalledWith('org-1', 'mem-1', 'disabled');
    expect(toasts().join('|')).toContain(t('org.members.statusUpdatedToast'));

    await wrapper.get('[data-testid="member-detail-close"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="member-detail"]').exists()).toBe(false);
  });

  it('blocks an address already inside, then sends a fresh invite', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="members-invite"]').trigger('click');
    const dialog = wrapper.get('[data-testid="invite-dialog"]');
    await dialog.get('[data-testid="invite-emails"]').setValue('AMANI@example.com');
    await dialog.get('[data-testid="invite-submit"]').trigger('click');
    await flushPromises();

    expect(dialog.get('[data-testid="invite-emails-error"]').text()).toBe(
      t('org.error.emailAlreadyMember')
    );
    expect(memApi.inviteMember).not.toHaveBeenCalled();

    await dialog.get('[data-testid="invite-emails"]').setValue('new@example.com');
    await dialog.get('[data-testid="invite-submit"]').trigger('click');
    await flushPromises();

    expect(memApi.inviteMember).toHaveBeenCalledWith('org-1', {
      emails: ['new@example.com'],
      roleId: 'role-member',
      message: undefined
    });
    expect(toasts().join('|')).toContain(t('org.invite.successToast', { n: 1 }));
    expect(wrapper.find('[data-testid="invite-dialog"]').exists()).toBe(false);
    expect(memApi.getInvitations).toHaveBeenCalledTimes(2);
  });

  it('resends and cancels from the invitation ledger', async () => {
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="invitations-toggle"]').trigger('click');
    const ledger = wrapper.get('.mb__invites-body');
    expect(ledger.text()).toContain(t('org.invitations.title'));
    expect(ledger.text()).toContain('new@example.com');
    expect(ledger.text()).toContain(t('org.invitations.statusPending'));
    expect(ledger.text()).toContain(t('org.invitations.invitedBy', { name: 'Amani Juma' }));

    await ledger.get('[data-testid="invitation-resend"]').trigger('click');
    await flushPromises();
    expect(memApi.resendInvitation).toHaveBeenCalledWith('org-1', 'inv-1');
    expect(toasts().join('|')).toContain(t('org.invitations.resentToast'));

    await wrapper.get('[data-testid="invitation-cancel"]').trigger('click');
    await flushPromises();
    expect(memApi.cancelInvitation).toHaveBeenCalledWith('org-1', 'inv-1');
    expect(toasts().join('|')).toContain(t('org.invitations.cancelledToast'));
  });

  it('offers nothing to do with an invitation already used', async () => {
    memApi.getInvitations.mockResolvedValue([invitation({ status: 'accepted' })]);
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="invitations-toggle"]').trigger('click');
    const row = wrapper.get('.mb__invite');
    expect(row.attributes('data-status')).toBe('accepted');
    expect(row.text()).toContain(t('org.invitations.statusAccepted'));
    expect(row.find('[data-testid="invitation-resend"]').exists()).toBe(false);
    expect(row.find('[data-testid="invitation-cancel"]').exists()).toBe(false);
    expect(row.find('[data-testid="invitation-copy"]').exists()).toBe(true);
  });

  it('copies the invite link when the clipboard allows it', async () => {
    memApi.invitationUrl.mockImplementation((token: string) => '/invitation/' + token);
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="invitations-toggle"]').trigger('click');
    await wrapper.get('[data-testid="invitation-copy"]').trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith('/invitation/tok-1');
    expect(toasts().join('|')).toContain(t('org.invitations.linkCopied'));
  });

  it('shows the link itself when the clipboard refuses', async () => {
    memApi.invitationUrl.mockImplementation((token: string) => '/invitation/' + token);
    stubClipboard(() => Promise.reject(new Error('blocked')));
    const wrapper = await mountMembers();

    await wrapper.get('[data-testid="invitations-toggle"]').trigger('click');
    await wrapper.get('[data-testid="invitation-copy"]').trigger('click');
    await flushPromises();

    expect(toasts().join('|')).toContain('/invitation/tok-1');
    expect(toasts().join('|')).not.toContain(t('org.invitations.linkCopied'));
  });
});

describe('Roles view', () => {
  type RolesVm = {
    onDelete: (role: Role) => Promise<void>;
    onDraftChange: (value: string[]) => void;
  };

  const PRESETS = [
    role({ id: 'role-owner', name: 'org.role.owner', kind: 'owner', permissions: ['*'] }),
    role()
  ];

  async function mountRoles(patch: Partial<Organization> = {}) {
    await signedInWithTenant(patch);
    return mountView(RolesView, '/dashboard/organization/roles');
  }

  it('keeps the fixed presets apart from the roles the team made', async () => {
    const wrapper = await mountRoles();

    expect(rolApi.getRoles).toHaveBeenCalledWith('org-1');
    expect(perApi.getPermissions).toHaveBeenCalled();
    expect(wrapper.get('.rl__block-hint').text()).toBe(t('org.roles.presetTitle'));

    const builtin = wrapper.findAll('[data-testid="role-builtin-grid"] [data-role-id]');
    expect(builtin.map((card) => card.attributes('data-role-id'))).toEqual([
      'role-owner',
      'role-member'
    ]);
    expect(wrapper.findAll('[data-testid="role-builtin-lock"]')).toHaveLength(2);
    expect(builtin[0].text()).toContain(t('org.role.owner'));
    expect(builtin[0].text()).toContain(t('org.roles.allPermissions'));
    expect(builtin[0].text()).toContain(t('org.roleDesc.owner'));
    expect(builtin[1].text()).toContain(t('org.roles.permissionCount', { n: '1' }));

    const custom = wrapper.findAll('[data-testid="role-custom-grid"] [data-role-id]');
    expect(custom).toHaveLength(1);
    expect(custom[0].text()).toContain('Support');
    expect(custom[0].text()).toContain(t('org.roles.memberCount', { n: '0' }));
    expect(wrapper.text()).not.toContain('org.role.');
  });

  it('says so when the team has not made a role yet', async () => {
    rolApi.getRoles.mockResolvedValue(PRESETS);
    const wrapper = await mountRoles();

    expect(wrapper.find('[data-testid="role-custom-grid"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="role-custom-empty"]').text()).toContain(t('org.roles.empty'));
    expect(wrapper.get('[data-testid="role-custom-empty"]').text()).toContain(
      t('org.roles.emptyHint')
    );
  });

  it('refuses an unnamed role before calling out', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-create"]').trigger('click');
    const dialog = wrapper.get('[data-testid="role-editor"]');
    expect(dialog.attributes('aria-label')).toBe(t('org.roles.editorCreateTitle'));

    await dialog.get('[data-testid="role-editor-form"]').trigger('submit');
    await flushPromises();

    expect(rolApi.createRole).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="role-editor-name-error"]').text()).toBe(
      t('org.error.roleNameRequired')
    );
    expect(wrapper.get('[data-testid="role-editor-permissions-error"]').text()).toBe(
      t('org.error.permissionRequired')
    );
  });

  it('creates a custom role from the permissions picked in the tree', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-create"]').trigger('click');
    const dialog = wrapper.get('[data-testid="role-editor"]');
    await dialog.get('[data-testid="role-editor-name"]').setValue('Field Team');
    await dialog.get('[data-testid="role-editor-description"]').setValue('  Door to door  ');
    /* The first group starts open, so its boxes can be ticked straight away. */
    await dialog.get('[data-permission-input="customer:view"]').setValue(true);
    await dialog.get('[data-permission-input="customer:create"]').setValue(true);
    await flushPromises();

    expect(dialog.get('[data-testid="role-editor-count"]').text()).toBe(
      t('org.roles.editorSelected', { n: 2 })
    );

    await dialog.get('[data-testid="role-editor-form"]').trigger('submit');
    await flushPromises();

    expect(rolApi.createRole).toHaveBeenCalledWith('org-1', {
      name: 'Field Team',
      description: 'Door to door',
      permissions: ['customer:view', 'customer:create']
    });
    expect(toasts().join('|')).toContain(t('org.roles.editorCreatedToast'));
    expect(wrapper.find('[data-testid="role-editor"]').exists()).toBe(false);
  });

  it('selects a whole group in one click', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-create"]').trigger('click');
    const dialog = wrapper.get('[data-testid="role-editor"]');
    await dialog.get('[data-group-toggle="conversation"]').setValue(true);
    await flushPromises();

    expect(dialog.get('[data-testid="role-editor-count"]').text()).toBe(
      t('org.roles.editorSelected', { n: 4 })
    );
  });

  it('refuses a name another role already carries', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-create"]').trigger('click');
    const dialog = wrapper.get('[data-testid="role-editor"]');
    await dialog.get('[data-testid="role-editor-name"]').setValue('Support');
    (wrapper.vm as unknown as RolesVm).onDraftChange(['customer:view']);
    await dialog.get('[data-testid="role-editor-form"]').trigger('submit');
    await flushPromises();

    expect(rolApi.createRole).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="role-editor-name-error"]').text()).toBe(
      t('org.error.roleNameTaken')
    );
  });

  it('edits a custom role where it stands', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-custom-grid"] [data-testid="role-edit"]').trigger('click');
    expect(wrapper.get('[data-testid="role-editor"]').attributes('aria-label')).toBe(
      t('org.roles.editorEditTitle')
    );
    expect(
      (wrapper.get('[data-testid="role-editor-name"]').element as HTMLInputElement).value
    ).toBe('Support');

    await wrapper.get('[data-testid="role-editor-name"]').setValue('Support Crew');
    await wrapper.get('[data-testid="role-editor-form"]').trigger('submit');
    await flushPromises();

    expect(rolApi.updateRole).toHaveBeenCalledWith('org-1', 'role-custom', {
      name: 'Support Crew',
      description: undefined,
      permissions: ['conversation:view']
    });
    expect(toasts().join('|')).toContain(t('org.roles.editorUpdatedToast'));
    expect(wrapper.find('[data-testid="role-editor"]').exists()).toBe(false);
  });

  it('closes the editor without saving', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-create"]').trigger('click');
    await wrapper.get('[data-testid="role-editor-cancel"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="role-editor"]').exists()).toBe(false);
    expect(rolApi.createRole).not.toHaveBeenCalled();
  });

  it('offers no edit or delete on a preset, and says why if asked', async () => {
    const wrapper = await mountRoles();

    expect(
      wrapper.findAll('[data-testid="role-builtin-grid"] [data-testid="role-edit"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll('[data-testid="role-builtin-grid"] [data-testid="role-delete"]')
    ).toHaveLength(0);

    await (wrapper.vm as unknown as RolesVm).onDelete(PRESETS[0]);
    await flushPromises();

    expect(rolApi.deleteRole).not.toHaveBeenCalled();
    expect(toasts().join('|')).toContain(t('org.roles.deleteBlocked'));
  });

  it('keeps a role that still holds members', async () => {
    rolApi.getRoles.mockResolvedValue([
      ...PRESETS,
      role({ id: 'role-custom', name: 'Support', kind: 'custom', builtin: false, memberCount: 4 })
    ]);
    const wrapper = await mountRoles();

    expect(wrapper.findAll('[data-testid="role-delete"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="role-custom-grid"] [data-role-id]').text()).toContain(
      t('org.roles.memberCount', { n: '4' })
    );

    await (wrapper.vm as unknown as RolesVm).onDelete(
      role({ id: 'role-custom', name: 'Support', kind: 'custom', builtin: false, memberCount: 4 })
    );
    await flushPromises();
    expect(rolApi.deleteRole).not.toHaveBeenCalled();
    expect(toasts().join('|')).toContain(t('org.roles.deleteBlocked'));
  });

  it('deletes an empty custom role after one confirmation', async () => {
    const wrapper = await mountRoles();

    await wrapper.get('[data-testid="role-custom-grid"] [data-testid="role-delete"]').trigger('click');
    await flushPromises();

    expect(showConfirmDialog).toHaveBeenCalledWith({
      title: t('org.roles.deleteTitle'),
      message: t('org.roles.deleteMessage', { name: 'Support' })
    });
    expect(rolApi.deleteRole).toHaveBeenCalledWith('org-1', 'role-custom');
    expect(toasts().join('|')).toContain(t('org.roles.deletedToast'));
  });

  it('shows what a role can do without letting anyone change it', async () => {
    const wrapper = await mountRoles();

    await wrapper.findAll('[data-testid="role-view"]')[0].trigger('click');
    const detail = wrapper.get('[data-testid="role-detail"]');
    expect(detail.text()).toContain(t('org.role.owner'));
    expect(detail.get('[data-testid="permission-tree"]').attributes('data-readonly')).toBe('true');
    expect(detail.findAll('input[type="checkbox"]').every((box) => box.attributes('disabled') !== undefined)).toBe(true);

    await detail.get('[data-testid="role-detail-close"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="role-detail"]').exists()).toBe(false);
  });

  it('hides role management from someone without the right', async () => {
    const wrapper = await mountRoles();
    useOrganizationStore().userPermissions = ['organization:view_members'];
    await flushPromises();

    expect(wrapper.find('[data-testid="role-create"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="role-edit"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="role-delete"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="role-view"]').length).toBeGreaterThan(0);
  });

  it('reports a role list it could not read and tries again on request', async () => {
    rolApi.getRoles.mockRejectedValue(new Error('boom'));
    const wrapper = await mountRoles();
    expect(wrapper.find('[data-testid="org-error"]').exists()).toBe(true);

    rolApi.getRoles.mockResolvedValue(PRESETS);
    await wrapper.get('[data-testid="org-retry"]').trigger('click');
    await flushPromises();

    expect(rolApi.getRoles.mock.calls.length).toBeGreaterThan(1);
    expect(wrapper.find('[data-testid="org-error"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="role-builtin-grid"] [data-role-id]')).toHaveLength(2);
  });
});

describe('Settings view', () => {
  const ROSTER = {
    items: [
      member({ id: 'mem-owner', userId: 'u-owner', roleId: 'role-owner', roleKind: 'owner' }),
      member({ id: 'mem-2', name: 'Joseph Mwangi', email: 'joseph@example.com' }),
      member({ id: 'mem-3', name: 'Daniel Kimaro', email: 'daniel@example.com', status: 'disabled' })
    ],
    total: 3,
    hasMore: false
  };

  async function mountSettings(patch: Partial<Organization> = {}) {
    orgApi.getCurrentOrganization.mockResolvedValue(org(patch));
    await signedInWithTenant(patch);
    return mountView(SettingsView, '/dashboard/organization/settings');
  }

  async function openTransfer(wrapper: VueWrapper) {
    await wrapper.get('[data-tab="danger"]').trigger('click');
    await wrapper.get('[data-testid="settings-transfer-open"]').trigger('click');
    await flushPromises();
    return wrapper.get('[data-testid="settings-transfer-form"]');
  }

  it('opens on the basic tab with the tenant already filled in', async () => {
    const wrapper = await mountSettings();

    expect(orgApi.getOrganizationSettings).toHaveBeenCalledWith('org-1');
    expect(memApi.getMembers).toHaveBeenCalledWith('org-1', { limit: 20, offset: 0 });
    expect(wrapper.findAll('[data-testid="settings-tab"]')).toHaveLength(5);
    expect(wrapper.get('[data-tab="basic"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.find('[data-testid="settings-panel-basic"]').exists()).toBe(true);
    expect((wrapper.get('[data-testid="settings-name"]').element as HTMLInputElement).value).toBe(
      'Kili Social'
    );
  });

  it('shows one panel at a time', async () => {
    const wrapper = await mountSettings();

    for (const name of ['security', 'notifications', 'data', 'danger']) {
      await wrapper.get('[data-tab="' + name + '"]').trigger('click');
      expect(wrapper.find('[data-testid="settings-panel-' + name + '"]').exists(), name).toBe(true);
      expect(wrapper.find('[data-testid="settings-panel-basic"]').exists(), name).toBe(false);
      expect(wrapper.get('[data-tab="' + name + '"]').attributes('aria-selected')).toBe('true');
    }
  });

  it('saves the basic details', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-testid="settings-name"]').setValue('Kili Trade');
    await wrapper.get('[data-testid="settings-logo"]').setValue('https://cdn.test/logo.png');
    await wrapper.get('[data-testid="settings-save-basic"]').trigger('click');
    await flushPromises();

    expect(orgApi.updateOrganization).toHaveBeenCalledWith('org-1', {
      name: 'Kili Trade',
      logoUrl: 'https://cdn.test/logo.png',
      description: undefined
    });
    expect(toasts().join('|')).toContain(t('org.settings.savedToast'));
  });

  it('refuses to blank the name in the basic tab', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-testid="settings-name"]').setValue('   ');
    await wrapper.get('[data-testid="settings-save-basic"]').trigger('click');
    await flushPromises();

    expect(orgApi.updateOrganization).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="settings-name-error"]').text()).toBe(
      t('org.error.nameRequired')
    );
  });

  it('sends only the security section it edited', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-tab="security"]').trigger('click');
    await wrapper.get('[data-testid="settings-2fa"]').setValue(true);
    await wrapper.get('[data-testid="settings-save-security"]').trigger('click');
    await flushPromises();

    expect(orgApi.updateOrganizationSettings).toHaveBeenCalledWith('org-1', {
      security: { twoFactorRequired: true, ipAllowlist: ['10.0.0.1'], sessionTimeoutMinutes: 60 }
    });
    expect(toasts().join('|')).toContain(t('org.settings.savedToast'));
  });

  it('edits the ip allowlist and rejects a malformed entry', async () => {
    const wrapper = await mountSettings();
    await wrapper.get('[data-tab="security"]').trigger('click');
    expect(wrapper.findAll('[data-testid="settings-ip-list"] .st__chip')).toHaveLength(1);

    await wrapper.get('[data-testid="settings-ip-input"]').setValue('not-an-ip');
    await wrapper.get('[data-testid="settings-ip-add"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="settings-ip-error"]').text()).toBe(t('org.error.ipInvalid'));
    expect(wrapper.findAll('[data-testid="settings-ip-list"] .st__chip')).toHaveLength(1);

    await wrapper.get('[data-testid="settings-ip-input"]').setValue('203.0.113.7');
    await wrapper.get('[data-testid="settings-ip-add"]').trigger('click');
    await flushPromises();
    const chips = wrapper.findAll('[data-testid="settings-ip-list"] .st__chip');
    expect(chips).toHaveLength(2);
    expect(chips[1].text()).toContain('203.0.113.7');
    expect(wrapper.find('[data-testid="settings-ip-error"]').exists()).toBe(false);

    await chips[0].get('[data-testid="settings-ip-remove"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="settings-ip-list"] .st__chip')).toHaveLength(1);
  });

  it('sends only the notification switches', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-tab="notifications"]').trigger('click');
    await wrapper.get('[data-testid="settings-notify-roleChanged"]').setValue(false);
    await wrapper.get('[data-testid="settings-save-notifications"]').trigger('click');
    await flushPromises();

    expect(orgApi.updateOrganizationSettings).toHaveBeenCalledWith('org-1', {
      notifications: {
        memberJoined: true,
        memberRemoved: true,
        roleChanged: false,
        criticalAction: true
      }
    });
  });

  it('sends the retention choice and confirms an export request', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-tab="data"]').trigger('click');
    await wrapper.get('[data-testid="settings-message-retention"]').setValue('365');
    await wrapper.get('[data-testid="settings-save-data"]').trigger('click');
    await flushPromises();

    expect(orgApi.updateOrganizationSettings).toHaveBeenCalledWith('org-1', {
      data: { messageRetentionDays: 365, logRetentionDays: 90 }
    });

    await wrapper.get('[data-testid="settings-export"]').trigger('click');
    expect(toasts().join('|')).toContain(t('org.settings.exportStarted'));
  });

  it('keeps the danger controls away from an admin', async () => {
    const wrapper = await mountSettings({ myRoleKind: 'admin' });

    await wrapper.get('[data-tab="danger"]').trigger('click');
    expect(wrapper.find('[data-testid="settings-panel-danger"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-transfer-open"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-delete-open"]').exists()).toBe(false);
  });

  it('disables saving for a role that cannot manage the tenant', async () => {
    const wrapper = await mountSettings({ myRoleKind: 'viewer' });

    await wrapper.get('[data-tab="security"]').trigger('click');
    expect(
      (wrapper.get('[data-testid="settings-save-security"]').element as HTMLButtonElement).disabled
    ).toBe(true);
    await wrapper.get('[data-tab="danger"]').trigger('click');
    expect(wrapper.find('[data-testid="settings-delete-open"]').exists()).toBe(false);
  });

  it('offers only active teammates who are not the owner', async () => {
    memApi.getMembers.mockResolvedValue(ROSTER);
    const wrapper = await mountSettings();
    const form = await openTransfer(wrapper);

    const options = form.findAll('[data-testid="settings-transfer-member"] option');
    expect(options).toHaveLength(2);
    expect(options[1].attributes('value')).toBe('mem-2');
    expect(options[1].text()).toContain('Joseph Mwangi');
  });

  it('names what is missing before ownership can move', async () => {
    memApi.getMembers.mockResolvedValue(ROSTER);
    const wrapper = await mountSettings();
    const form = await openTransfer(wrapper);

    await form.trigger('submit');
    await flushPromises();
    expect(wrapper.get('[data-testid="settings-transfer-target-error"]').text()).toBe(
      t('org.error.transferTarget')
    );
    expect(orgApi.transferOwnership).not.toHaveBeenCalled();

    await form.get('[data-testid="settings-transfer-member"]').setValue('mem-2');
    await form.get('[data-testid="settings-transfer-confirm"]').setValue('wrong name');
    await form.trigger('submit');
    await flushPromises();
    expect(wrapper.get('[data-testid="settings-transfer-error"]').text()).toBe(
      t('org.settings.confirmMismatch')
    );
    expect(orgApi.transferOwnership).not.toHaveBeenCalled();
  });

  it('transfers ownership once the name is typed in', async () => {
    memApi.getMembers.mockResolvedValue(ROSTER);
    const wrapper = await mountSettings();
    const form = await openTransfer(wrapper);

    await form.get('[data-testid="settings-transfer-member"]').setValue('mem-2');
    await form.get('[data-testid="settings-transfer-confirm"]').setValue('kili social');
    await form.trigger('submit');
    await flushPromises();

    expect(orgApi.transferOwnership).toHaveBeenCalledWith('org-1', 'mem-2');
    expect(toasts().join('|')).toContain(t('org.settings.transferredToast'));
    expect(wrapper.find('[data-testid="settings-transfer-form"]').exists()).toBe(false);
  });

  it('cancels the transfer without touching the server', async () => {
    memApi.getMembers.mockResolvedValue(ROSTER);
    const wrapper = await mountSettings();
    const form = await openTransfer(wrapper);

    await form.get('[data-testid="settings-transfer-cancel"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-transfer-form"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-transfer-open"]').exists()).toBe(true);
    expect(orgApi.transferOwnership).not.toHaveBeenCalled();
  });

  it('deletes the tenant only on an exact name, then leaves it', async () => {
    const wrapper = await mountSettings();

    await wrapper.get('[data-tab="danger"]').trigger('click');
    await wrapper.get('[data-testid="settings-delete-open"]').trigger('click');
    const form = wrapper.get('[data-testid="settings-delete-form"]');

    await form.get('[data-testid="settings-delete-confirm"]').setValue('Kili Sociall');
    await form.trigger('submit');
    await flushPromises();
    expect(wrapper.get('[data-testid="settings-delete-error"]').text()).toBe(
      t('org.settings.confirmMismatch')
    );
    expect(orgApi.deleteOrganization).not.toHaveBeenCalled();

    await form.get('[data-testid="settings-delete-confirm"]').setValue('Kili Social');
    await form.trigger('submit');
    await flushPromises();

    expect(orgApi.deleteOrganization).toHaveBeenCalledWith('org-1');
    expect(toasts().join('|')).toContain(t('org.settings.deletedToast'));
    expect(router.currentRoute.value.path).toBe('/dashboard/organization/switch');
  });

  it('reports settings it could not read and offers a retry', async () => {
    orgApi.getOrganizationSettings.mockRejectedValue(new Error('boom'));
    const wrapper = await mountSettings();

    expect(wrapper.find('[data-testid="org-error"]').exists()).toBe(true);
    await wrapper.get('[data-testid="org-retry"]').trigger('click');
    await flushPromises();
    expect(orgApi.getOrganizationSettings.mock.calls.length).toBeGreaterThan(1);
  });
});
