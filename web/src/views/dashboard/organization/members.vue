<script setup lang="ts">
/**
 * Member management (Sprint 13).
 *
 * The roster itself is MemberTable; this page owns what a table cannot: the filter
 * bar, the paged reload those filters drive, the invite dialog, the collapsible
 * invitation ledger, and the confirmation step before a removal.
 *
 * Filters are server-shaped on purpose. useMember turns them into MemberListParams
 * and the store re-queries, so a large organisation never ships its whole roster to
 * the browser to be filtered there. "Load more" appends the next page with the same
 * parameters, which is the paging the spec asks for.
 */
import { computed, onMounted, ref } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import InviteDialog from '../../../components/organization/InviteDialog.vue';
import KsAvatar from '../../../components/KsAvatar.vue';
import MemberTable from '../../../components/organization/MemberTable.vue';
import OrgPageShell from '../../../components/organization/OrgPageShell.vue';
import PermissionGuard from '../../../components/permission/PermissionGuard.vue';
import RoleBadge from '../../../components/permission/RoleBadge.vue';
import { invitationUrl } from '../../../api/member';
import {
  MEMBER_STATUS_FILTERS,
  useMember,
  type MemberStatusFilter
} from '../../../composables/useMember';
import { useOrganization } from '../../../composables/useOrganization';
import { useRole } from '../../../composables/useRole';
import { useAuthStore } from '../../../stores/auth';
import { useI18nStore } from '../../../i18n';
import { relativeTime } from '../../../lib/relativeTime';
import type { Member, MemberStatus } from '../../../types';

const i18n = useI18nStore();
const auth = useAuthStore();

const { currentOrganization, hasDemoData, loadCurrentOrganization } = useOrganization();
/* Both the role filter and the table's role picker read the same role list, and
   bootstrap primes permissions only, so the page has to fetch roles itself. */
const { loadRoles } = useRole();
const {
  members,
  total,
  hasMore,
  invitations,
  roles,
  loading,
  saving,
  error,
  query,
  roleFilter,
  statusFilter,
  loadMembers,
  loadMore,
  search,
  filterByRole,
  filterByStatus,
  updateMemberRole,
  removeMember,
  setMemberStatus,
  loadInvitations,
  inviteMember,
  cancelInvitation,
  resendInvitation
} = useMember();

const inviteOpen = ref(false);
const showInvitations = ref(false);
const detail = ref<Member | null>(null);
const searchText = ref('');

const ownerId = computed(() => currentOrganization.value?.ownerId ?? '');
/** The signed-in row, matched by email so the table can suppress self-removal. */
const selfId = computed(() => {
  const email = auth.user?.email;
  if (!email) return '';
  return members.value.find((member) => member.email === email)?.id ?? '';
});

/** An empty list reads differently once a filter is applied, so the copy does too. */
const filtersActive = computed(
  () => query.value.trim() !== '' || roleFilter.value !== '' || statusFilter.value !== 'all'
);

/** The owner row cannot be re-roled or removed, which the table shows as a lock. */
const hasOwnerRow = computed(() =>
  members.value.some((member) => member.roleKind === 'owner' || member.userId === ownerId.value)
);

async function load(): Promise<void> {
  await loadCurrentOrganization();
  await Promise.all([loadMembers(), loadInvitations(), loadRoles()]);
}

onMounted(load);

async function onSearch(): Promise<void> {
  await search(searchText.value);
}

async function onRoleFilter(roleId: string): Promise<void> {
  await filterByRole(roleId);
}

async function onStatusFilter(status: MemberStatusFilter): Promise<void> {
  await filterByStatus(status);
}

async function onChangeRole(memberId: string, roleId: string): Promise<void> {
  const updated = await updateMemberRole(memberId, roleId);
  if (updated) showToast(i18n.t('org.members.roleUpdatedToast'));
}

async function onRemove(member: Member): Promise<void> {
  await showConfirmDialog({
    title: i18n.t('org.members.removeTitle'),
    message: i18n.t('org.members.removeMessage', { name: member.name })
  });
  const removed = await removeMember(member.id);
  if (!removed) return;
  showToast(i18n.t('org.members.removedToast'));
  if (detail.value?.id === member.id) detail.value = null;
}

async function onToggleStatus(memberId: string, status: MemberStatus): Promise<void> {
  const updated = await setMemberStatus(memberId, status);
  if (updated) showToast(i18n.t('org.members.statusUpdatedToast'));
}

async function onInvite(payload: {
  emailsRaw: string;
  roleId: string;
  message?: string;
}): Promise<void> {
  const created = await inviteMember(payload);
  if (!created) return;
  inviteOpen.value = false;
  showToast(i18n.t('org.invite.successToast', { n: created.length }));
  await loadInvitations();
}

async function onCancelInvitation(invitationId: string): Promise<void> {
  const cancelled = await cancelInvitation(invitationId);
  if (cancelled) showToast(i18n.t('org.invitations.cancelledToast'));
}

async function onResend(invitationId: string): Promise<void> {
  const sent = await resendInvitation(invitationId);
  if (sent) showToast(i18n.t('org.invitations.resentToast'));
}

async function onCopyLink(token: string): Promise<void> {
  const link = invitationUrl(token);
  try {
    await navigator.clipboard.writeText(link);
    showToast(i18n.t('org.invitations.linkCopied'));
  } catch {
    /* Clipboard is blocked outside a secure context; surface the link instead. */
    showToast(link);
  }
}

function statusLabel(status: MemberStatus): string {
  return i18n.t(status === 'active' ? 'org.members.statusActive' : 'org.members.statusDisabled');
}

function filterLabel(option: MemberStatusFilter): string {
  if (option === 'all') return i18n.t('org.members.filterStatusAll');
  return statusLabel(option);
}

function invitationStatusLabel(status: string): string {
  return i18n.t('org.invitations.status' + status.charAt(0).toUpperCase() + status.slice(1));
}

function roleLabelFor(roleId: string): string {
  const found = roles.value.find((candidate) => candidate.id === roleId);
  if (!found) return roleId;
  /* Built-in roles carry an i18n key as their name; custom roles carry literal text. */
  return found.builtin ? i18n.t(found.name) : found.name;
}

function whenLabel(timestamp?: number): string {
  if (!timestamp) return i18n.t('org.members.neverLoggedIn');
  return relativeTime(timestamp, Date.now(), i18n.locale);
}

defineExpose({
  inviteOpen,
  showInvitations,
  detail,
  searchText,
  load,
  onSearch,
  onRoleFilter,
  onStatusFilter,
  onChangeRole,
  onRemove,
  onToggleStatus,
  onInvite,
  onCancelInvitation,
  onResend,
  onCopyLink
});
</script>

<template>
  <OrgPageShell
    :title="i18n.t('org.members.title')"
    :subtitle="i18n.t('org.members.subtitle')"
    active="members"
    :demo="hasDemoData"
    :error="error"
    :loading="loading"
    @retry="load"
  >
    <template #actions>
      <PermissionGuard permission="organization:invite_members">
        <button class="mb__btn mb__btn--primary" type="button" data-testid="members-invite" @click="inviteOpen = true">
          {{ i18n.t('org.action.invite') }}
        </button>
      </PermissionGuard>
    </template>

    <section class="mb__filters" data-testid="members-filters">
      <input
        v-model="searchText"
        class="mb__search"
        type="search"
        :placeholder="i18n.t('org.members.searchPlaceholder')"
        :aria-label="i18n.t('org.members.searchPlaceholder')"
        data-testid="members-search"
        @keyup.enter="onSearch"
      />
      <select
        class="mb__select"
        :value="roleFilter"
        :aria-label="i18n.t('org.members.filterRole')"
        data-testid="members-role-filter"
        @change="onRoleFilter(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ i18n.t('org.members.filterRole') }}</option>
        <option v-for="role in roles" :key="role.id" :value="role.id">{{ roleLabelFor(role.id) }}</option>
      </select>
      <select
        class="mb__select"
        :value="statusFilter"
        :aria-label="i18n.t('org.members.filterStatusAll')"
        data-testid="members-status-filter"
        @change="onStatusFilter(($event.target as HTMLSelectElement).value as MemberStatusFilter)"
      >
        <option v-for="option in MEMBER_STATUS_FILTERS" :key="option" :value="option">
          {{ filterLabel(option) }}
        </option>
      </select>
      <button class="mb__btn" type="button" data-testid="members-search-go" @click="onSearch">
        {{ i18n.t('common.search') }}
      </button>
    </section>

    <p class="mb__count" data-testid="members-count">{{ i18n.t('org.members.total', { n: total }) }}</p>

    <div v-if="!loading && members.length === 0" class="mb__blank" data-testid="members-empty">
      <p class="mb__blank-title">
        {{ i18n.t(filtersActive ? 'org.members.filteredEmpty' : 'org.members.empty') }}
      </p>
      <p v-if="!filtersActive" class="mb__blank-hint" data-testid="members-empty-hint">
        {{ i18n.t('org.members.emptyHint') }}
      </p>
    </div>
    <template v-else-if="members.length > 0">
      <p v-if="hasOwnerRow" class="mb__owner-note" data-testid="members-owner-note">
        {{ i18n.t('org.members.ownerLocked') }}
      </p>
      <MemberTable
        :members="members"
        :roles="roles"
        :self-id="selfId"
        :owner-id="ownerId"
        :saving="saving"
        :can-edit="true"
        @change-role="onChangeRole"
        @remove="onRemove"
        @toggle-status="onToggleStatus"
        @detail="detail = $event"
      />
    </template>

    <button
      v-if="hasMore"
      class="mb__btn mb__more"
      type="button"
      data-testid="members-load-more"
      @click="loadMore()"
    >{{ i18n.t('org.members.loadMore') }}</button>

    <section class="mb__invites" data-testid="members-invitations">
      <button
        class="mb__invites-toggle"
        type="button"
        :aria-expanded="showInvitations"
        data-testid="invitations-toggle"
        @click="showInvitations = !showInvitations"
      >
        {{ showInvitations ? i18n.t('org.invitations.hide') : i18n.t('org.invitations.show') }}
        <span class="mb__invites-count">{{ invitations.length }}</span>
      </button>
      <div v-if="showInvitations" class="mb__invites-body">
        <h3 class="mb__invites-title">{{ i18n.t('org.invitations.title') }}</h3>
        <p class="mb__invites-sub">{{ i18n.t('org.invitations.subtitle') }}</p>
        <p v-if="invitations.length === 0" class="mb__empty" data-testid="invitations-empty">
          {{ i18n.t('org.invitations.empty') }}
        </p>
        <ul v-else class="mb__invite-list">
          <li v-for="invite in invitations" :key="invite.id" class="mb__invite" :data-status="invite.status">
            <div class="mb__invite-main">
              <p class="mb__invite-email">{{ invite.email }}</p>
              <p class="mb__invite-meta">
                <RoleBadge :kind="invite.roleKind" :label="roleLabelFor(invite.roleId)" size="sm" />
                <span>{{ invitationStatusLabel(invite.status) }}</span>
                <span>{{ i18n.t('org.invitations.expiresAt', { when: whenLabel(invite.expiresAt) }) }}</span>
                <span>{{ i18n.t('org.invitations.invitedBy', { name: invite.invitedByName }) }}</span>
              </p>
            </div>
            <div class="mb__invite-actions">
              <button class="mb__btn mb__btn--sm" type="button" data-testid="invitation-copy" @click="onCopyLink(invite.token)">
                {{ i18n.t('org.invitations.copyLink') }}
              </button>
              <PermissionGuard permission="organization:invite_members">
                <button
                  v-if="invite.status === 'pending' || invite.status === 'expired'"
                  class="mb__btn mb__btn--sm"
                  type="button"
                  data-testid="invitation-resend"
                  @click="onResend(invite.id)"
                >{{ i18n.t('org.invitations.resend') }}</button>
                <button
                  v-if="invite.status === 'pending'"
                  class="mb__btn mb__btn--sm mb__btn--danger"
                  type="button"
                  data-testid="invitation-cancel"
                  @click="onCancelInvitation(invite.id)"
                >{{ i18n.t('org.invitations.cancel') }}</button>
              </PermissionGuard>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <div
      v-if="detail"
      class="mb__dialog"
      role="dialog"
      :aria-label="i18n.t('org.members.detailTitle')"
      data-testid="member-detail"
    >
      <div class="mb__dialog-card">
        <header class="mb__dialog-head">
          <h3>{{ i18n.t('org.members.detailTitle') }}</h3>
          <button
            type="button"
            :aria-label="i18n.t('common.close')"
            data-testid="member-detail-close"
            @click="detail = null"
          >&times;</button>
        </header>
        <div class="mb__dialog-body">
          <KsAvatar :name="detail.name" :src="detail.avatarUrl" :size="48" />
          <dl class="mb__detail-grid">
            <div><dt>{{ i18n.t('org.members.colName') }}</dt><dd>{{ detail.name }}</dd></div>
            <div><dt>{{ i18n.t('org.members.colEmail') }}</dt><dd>{{ detail.email }}</dd></div>
            <div>
              <dt>{{ i18n.t('org.members.colRole') }}</dt>
              <dd><RoleBadge :kind="detail.roleKind" :label="roleLabelFor(detail.roleId)" size="sm" /></dd>
            </div>
            <div><dt>{{ i18n.t('org.members.colStatus') }}</dt><dd>{{ statusLabel(detail.status) }}</dd></div>
            <div><dt>{{ i18n.t('org.members.colJoined') }}</dt><dd>{{ whenLabel(detail.joinedAt) }}</dd></div>
            <div><dt>{{ i18n.t('org.members.colLastLogin') }}</dt><dd>{{ whenLabel(detail.lastLoginAt) }}</dd></div>
          </dl>
        </div>
        <footer class="mb__dialog-foot">
          <PermissionGuard permission="organization:view_members">
            <button
              v-if="detail.id !== ownerId"
              class="mb__btn"
              type="button"
              data-testid="member-detail-toggle"
              @click="onToggleStatus(detail.id, detail.status === 'active' ? 'disabled' : 'active')"
            >{{ detail.status === 'active' ? i18n.t('org.members.disable') : i18n.t('org.members.enable') }}</button>
            <button
              v-if="detail.id !== ownerId"
              class="mb__btn mb__btn--danger"
              type="button"
              data-testid="member-detail-remove"
              @click="onRemove(detail)"
            >{{ i18n.t('org.members.remove') }}</button>
          </PermissionGuard>
        </footer>
      </div>
    </div>

    <InviteDialog
      :show="inviteOpen"
      :roles="roles"
      :existing-emails="members.map((m) => m.email)"
      :saving="saving"
      @update:show="inviteOpen = $event"
      @submit="onInvite"
    />
  </OrgPageShell>
</template>

<style scoped>
.mb__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.mb__search {
  flex: 1 1 240px;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
}
.mb__select {
  flex: 0 1 180px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
}
.mb__search:focus-visible,
.mb__select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
  border-color: var(--ks-primary);
}
.mb__count {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.mb__btn {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.mb__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.mb__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.mb__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mb__btn--sm {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.mb__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.mb__btn--danger {
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--ks-error);
}
.mb__more {
  align-self: center;
}
.mb__invites {
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
}
.mb__invites-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.mb__invites-count {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 700;
}
.mb__invites-body {
  padding: 0 16px 14px;
  border-top: 1px solid var(--ks-border-default);
}
.mb__invite-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.mb__invite {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--ks-border-default);
}
.mb__invite:last-child {
  border-bottom: none;
}
.mb__invite-main {
  flex: 1 1 260px;
  min-width: 0;
}
.mb__invite-email {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-primary);
  overflow-wrap: anywhere;
}
.mb__invite-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.mb__invite-actions {
  display: flex;
  flex: none;
  gap: 6px;
}
.mb__empty {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.mb__blank {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 32px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.mb__blank-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.mb__blank-hint {
  margin: 0;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.mb__owner-note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.mb__invites-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.mb__invites-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.mb__dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(23, 26, 33, 0.45);
}
.mb__dialog-card {
  width: 100%;
  max-width: 520px;
  max-height: 90dvh;
  overflow-y: auto;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-float);
}
.mb__dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--ks-border-default);
}
.mb__dialog-head h3 {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.mb__dialog-head button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
}
.mb__dialog-head button:hover {
  background: var(--ks-bg-muted);
}
.mb__dialog-body {
  display: flex;
  gap: 16px;
  padding: 18px;
}
.mb__detail-grid {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}
.mb__detail-grid dt {
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.mb__detail-grid dd {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--ks-text-primary);
  overflow-wrap: anywhere;
}
.mb__dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--ks-border-default);
}
@media (max-width: 767px) {
  .mb__select {
    flex: 1 1 140px;
  }
  .mb__dialog-body {
    flex-direction: column;
  }
  .mb__detail-grid {
    grid-template-columns: 1fr;
  }
  .mb__invite-actions {
    width: 100%;
  }
}
</style>
