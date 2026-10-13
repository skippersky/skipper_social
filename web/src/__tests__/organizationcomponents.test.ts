/**
 * Sprint 13 organisation components.
 *
 * Mounting tests for the nine components the module ships. Each is exercised
 * through its public surface only - props in, emitted events and rendered text
 * out - because that contract is what the five organisation pages are built on.
 * The store is the real one and only the four api modules are mocked, so
 * OrgSwitcher and OrgPageShell are tested against the same tenant and permission
 * state a page hands them rather than against a stub free to drift.
 *
 * Components are attached to the document because two of them listen on it:
 * OrgSwitcher closes on an outside click, and the permission directive measures
 * nothing but does expect a real element.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { h, nextTick, type Component } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { showToast } from 'vant';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { setRequestContext } from '../api/http';
import ActivityFeed from '../components/organization/ActivityFeed.vue';
import InviteDialog from '../components/organization/InviteDialog.vue';
import MemberTable from '../components/organization/MemberTable.vue';
import OrgCard from '../components/organization/OrgCard.vue';
import OrgPageShell from '../components/organization/OrgPageShell.vue';
import OrgSwitcher from '../components/organization/OrgSwitcher.vue';
import PermissionTree from '../components/organization/PermissionTree.vue';
import PermissionGuard from '../components/permission/PermissionGuard.vue';
import RoleBadge from '../components/permission/RoleBadge.vue';
import { useI18nStore } from '../i18n';
import { INVITE_MESSAGE_MAX } from '../lib/organization';
import { PERMISSION_GROUPS } from '../lib/permissions';
import { useAuthStore } from '../stores/auth';
import { useOrganizationStore } from '../stores/organization';
import type {
  Member,
  OrgActivity,
  Organization,
  PermissionGroup,
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
    memberCount: 12,
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

/** The three assignable kinds, owner included so the dialog has something to drop. */
const ROLE_CHOICES: Role[] = [
  role({ id: 'role-owner', name: 'org.role.owner', kind: 'owner' }),
  role({ id: 'role-admin', name: 'org.role.admin', kind: 'admin' }),
  role({ id: 'role-member', name: 'org.role.member', kind: 'member' })
];

const stub = { render: () => h('div') };

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/dashboard/organization', component: stub },
      { path: '/dashboard/organization/members', component: stub },
      { path: '/dashboard/organization/roles', component: stub },
      { path: '/dashboard/organization/settings', component: stub },
      { path: '/dashboard/organization/switch', component: stub },
      { path: '/onboarding/create-org', component: stub }
    ]
  });
}

let pinia: Pinia;
let router: Router;
const live: VueWrapper[] = [];

async function mountComponent(
  component: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) {
  router = buildRouter();
  await router.push('/home');
  await router.isReady();
  const wrapper = mount(component, {
    props,
    slots,
    global: { plugins: [pinia, router] },
    attachTo: document.body
  });
  live.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  setRequestContext(null);
  pinia = createPinia();
  setActivePinia(pinia);
  vi.clearAllMocks();
  useI18nStore().setLocale('en');
  orgApi.getOrganizations.mockResolvedValue([org()]);
  orgApi.getCurrentOrganization.mockResolvedValue(org());
  orgApi.switchOrganization.mockResolvedValue({
    orgId: 'org-2',
    orgName: 'Kili Trade',
    roleId: 'role-member',
    roleKind: 'member'
  });
  memApi.getMembers.mockResolvedValue({ items: [member()], total: 1, hasMore: false });
  memApi.getInvitations.mockResolvedValue([]);
  rolApi.getRoles.mockResolvedValue(ROLE_CHOICES);
  perApi.getPermissions.mockResolvedValue(PERMISSION_GROUPS);
  perApi.getUserPermissions.mockResolvedValue([]);
  document.body.innerHTML = '';
  document.title = '';
});

afterEach(() => {
  for (const wrapper of live.splice(0)) {
    if (wrapper.exists()) wrapper.unmount();
  }
  document.body.innerHTML = '';
  setRequestContext(null);
  localStorage.clear();
});

describe('RoleBadge', () => {
  it('labels a built-in kind and carries it into the styling hooks', async () => {
    const wrapper = await mountComponent(RoleBadge, { kind: 'admin' });
    const badge = wrapper.get('[data-role-kind="admin"]');

    expect(badge.text()).toContain(t('org.role.admin'));
    expect(badge.classes()).toContain('rb--admin');
    expect(badge.classes()).toContain('rb--md');
    expect(badge.attributes('title')).toBe(t('org.role.admin'));
  });

  it('prefers an explicit label and only decorates the owner', async () => {
    const owner = await mountComponent(RoleBadge, { kind: 'owner' });
    expect(owner.find('.rb__icon').exists()).toBe(true);

    const custom = await mountComponent(RoleBadge, {
      kind: 'custom',
      label: 'Field Team',
      size: 'sm'
    });
    expect(custom.find('.rb__icon').exists()).toBe(false);
    expect(custom.text()).toContain('Field Team');
    expect(custom.get('[data-role-kind="custom"]').classes()).toContain('rb--sm');
  });
});

describe('PermissionGuard', () => {
  const slot = { default: () => h('span', { id: 'inner' }, 'protected') };

  it('renders the slot when nothing is required', async () => {
    const wrapper = await mountComponent(PermissionGuard, {}, slot);

    expect(wrapper.find('#inner').exists()).toBe(true);
  });

  it('withholds the slot and shows the fallback instead', async () => {
    useOrganizationStore().userPermissions = ['customer:view'];
    const wrapper = await mountComponent(
      PermissionGuard,
      { permission: 'customer:delete' },
      { ...slot, fallback: () => h('span', { id: 'fb' }, 'Ask an admin') }
    );

    expect(wrapper.find('#inner').exists()).toBe(false);
    expect(wrapper.get('#fb').text()).toBe('Ask an admin');
  });

  it('renders nothing at all when denied without a fallback', async () => {
    useOrganizationStore().userPermissions = [];
    const wrapper = await mountComponent(PermissionGuard, { permission: 'customer:delete' }, slot);

    expect(wrapper.find('#inner').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('protected');
  });

  it('combines several rights in any and all mode', async () => {
    useOrganizationStore().userPermissions = ['customer:view'];
    const wanted = ['customer:view', 'customer:delete'];

    const any = await mountComponent(PermissionGuard, { permissions: wanted }, slot);
    expect(any.find('#inner').exists()).toBe(true);

    const all = await mountComponent(PermissionGuard, { permissions: wanted, mode: 'all' }, slot);
    expect(all.find('#inner').exists()).toBe(false);
  });

  it('re-renders when the cached rights arrive after bootstrap', async () => {
    const store = useOrganizationStore();
    store.userPermissions = [];
    const wrapper = await mountComponent(PermissionGuard, { permission: 'customer:delete' }, slot);
    expect(wrapper.find('#inner').exists()).toBe(false);

    store.userPermissions = ['customer:delete'];
    await nextTick();

    expect(wrapper.find('#inner').exists()).toBe(true);
  });
});

describe('OrgCard', () => {
  it('shows the identity, the role and the member count', async () => {
    const wrapper = await mountComponent(OrgCard, { organization: org() });

    expect(wrapper.get('.oc__name').text()).toBe('Kili Social');
    expect(wrapper.get('.oc').attributes('data-org-id')).toBe('org-1');
    expect(wrapper.text()).toContain(t('org.membersCount', { n: 12 }));
    expect(wrapper.findComponent(RoleBadge).props('kind')).toBe('owner');
  });

  it('emits select for a selectable card and stays inert otherwise', async () => {
    const wrapper = await mountComponent(OrgCard, { organization: org() });
    await wrapper.get('.oc').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['org-1']);

    const inert = await mountComponent(OrgCard, { organization: org(), selectable: false });
    expect(inert.get('.oc').attributes('role')).toBeUndefined();
    expect(inert.get('.oc').classes()).toContain('is-static');
    await inert.get('.oc').trigger('click');
    expect(inert.emitted('select')).toBeUndefined();
  });

  it('selects from the keyboard as well as the pointer', async () => {
    const wrapper = await mountComponent(OrgCard, { organization: org({ id: 'org-9' }) });

    await wrapper.get('.oc').trigger('keydown.enter');

    expect(wrapper.emitted('select')?.[0]).toEqual(['org-9']);
  });

  it('marks the active tenant', async () => {
    const wrapper = await mountComponent(OrgCard, { organization: org(), active: true });

    expect(wrapper.get('.oc').attributes('aria-current')).toBe('true');
    expect(wrapper.get('.oc__active').text()).toBe(t('org.currentBadge'));
  });
});

describe('ActivityFeed', () => {
  it('says so when there is nothing to show', async () => {
    const wrapper = await mountComponent(ActivityFeed, { activities: [] });

    expect(wrapper.get('[data-testid="activity-empty"]').text()).toBe(t('org.activity.empty'));
    expect(wrapper.find('[data-testid="activity-feed"]').exists()).toBe(false);
  });

  it('turns a kind into a verb and keeps the target when there is one', async () => {
    const wrapper = await mountComponent(ActivityFeed, {
      activities: [
        activity({ kind: 'member_joined' }),
        activity({ id: 'act-2', kind: 'role_changed', targetName: 'Baraka Otieno' })
      ]
    });
    const rows = wrapper.findAll('.af__row');

    expect(rows).toHaveLength(2);
    expect(rows[0].get('.af__text').text()).toBe('Amani Juma ' + t('org.activity.member_joined'));
    expect(rows[1].get('.af__text').text()).toBe(
      'Amani Juma ' + t('org.activity.role_changed') + ' Baraka Otieno'
    );
    expect(rows[0].attributes('data-kind')).toBe('member_joined');
    expect(rows[0].get('time').attributes('datetime')).toBe(new Date(NOW).toISOString());
  });

  it('caps the list at the limit and defaults to ten', async () => {
    const many = Array.from({ length: 14 }, (_, index) => activity({ id: 'act-' + index }));

    const capped = await mountComponent(ActivityFeed, { activities: many, limit: 5 });
    expect(capped.findAll('.af__row')).toHaveLength(5);

    const defaulted = await mountComponent(ActivityFeed, { activities: many });
    expect(defaulted.findAll('.af__row')).toHaveLength(10);
  });
});

describe('MemberTable', () => {
  const roles = [role(), role({ id: 'role-admin', name: 'org.role.admin', kind: 'admin' })];

  it('renders one row per member and marks the signed-in one', async () => {
    const wrapper = await mountComponent(MemberTable, {
      members: [member(), member({ id: 'mem-2', name: 'Baraka Otieno', email: 'baraka@example.com' })],
      roles,
      selfId: 'mem-1'
    });
    const rows = wrapper.findAll('tbody tr');

    expect(rows).toHaveLength(2);
    expect(rows[0].get('.mt__you').text()).toBe(t('org.members.you'));
    expect(rows[0].get('.mt__email').text()).toBe('amani@example.com');
    expect(rows[1].find('.mt__you').exists()).toBe(false);
  });

  it('locks the owner row against role changes and removal', async () => {
    const wrapper = await mountComponent(MemberTable, {
      members: [
        member({ id: 'mem-owner', userId: 'u-owner', roleId: 'role-owner', roleKind: 'owner' })
      ],
      roles,
      ownerId: 'u-owner'
    });

    expect(wrapper.find('[data-role-select="mem-owner"]').exists()).toBe(false);
    expect(wrapper.findComponent(RoleBadge).exists()).toBe(true);
    expect(wrapper.find('[data-remove="mem-owner"]').exists()).toBe(false);
    expect(wrapper.find('[data-toggle-status="mem-owner"]').exists()).toBe(false);
    /* Detail stays: reading a row is never a privileged act. */
    expect(wrapper.find('[data-detail="mem-owner"]').exists()).toBe(true);
  });

  it('emits a role change only when the value actually moves', async () => {
    const wrapper = await mountComponent(MemberTable, { members: [member()], roles });
    const select = wrapper.get('[data-role-select="mem-1"]');

    await select.setValue('role-member');
    expect(wrapper.emitted('change-role')).toBeUndefined();

    await select.setValue('role-admin');
    expect(wrapper.emitted('change-role')?.[0]).toEqual(['mem-1', 'role-admin']);
  });

  it('emits the row actions', async () => {
    const wrapper = await mountComponent(MemberTable, { members: [member()], roles });

    await wrapper.get('[data-detail="mem-1"]').trigger('click');
    await wrapper.get('[data-toggle-status="mem-1"]').trigger('click');
    await wrapper.get('[data-remove="mem-1"]').trigger('click');

    expect(wrapper.emitted('detail')?.[0]?.[0]).toMatchObject({ id: 'mem-1' });
    expect(wrapper.emitted('toggle-status')?.[0]).toEqual(['mem-1', 'disabled']);
    expect(wrapper.emitted('remove')?.[0]?.[0]).toMatchObject({ id: 'mem-1' });
  });

  it('hides every mutation from a viewer and flips a disabled member back', async () => {
    const readonly = await mountComponent(MemberTable, {
      members: [member()],
      roles,
      canEdit: false
    });
    expect(readonly.find('[data-remove="mem-1"]').exists()).toBe(false);
    expect(readonly.find('[data-role-select="mem-1"]').exists()).toBe(false);

    const wrapper = await mountComponent(MemberTable, {
      members: [member({ id: 'mem-3', status: 'disabled' })],
      roles
    });
    expect(wrapper.get('.mt__status').text()).toBe(t('org.members.statusDisabled'));
    await wrapper.get('[data-toggle-status="mem-3"]').trigger('click');
    expect(wrapper.emitted('toggle-status')?.[0]).toEqual(['mem-3', 'active']);
  });

  it('says never for a member who has not signed in and freezes while saving', async () => {
    const wrapper = await mountComponent(MemberTable, {
      members: [member({ lastLoginAt: undefined })],
      roles,
      saving: true
    });

    expect(wrapper.text()).toContain(t('org.members.neverLoggedIn'));
    expect((wrapper.get('[data-role-select="mem-1"]').element as HTMLSelectElement).disabled).toBe(true);
    expect((wrapper.get('[data-remove="mem-1"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('falls back to the raw role id when the catalog has not arrived', async () => {
    const wrapper = await mountComponent(MemberTable, { members: [member()], roles: [] });

    expect(wrapper.text()).toContain('role-member');
  });
});

describe('PermissionTree', () => {
  const first = PERMISSION_GROUPS[0];
  const second = PERMISSION_GROUPS[1];

  it('starts with only the first group open', async () => {
    const wrapper = await mountComponent(PermissionTree, { modelValue: [] });

    expect(wrapper.findAll('[data-group]')).toHaveLength(PERMISSION_GROUPS.length);
    expect(wrapper.find('[data-group="' + first.key + '"] .pt__list').exists()).toBe(true);
    expect(wrapper.find('[data-group="' + second.key + '"] .pt__list').exists()).toBe(false);
  });

  it('opens and closes a group from the caret and from the label', async () => {
    const wrapper = await mountComponent(PermissionTree, { modelValue: [] });

    await wrapper.get('[data-group-caret="' + second.key + '"]').trigger('click');
    expect(wrapper.find('[data-group="' + second.key + '"] .pt__list').exists()).toBe(true);

    await wrapper.get('[data-group-header="' + second.key + '"]').trigger('click');
    expect(wrapper.find('[data-group="' + second.key + '"] .pt__list').exists()).toBe(false);
    expect(
      wrapper.get('[data-group-caret="' + second.key + '"]').attributes('aria-expanded')
    ).toBe('false');
  });

  it('counts the selection and toggles one permission', async () => {
    const wrapper = await mountComponent(PermissionTree, {
      modelValue: [first.permissions[0].key, first.permissions[1].key]
    });
    expect(wrapper.get('[data-testid="permission-count"]').text()).toBe(
      t('org.roles.editorSelected', { n: 2 })
    );

    const blank = await mountComponent(PermissionTree, { modelValue: [] });
    await blank.get('[data-permission-input="' + first.permissions[0].key + '"]').setValue(true);
    expect(blank.emitted('update:modelValue')?.[0]).toEqual([[first.permissions[0].key]]);
  });

  it('deselects a permission the draft already holds', async () => {
    const keys = [first.permissions[0].key, first.permissions[1].key];
    const wrapper = await mountComponent(PermissionTree, { modelValue: keys });

    await wrapper.get('[data-permission-input="' + keys[0] + '"]').setValue(false);

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[keys[1]]]);
  });

  it('selects and clears a whole group from its header checkbox', async () => {
    const keys = first.permissions.map((permission) => permission.key);

    const blank = await mountComponent(PermissionTree, { modelValue: [] });
    await blank.get('[data-group-toggle="' + first.key + '"]').setValue(true);
    expect(blank.emitted('update:modelValue')?.[0]?.[0]).toEqual(keys);

    const full = await mountComponent(PermissionTree, { modelValue: keys });
    expect((full.get('[data-group-toggle="' + first.key + '"]').element as HTMLInputElement).checked)
      .toBe(true);
    await full.get('[data-group-toggle="' + first.key + '"]').setValue(false);
    expect(full.emitted('update:modelValue')?.[0]?.[0]).toEqual([]);
  });

  it('marks a partly chosen group without checking its box', async () => {
    const wrapper = await mountComponent(PermissionTree, {
      modelValue: [first.permissions[0].key]
    });

    expect((wrapper.get('[data-group-toggle="' + first.key + '"]').element as HTMLInputElement).checked)
      .toBe(false);
    expect(wrapper.get('[data-group="' + first.key + '"] .pt__group-label').classes())
      .toContain('is-partial');
  });

  it('renders read-only without emitting', async () => {
    const wrapper = await mountComponent(PermissionTree, {
      modelValue: [first.permissions[0].key],
      readonly: true
    });

    expect(wrapper.get('[data-testid="permission-tree"]').attributes('data-readonly')).toBe('true');
    expect(
      (wrapper.get('[data-permission-input="' + first.permissions[0].key + '"]')
        .element as HTMLInputElement).disabled
    ).toBe(true);

    await wrapper.get('[data-group-toggle="' + first.key + '"]').trigger('click');
    await wrapper.get('[data-permission-input="' + first.permissions[0].key + '"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('prefers a catalog fetched from the server', async () => {
    const groups: PermissionGroup[] = [
      {
        key: 'server',
        label: 'org.permGroup.customer',
        permissions: [{ key: 'server:read', group: 'server', label: 'org.perm.customer.view' }]
      }
    ];
    const wrapper = await mountComponent(PermissionTree, { modelValue: [], groups });

    expect(wrapper.findAll('[data-group]')).toHaveLength(1);
    expect(wrapper.find('[data-group="server"]').exists()).toBe(true);
  });
});

describe('InviteDialog', () => {
  it('renders nothing while closed', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: false, roles: ROLE_CHOICES });

    expect(wrapper.find('[data-testid="invite-dialog"]').exists()).toBe(false);
  });

  it('never offers the owner role and defaults to the chosen one', async () => {
    const wrapper = await mountComponent(InviteDialog, {
      show: true,
      roles: ROLE_CHOICES,
      defaultRoleId: 'role-member'
    });
    const buttons = wrapper.findAll('[data-testid="invite-role"]');

    expect(buttons.map((button) => button.attributes('data-role-id'))).toEqual([
      'role-admin',
      'role-member'
    ]);
    expect(buttons[1].attributes('aria-checked')).toBe('true');
    expect(buttons[0].attributes('aria-checked')).toBe('false');
  });

  it('changes the selected role from the radio row', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });
    const buttons = wrapper.findAll('[data-testid="invite-role"]');

    await buttons[1].trigger('click');

    expect(buttons[1].attributes('aria-checked')).toBe('true');
    expect(buttons[0].attributes('aria-checked')).toBe('false');
  });

  it('parses a pasted list live and de-duplicates it', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-emails"]').setValue('a@x.com, A@X.com; b@x.com');

    expect(wrapper.get('[data-testid="invite-parsed"]').text()).toBe(
      t('org.invite.parsedCount', { n: 2 })
    );
  });

  it('refuses an empty batch before it can be sent', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-submit"]').trigger('click');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.get('[data-testid="invite-emails-error"]').text()).toBe(
      t('org.error.emailRequired')
    );
    expect(wrapper.get('[data-testid="invite-emails"]').attributes('aria-invalid')).toBe('true');
  });

  it('flags an address that already belongs to the roster', async () => {
    const wrapper = await mountComponent(InviteDialog, {
      show: true,
      roles: ROLE_CHOICES,
      existingEmails: ['old@x.com']
    });

    await wrapper.get('[data-testid="invite-emails"]').setValue('OLD@x.com');
    await wrapper.get('[data-testid="invite-submit"]').trigger('click');

    expect(wrapper.get('[data-testid="invite-emails-error"]').text()).toBe(
      t('org.error.emailAlreadyMember')
    );
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('clears the complaint when the field is emptied again', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-submit"]').trigger('click');
    expect(wrapper.find('[data-testid="invite-emails-error"]').exists()).toBe(true);

    await wrapper.get('[data-testid="invite-emails"]').setValue('   ');
    await flushPromises();

    expect(wrapper.find('[data-testid="invite-emails-error"]').exists()).toBe(false);
  });

  it('emits the parsed batch on a valid submit', async () => {
    const wrapper = await mountComponent(InviteDialog, {
      show: true,
      roles: ROLE_CHOICES,
      defaultRoleId: 'role-member'
    });

    await wrapper.get('[data-testid="invite-emails"]').setValue('new@x.com');
    await wrapper.get('[data-testid="invite-message"]').setValue('  Join us  ');
    await wrapper.get('[data-testid="invite-submit"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      emailsRaw: 'new@x.com',
      emails: ['new@x.com'],
      roleId: 'role-member',
      message: 'Join us'
    });
  });

  it('omits a blank message rather than sending an empty one', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-emails"]').setValue('new@x.com');
    await wrapper.get('[data-testid="invite-submit"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ message: undefined });
  });

  it('refuses a note longer than the limit', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-emails"]').setValue('new@x.com');
    await wrapper
      .get('[data-testid="invite-message"]')
      .setValue('x'.repeat(INVITE_MESSAGE_MAX + 1));
    await wrapper.get('[data-testid="invite-submit"]').trigger('click');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect((wrapper.vm as unknown as { errors: Record<string, string> }).errors.message).toBe(
      'org.error.messageTooLong'
    );
  });

  it('closes from the button and from a click on the overlay', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-close"]').trigger('click');
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);

    await wrapper.get('[data-testid="invite-dialog"]').trigger('click');
    expect(wrapper.emitted('update:show')).toHaveLength(2);
  });

  it('clears the form when it is reopened', async () => {
    const wrapper = await mountComponent(InviteDialog, { show: true, roles: ROLE_CHOICES });

    await wrapper.get('[data-testid="invite-emails"]').setValue('stale@x.com');
    await wrapper.setProps({ show: false });
    await wrapper.setProps({ show: true, defaultRoleId: 'role-admin' });

    expect(
      (wrapper.get('[data-testid="invite-emails"]').element as HTMLTextAreaElement).value
    ).toBe('');
    expect(wrapper.findAll('[data-testid="invite-role"]')[0].attributes('aria-checked')).toBe('true');
  });

  it('freezes the submit button while the request is in flight', async () => {
    const wrapper = await mountComponent(InviteDialog, {
      show: true,
      roles: ROLE_CHOICES,
      saving: true
    });

    expect(
      (wrapper.get('[data-testid="invite-submit"]').element as HTMLButtonElement).disabled
    ).toBe(true);
  });
});

describe('OrgPageShell', () => {
  it('renders the heading and the slotted body, and navigates home', async () => {
    const wrapper = await mountComponent(
      OrgPageShell,
      { title: 'Overview', subtitle: 'Members and roles' },
      { default: () => h('p', { id: 'body' }, 'content') }
    );

    expect(wrapper.get('[data-testid="org-page-title"]').text()).toBe('Overview');
    expect(wrapper.get('.ops__subtitle').text()).toBe('Members and roles');
    expect(wrapper.get('#body').text()).toBe('content');

    await wrapper.get('[data-testid="org-back"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('writes the document title and description', async () => {
    await mountComponent(OrgPageShell, {
      title: 'Overview',
      metaTitle: 'Organisation',
      metaDescription: 'Manage the workspace'
    });

    expect(document.title).toBe('Organisation - KiliSocial');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Manage the workspace'
    );
  });

  it('hides the tabs a viewer has no right to open', async () => {
    useOrganizationStore().userPermissions = ['organization:view_members'];
    const wrapper = await mountComponent(OrgPageShell, { title: 'Overview', active: 'overview' });
    const tabs = wrapper.findAll('[data-testid="org-nav"]');

    expect(tabs.map((tab) => tab.attributes('data-nav'))).toEqual([
      'overview',
      'members',
      'switch'
    ]);
    expect(tabs[0].attributes('aria-current')).toBe('page');

    await tabs[2].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/organization/switch');
  });

  it('offers all five tabs to a wildcard holder', async () => {
    useOrganizationStore().userPermissions = ['*'];
    const wrapper = await mountComponent(OrgPageShell, { title: 'Overview' });

    expect(wrapper.findAll('[data-testid="org-nav"]')).toHaveLength(5);
  });

  it('exposes exactly the tabs the route guard would have allowed', async () => {
    useOrganizationStore().userPermissions = ['organization:manage_roles'];
    const wrapper = await mountComponent(OrgPageShell, { title: 'Overview' });
    const shell = wrapper.vm as unknown as { navItems: { key: string }[] };

    expect(shell.navItems.map((item) => item.key)).toEqual(['overview', 'roles', 'switch']);
    /* Overview and Switch ask for no right, so a signed-in user is never left
       without a tab and the bar never collapses to nothing. */
    expect(shell.navItems.length).toBeGreaterThan(1);
    expect(wrapper.find('.ops__nav').exists()).toBe(true);
  });

  it('discloses sample data and lets the page dismiss it for good', async () => {
    const wrapper = await mountComponent(OrgPageShell, { title: 'Overview', demo: true });
    expect(wrapper.find('[data-testid="org-demo-bar"]').exists()).toBe(true);

    await wrapper.get('[data-testid="org-demo-hide"]').trigger('click');

    expect(wrapper.find('[data-testid="org-demo-bar"]').exists()).toBe(false);
    expect(wrapper.emitted('hide-demo')).toHaveLength(1);
  });

  it('keeps the disclosure hidden when the page says there is no sample data', async () => {
    const wrapper = await mountComponent(OrgPageShell, { title: 'Overview', demo: false });

    expect(wrapper.find('[data-testid="org-demo-bar"]').exists()).toBe(false);
  });

  it('surfaces a failure with a retry and marks the body busy while loading', async () => {
    const wrapper = await mountComponent(OrgPageShell, {
      title: 'Overview',
      error: 'api.network',
      loading: true
    });

    expect(wrapper.get('[data-testid="org-error"]').text()).toContain(t('api.network'));
    expect(wrapper.get('[data-testid="org-error"]').attributes('role')).toBe('alert');
    expect(wrapper.get('.ops__body').attributes('aria-busy')).toBe('true');

    await wrapper.get('[data-testid="org-retry"]').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('renders the page actions in the header slot', async () => {
    const wrapper = await mountComponent(
      OrgPageShell,
      { title: 'Overview' },
      { actions: () => h('button', { id: 'act' }, 'Invite') }
    );

    expect(wrapper.get('.ops__actions #act').text()).toBe('Invite');
  });
});

describe('OrgSwitcher', () => {
  function twoTenants(): void {
    useAuthStore().user = user();
    const store = useOrganizationStore();
    store.organizations = [org(), org({ id: 'org-2', name: 'Kili Trade', myRoleKind: 'member' })];
    store.currentOrganization = org();
  }

  it('renders nothing for a signed-out visitor', async () => {
    const wrapper = await mountComponent(OrgSwitcher);

    expect(wrapper.find('[data-testid="org-switcher"]').exists()).toBe(false);
  });

  it('names the active tenant and opens on click', async () => {
    twoTenants();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    expect(wrapper.get('[data-testid="org-switcher-trigger"]').text()).toContain('Kili Social');
    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(false);

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="org-switcher-trigger"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.findAll('.os__item')).toHaveLength(2);
    expect(
      (wrapper.get('.os__item[data-org-id="org-1"]').element as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('falls back to a prompt when no tenant is loaded yet', async () => {
    useAuthStore().user = user();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    expect(wrapper.get('.os__name').text()).toBe(t('org.switch.empty'));
  });

  it('switches without reloading, toasts and tells the page', async () => {
    twoTenants();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');
    await wrapper.get('.os__item[data-org-id="org-2"]').trigger('click');
    await flushPromises();

    expect(orgApi.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(wrapper.emitted('switched')?.[0]).toEqual(['org-2']);
    expect(toasts().join('|')).toContain(t('org.switch.successToast', { name: 'Kili Trade' }));
    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(false);
  });

  it('reports a switch the server refused', async () => {
    twoTenants();
    orgApi.switchOrganization.mockRejectedValue(new Error('boom'));
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');
    await wrapper.get('.os__item[data-org-id="org-2"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('switched')).toBeUndefined();
    expect(toasts().join('|')).toContain(t('org.switch.failedToast'));
  });

  it('routes to onboarding and to the organisation page', async () => {
    twoTenants();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');
    await wrapper.get('[data-testid="org-switcher-create"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/onboarding/create-org');

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');
    await wrapper.findAll('.os__action')[1].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/organization');
  });

  it('explains itself when there is nothing to switch to', async () => {
    useAuthStore().user = user();
    const store = useOrganizationStore();
    store.organizations = [org()];
    store.currentOrganization = org();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');

    expect(wrapper.get('.os__hint').text()).toBe(t('org.switch.subtitle'));
  });

  it('closes when the click lands outside the control', async () => {
    twoTenants();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    await wrapper.get('[data-testid="org-switcher-trigger"]').trigger('click');
    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(false);
  });

  it('ignores an outside click while the panel is already closed', async () => {
    twoTenants();
    const wrapper = await mountComponent(OrgSwitcher, { autoReload: false });

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-testid="org-switcher-panel"]').exists()).toBe(false);
  });
});
