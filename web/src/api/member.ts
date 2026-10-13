/**
 * Member and invitation endpoints (Sprint 13).
 *
 * Real backend first, demo directory second, like every other api module. The
 * member list is paged because the spec asks for paged loading; the demo path
 * applies the same limit and offset so the ui cannot tell the two apart.
 *
 * Beyond the seven specified calls this module also exposes the member status
 * toggle, invitation resend and the pre-auth invitation preview, because the
 * member detail dialog (section 8) and the invite acceptance page (section 13)
 * require them.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './http';
import { isMissingBackend } from './demo';
import {
  demoAcceptInvitation,
  demoCancelInvitation,
  demoInviteMember,
  demoInvitationPreview,
  demoInvitations,
  demoMembers,
  demoRemoveMember,
  demoResendInvitation,
  demoSetMemberStatus,
  demoUpdateMemberRole
} from './demoOrganization';
import type {
  Invitation,
  InvitationInput,
  InvitationPreview,
  Member,
  MemberListParams,
  MemberStatus,
  PagedMembers
} from '../types';

const ORGANIZATIONS = '/api/v1/organizations';
const INVITATIONS = '/api/v1/invitations';

function id(value: string): string {
  return encodeURIComponent(value);
}

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? '?' + text : '';
}

function membersPath(orgId: string): string {
  return ORGANIZATIONS + '/' + id(orgId) + '/members';
}

export async function getMembers(orgId: string, params?: MemberListParams): Promise<PagedMembers> {
  try {
    return await apiGet<PagedMembers>(
      membersPath(orgId) +
        toQuery({
          query: params?.query,
          roleId: params?.roleId,
          status: params?.status,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMembers(orgId, params);
  }
}

export async function inviteMember(orgId: string, data: InvitationInput): Promise<Invitation[]> {
  try {
    return await apiPost<Invitation[]>(membersPath(orgId) + '/invite', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInviteMember(orgId, data);
  }
}

export async function removeMember(orgId: string, memberId: string): Promise<boolean> {
  try {
    return await apiDelete<boolean>(membersPath(orgId) + '/' + id(memberId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRemoveMember(orgId, memberId);
  }
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  data: { roleId: string }
): Promise<Member> {
  try {
    return await apiPut<Member>(membersPath(orgId) + '/' + id(memberId) + '/role', data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateMemberRole(orgId, memberId, data.roleId);
  }
}

/** Disable or re-enable an account without removing the membership row. */
export async function setMemberStatus(
  orgId: string,
  memberId: string,
  status: MemberStatus
): Promise<Member> {
  try {
    return await apiPut<Member>(membersPath(orgId) + '/' + id(memberId) + '/status', { status });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSetMemberStatus(orgId, memberId, status);
  }
}

export async function getInvitations(orgId: string): Promise<Invitation[]> {
  try {
    return await apiGet<Invitation[]>(ORGANIZATIONS + '/' + id(orgId) + '/invitations');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInvitations(orgId);
  }
}

export async function cancelInvitation(orgId: string, invitationId: string): Promise<boolean> {
  try {
    return await apiDelete<boolean>(
      ORGANIZATIONS + '/' + id(orgId) + '/invitations/' + id(invitationId)
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCancelInvitation(orgId, invitationId);
  }
}

export async function resendInvitation(orgId: string, invitationId: string): Promise<Invitation> {
  try {
    return await apiPost<Invitation>(
      ORGANIZATIONS + '/' + id(orgId) + '/invitations/' + id(invitationId) + '/resend',
      {}
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoResendInvitation(orgId, invitationId);
  }
}

/** Readable without a session: the invite link has to render before sign-in. */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  try {
    return await apiGet<InvitationPreview>(INVITATIONS + '/' + id(token));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoInvitationPreview(token);
  }
}

export async function acceptInvitation(token: string): Promise<Member> {
  try {
    return await apiPost<Member>(INVITATIONS + '/' + id(token) + '/accept', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoAcceptInvitation(token);
  }
}

/** The invite link handed to the user for copying or sharing. */
export function invitationUrl(token: string): string {
  return '/invitation/' + encodeURIComponent(token);
}
