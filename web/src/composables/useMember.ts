/**
 * Member and invitation management (Sprint 13).
 *
 * Owns the view-local filter state for the members table (search text, role
 * filter, status filter, paging offset) and delegates every read and write to the
 * organisation store, mirroring how useWorkflow fronts the workflow store.
 *
 * The invite form lives here too: it turns one free-text field into a validated
 * address list, so the dialog stays a thin template.
 */
import { computed, ref } from 'vue';
import { MEMBER_PAGE_SIZE, useOrganizationStore } from '../stores/organization';
import {
  dedupeEmails,
  splitEmails,
  validateInvitationInput
} from '../lib/organization';
import type { ValidationErrors } from '../lib/settingsValidation';
import type {
  Invitation,
  InvitationInput,
  InvitationPreview,
  Member,
  MemberListParams,
  MemberStatus
} from '../types';

export type MemberStatusFilter = MemberStatus | 'all';

export const MEMBER_STATUS_FILTERS: MemberStatusFilter[] = ['all', 'active', 'disabled'];

export function useMember() {
  const store = useOrganizationStore();

  const query = ref('');
  const roleFilter = ref<string>('');
  const statusFilter = ref<MemberStatusFilter>('all');

  const members = computed(() => store.members);
  const total = computed(() => store.memberTotal);
  const hasMore = computed(() => store.memberHasMore);
  const invitations = computed(() => store.invitations);
  const pendingInvitations = computed(() => store.pendingInvitations);
  const roles = computed(() => store.roles);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);

  function listParams(offset = 0): MemberListParams {
    const params: MemberListParams = { limit: MEMBER_PAGE_SIZE, offset };
    const text = query.value.trim();
    if (text) params.query = text;
    if (roleFilter.value) params.roleId = roleFilter.value;
    if (statusFilter.value !== 'all') params.status = statusFilter.value;
    return params;
  }

  async function loadMembers(orgId?: string): Promise<Member[]> {
    return store.fetchMembers(listParams(0), orgId);
  }

  /** Alias kept because the spec names the entry point loadMembers(). */
  const refresh = loadMembers;

  async function loadMore(orgId?: string): Promise<void> {
    await store.loadMoreMembers(listParams(members.value.length), orgId);
  }

  async function search(text: string, orgId?: string): Promise<Member[]> {
    query.value = text;
    return loadMembers(orgId);
  }

  async function filterByRole(roleId: string, orgId?: string): Promise<Member[]> {
    roleFilter.value = roleId;
    return loadMembers(orgId);
  }

  async function filterByStatus(status: MemberStatusFilter, orgId?: string): Promise<Member[]> {
    statusFilter.value = status;
    return loadMembers(orgId);
  }

  /** One entry point for the role dropdown in a table row. */
  async function updateMemberRole(
    memberId: string,
    roleId: string,
    orgId?: string
  ): Promise<Member | null> {
    return store.updateMemberRole(memberId, roleId, orgId);
  }

  async function removeMember(memberId: string, orgId?: string): Promise<boolean> {
    return store.removeMember(memberId, orgId);
  }

  async function setMemberStatus(
    memberId: string,
    status: MemberStatus,
    orgId?: string
  ): Promise<Member | null> {
    return store.setMemberStatus(memberId, status, orgId);
  }

  /* ------------------------------------------------------------- invites */

  async function loadInvitations(orgId?: string): Promise<Invitation[]> {
    return store.fetchInvitations(orgId);
  }

  /** Parses the dialog's single textarea into a de-duplicated address list. */
  function parseEmails(raw: string): string[] {
    return dedupeEmails(splitEmails(raw));
  }

  function validateInvitation(input: InvitationInput, orgId?: string): ValidationErrors {
    const target = orgId ?? store.currentOrgId;
    const scope = target ? store.members.filter((m) => m.orgId === target) : store.members;
    return validateInvitationInput(input, scope.map((m) => m.email));
  }

  /** Returns the created invitations, or null when validation blocked the send. */
  async function inviteMember(
    input: { emailsRaw: string; roleId: string; message?: string },
    orgId?: string
  ): Promise<Invitation[] | null> {
    const emails = parseEmails(input.emailsRaw);
    const payload: InvitationInput = { emails, roleId: input.roleId, message: input.message };
    if (Object.keys(validateInvitation(payload, orgId)).length > 0) return null;
    const created = await store.inviteMember(payload, orgId);
    return created.length > 0 ? created : null;
  }

  async function cancelInvitation(invitationId: string, orgId?: string): Promise<boolean> {
    return store.cancelInvitation(invitationId, orgId);
  }

  async function resendInvitation(invitationId: string, orgId?: string): Promise<Invitation | null> {
    return store.resendInvitation(invitationId, orgId);
  }

  async function loadInvitationPreview(token: string): Promise<InvitationPreview | null> {
    return store.fetchInvitationPreview(token);
  }

  async function acceptInvitation(token: string): Promise<Member | null> {
    return store.acceptInvitation(token);
  }

  return {
    members,
    total,
    hasMore,
    invitations,
    pendingInvitations,
    roles,
    loading,
    saving,
    error,
    query,
    roleFilter,
    statusFilter,
    listParams,
    loadMembers,
    refresh,
    loadMore,
    search,
    filterByRole,
    filterByStatus,
    updateMemberRole,
    removeMember,
    setMemberStatus,
    loadInvitations,
    parseEmails,
    validateInvitation,
    inviteMember,
    cancelInvitation,
    resendInvitation,
    loadInvitationPreview,
    acceptInvitation
  };
}
