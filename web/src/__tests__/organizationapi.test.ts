/**
 * Sprint 13 api layer: endpoint contracts, the tenant header and the demo fallback.
 *
 * Two things are worth pinning here. The first is the URL and verb of every call,
 * because the backend does not exist yet and this file is the contract it will be
 * written against - a wrong path is invisible until integration week. The second is
 * the tenant header added by setRequestContext: it rides on every module's requests,
 * so a regression there would silently leak one organisation's rows into another's
 * pages, which is the exact failure this sprint exists to prevent.
 *
 * The fallback assertions matter for the same reason the demo directory exists: with
 * no server running, every organisation page still has to render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ORG_HEADER, getRequestContext, setOrganizationHeader, setRequestContext } from '../api/http';
import * as memberApi from '../api/member';
import * as organizationApi from '../api/organization';
import * as permissionApi from '../api/permission';
import * as roleApi from '../api/role';
import { DEFAULT_ORG_ID, demoResetOrganizations } from '../api/demoOrganization';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const calls: Recorded[] = [];

function envelope(data: unknown) {
  return { success: true, code: 'OK', message: 'ok', data };
}

/** Answers every request with one payload and records what was asked for. */
function serve(data: unknown) {
  calls.length = 0;
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    });
    return { ok: true, status: 200, statusText: 'OK', json: async () => envelope(data) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Answers with a chosen HTTP status so error mapping can be asserted. */
function serveStatus(status: number, code?: string) {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body: undefined
    });
    return {
      ok: false,
      status,
      statusText: 'Error',
      json: async () => ({ success: false, code: code ?? 'HTTP_' + status, message: 'nope' })
    };
  }));
}

const last = () => calls[calls.length - 1];

beforeEach(() => {
  localStorage.clear();
  demoResetOrganizations();
  setRequestContext(null);
});

afterEach(() => {
  setRequestContext(null);
  demoResetOrganizations();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('organisation endpoints', () => {
  it('lists organisations and reads the active tenant', async () => {
    serve([]);

    await organizationApi.getOrganizations();
    expect(last().url).toBe('/api/v1/organizations');
    expect(last().method).toBe('GET');

    await organizationApi.getCurrentOrganization();
    expect(last().url).toBe('/api/v1/organizations/current');
  });

  it('creates, updates and deletes against the documented paths', async () => {
    serve({ id: 'org-1' });

    await organizationApi.createOrganization({ name: 'Kili' });
    expect(last().url).toBe('/api/v1/organizations');
    expect(last().method).toBe('POST');
    expect(last().body).toEqual({ name: 'Kili' });

    await organizationApi.updateOrganization('org/1', { name: 'Kili Two' });
    expect(last().url).toBe('/api/v1/organizations/org%2F1');
    expect(last().method).toBe('PUT');

    await organizationApi.deleteOrganization('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1');
    expect(last().method).toBe('DELETE');
  });

  it('switches tenant and reads the settings, overview and activity calls', async () => {
    serve({});

    await organizationApi.switchOrganization('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/switch');
    expect(last().method).toBe('POST');

    await organizationApi.getOrganizationSettings('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/settings');

    await organizationApi.updateOrganizationSettings('org-1', { data: { logRetentionDays: 30 } });
    expect(last().method).toBe('PUT');
    expect(last().body).toEqual({ data: { logRetentionDays: 30 } });

    await organizationApi.getOrganizationOverview('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/overview');

    await organizationApi.getOrganizationActivity('org-1', 5);
    expect(last().url).toBe('/api/v1/organizations/org-1/activity?limit=5');

    await organizationApi.transferOwnership('org-1', 'mem-2');
    expect(last().url).toBe('/api/v1/organizations/org-1/transfer');
    expect(last().body).toEqual({ memberId: 'mem-2' });
  });
});

describe('member and invitation endpoints', () => {
  it('serialises the list filters and omits empty ones', async () => {
    serve({ items: [], total: 0, hasMore: false });

    await memberApi.getMembers('org-1', { query: 'ama', roleId: 'role-member', status: 'active', limit: 20, offset: 40 });
    expect(last().url).toBe(
      '/api/v1/organizations/org-1/members?query=ama&roleId=role-member&status=active&limit=20&offset=40'
    );

    await memberApi.getMembers('org-1', { query: '', limit: 20 });
    expect(last().url).toBe('/api/v1/organizations/org-1/members?limit=20');

    await memberApi.getMembers('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/members');
  });

  it('invites, removes, re-roles and toggles a member', async () => {
    serve([]);

    await memberApi.inviteMember('org-1', { emails: ['a@x.com'], roleId: 'role-member' });
    expect(last().url).toBe('/api/v1/organizations/org-1/members/invite');
    expect(last().method).toBe('POST');

    await memberApi.removeMember('org-1', 'mem-2');
    expect(last().url).toBe('/api/v1/organizations/org-1/members/mem-2');
    expect(last().method).toBe('DELETE');

    await memberApi.updateMemberRole('org-1', 'mem-2', { roleId: 'role-admin' });
    expect(last().url).toBe('/api/v1/organizations/org-1/members/mem-2/role');
    expect(last().method).toBe('PUT');

    await memberApi.setMemberStatus('org-1', 'mem-2', 'disabled');
    expect(last().url).toBe('/api/v1/organizations/org-1/members/mem-2/status');
    expect(last().body).toEqual({ status: 'disabled' });
  });

  it('reads, cancels and resends invitations, and accepts by token', async () => {
    serve({});

    await memberApi.getInvitations('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/invitations');

    await memberApi.cancelInvitation('org-1', 'inv-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/invitations/inv-1');
    expect(last().method).toBe('DELETE');

    await memberApi.resendInvitation('org-1', 'inv-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/invitations/inv-1/resend');
    expect(last().method).toBe('POST');

    await memberApi.getInvitationPreview('tok/en');
    expect(last().url).toBe('/api/v1/invitations/tok%2Fen');

    await memberApi.acceptInvitation('tok-1');
    expect(last().url).toBe('/api/v1/invitations/tok-1/accept');
    expect(last().method).toBe('POST');
  });

  it('builds an in-app invitation link from a token', () => {
    expect(memberApi.invitationUrl('tok/en')).toBe('/invitation/tok%2Fen');
  });
});

describe('role and permission endpoints', () => {
  it('addresses roles under the organisation', async () => {
    serve([]);

    await roleApi.getRoles('org-1');
    expect(last().url).toBe('/api/v1/organizations/org-1/roles');

    await roleApi.getRole('org-1', 'role-2');
    expect(last().url).toBe('/api/v1/organizations/org-1/roles/role-2');

    await roleApi.createRole('org-1', { name: 'Support', permissions: ['conversation:view'] });
    expect(last().method).toBe('POST');
    expect(last().body).toEqual({ name: 'Support', permissions: ['conversation:view'] });

    await roleApi.updateRole('org-1', 'role-2', { name: 'Support II' });
    expect(last().url).toBe('/api/v1/organizations/org-1/roles/role-2');
    expect(last().method).toBe('PUT');

    await roleApi.deleteRole('org-1', 'role-2');
    expect(last().method).toBe('DELETE');
  });

  it("checks one right, a batch, and the signed-in user set", async () => {
    serve([]);

    await permissionApi.checkPermission('customer:delete');
    expect(last().url).toBe('/api/v1/permissions/check');
    expect(last().body).toEqual({ permission: 'customer:delete' });

    await permissionApi.checkPermissions(['customer:delete', 'marketing:send']);
    expect(last().url).toBe('/api/v1/permissions/check-batch');
    expect(last().body).toEqual({ permissions: ['customer:delete', 'marketing:send'] });

    await permissionApi.getUserPermissions();
    expect(last().url).toBe('/api/v1/users/me/permissions');

    await permissionApi.getUserPermissions('org-1');
    expect(last().url).toBe('/api/v1/users/me/permissions?organizationId=org-1');

    await permissionApi.getPermissions();
    expect(last().url).toBe('/api/v1/permissions');
  });
});

describe('tenant header', () => {
  it('sends no extra header until a tenant is chosen', async () => {
    serve([]);

    await organizationApi.getOrganizations();

    expect(last().headers).toEqual({});
    expect(getRequestContext()).toEqual({});
  });

  it('puts the organisation id on a GET and keeps the content type on a POST', async () => {
    serve([]);
    setOrganizationHeader('org-7');

    await organizationApi.getCurrentOrganization();
    expect(last().headers[ORG_HEADER]).toBe('org-7');

    await organizationApi.createOrganization({ name: 'Kili' });
    expect(last().headers[ORG_HEADER]).toBe('org-7');
    expect(last().headers['Content-Type']).toBe('application/json');
  });

  it('rebinds on a switch and clears on sign-out', async () => {
    serve([]);
    setOrganizationHeader('org-7');
    expect(getRequestContext()[ORG_HEADER]).toBe('org-7');

    setOrganizationHeader('org-8');
    await organizationApi.getOrganizations();
    expect(last().headers[ORG_HEADER]).toBe('org-8');

    setOrganizationHeader(null);
    await organizationApi.getOrganizations();
    expect(last().headers[ORG_HEADER]).toBeUndefined();
  });

  it('lets a caller header win over the tenant default', async () => {
    serve([]);
    setRequestContext({ [ORG_HEADER]: 'org-7', 'X-Trace': 'abc' });

    await organizationApi.getOrganizations();

    expect(last().headers).toEqual({ [ORG_HEADER]: 'org-7', 'X-Trace': 'abc' });
  });
});

describe('demo fallback', () => {
  it('serves a seeded directory when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const organizations = await organizationApi.getOrganizations();

    expect(organizations.length).toBeGreaterThan(0);
    expect(organizations.every((org) => org.demo === true)).toBe(true);
    expect(organizations[0].id).toBe(DEFAULT_ORG_ID);
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
  });

  it('serves members, roles, permissions and settings offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const members = await memberApi.getMembers(DEFAULT_ORG_ID, { limit: 20, offset: 0 });
    expect(members.items.length).toBeGreaterThan(0);
    expect(members.total).toBe(members.items.length);
    expect(members.hasMore).toBe(false);

    const roles = await roleApi.getRoles(DEFAULT_ORG_ID);
    expect(roles.map((role) => role.kind)).toEqual(
      expect.arrayContaining(['owner', 'admin', 'member', 'viewer'])
    );

    const groups = await permissionApi.getPermissions();
    expect(groups).toHaveLength(8);
    expect(groups[0].permissions.length).toBe(5);

    /* The demo owner holds the wildcard, which the directory expands for the ui. */
    const mine = await permissionApi.getUserPermissions(DEFAULT_ORG_ID);
    expect(mine).toHaveLength(29);
    expect(mine).toContain('organization:update_settings');

    const settings = await organizationApi.getOrganizationSettings(DEFAULT_ORG_ID);
    expect(settings.security.sessionTimeoutMinutes).toBe(60);
  });

  it('falls back on a 404 but surfaces a server fault', async () => {
    serveStatus(404);
    const organizations = await organizationApi.getOrganizations();
    expect(organizations.length).toBeGreaterThan(0);

    serveStatus(500);
    await expect(organizationApi.getOrganizations()).rejects.toBeInstanceOf(ApiError);
    /* A 5xx is retriable, so the GET is attempted twice before it gives up. */
    expect(calls.length).toBe(2);
  });
});
