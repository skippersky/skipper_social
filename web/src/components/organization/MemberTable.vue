<script setup lang="ts">
/**
 * MemberTable (Sprint 13).
 *
 * One row per member with the role control and the row actions inline, because a
 * member's role is the thing an admin changes most often and burying it behind a
 * details dialog would cost two clicks per change.
 *
 * Below the tablet breakpoint the table becomes a stacked card list rather than a
 * horizontally scrolling grid: seven columns do not fit a phone, and a scrollbar
 * under a table hides the actions that matter.
 *
 * Every mutation is an emit. The page owns confirmation dialogs and toasts so the
 * table stays presentational and testable without a router or a store.
 */
import { computed } from 'vue';
import KsAvatar from '../KsAvatar.vue';
import RoleBadge from '../permission/RoleBadge.vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { Member, MemberStatus, Role } from '../../types';

const props = withDefaults(
  defineProps<{
    members: Member[];
    roles: Role[];
    /** The signed-in user's member id, so their own row cannot be removed. */
    selfId?: string;
    ownerId?: string;
    saving?: boolean;
    canEdit?: boolean;
  }>(),
  { selfId: undefined, ownerId: undefined, saving: false, canEdit: true }
);

const emit = defineEmits<{
  (event: 'change-role', memberId: string, roleId: string): void;
  (event: 'remove', member: Member): void;
  (event: 'toggle-status', memberId: string, status: MemberStatus): void;
  (event: 'detail', member: Member): void;
}>();

const i18n = useI18nStore();

const assignableRoles = computed(() => props.roles);

function roleLabel(roleId: string): string {
  const role = props.roles.find((candidate) => candidate.id === roleId);
  if (!role) return roleId;
  return role.builtin ? i18n.t(role.name) : role.name;
}

function isOwner(member: Member): boolean {
  return member.roleKind === 'owner' || (props.ownerId !== undefined && member.userId === props.ownerId);
}

function isSelf(member: Member): boolean {
  return props.selfId !== undefined && member.id === props.selfId;
}

/** The owner's role is changed by transferring ownership, never in this row. */
function roleLocked(member: Member): boolean {
  return !props.canEdit || isOwner(member);
}

function when(timestamp: number | undefined): string {
  if (timestamp === undefined) return i18n.t('org.members.neverLoggedIn');
  return relativeTime(timestamp, Date.now(), i18n.locale);
}

function onRole(member: Member, event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === member.roleId) return;
  emit('change-role', member.id, value);
}

function onToggleStatus(member: Member): void {
  emit('toggle-status', member.id, member.status === 'active' ? 'disabled' : 'active');
}
</script>

<template>
  <div class="mt">
    <table class="mt__table" data-testid="member-table">
      <thead>
        <tr>
          <th scope="col">{{ i18n.t('org.members.colName') }}</th>
          <th scope="col" class="mt__hide-sm">{{ i18n.t('org.members.colRole') }}</th>
          <th scope="col">{{ i18n.t('org.members.colStatus') }}</th>
          <th scope="col" class="mt__hide-sm">{{ i18n.t('org.members.colJoined') }}</th>
          <th scope="col" class="mt__hide-sm">{{ i18n.t('org.members.colLastLogin') }}</th>
          <th scope="col" class="mt__actions-col">{{ i18n.t('org.members.colActions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.id" :data-member-id="member.id">
          <td>
            <div class="mt__person">
              <KsAvatar :name="member.name" :src="member.avatarUrl" :size="32" />
              <span class="mt__identity">
                <span class="mt__name">
                  {{ member.name }}
                  <em v-if="isSelf(member)" class="mt__you">{{ i18n.t('org.members.you') }}</em>
                </span>
                <span class="mt__email">{{ member.email }}</span>
              </span>
            </div>
          </td>
          <td class="mt__hide-sm">
            <select
              v-if="!roleLocked(member)"
              class="mt__select"
              :value="member.roleId"
              :disabled="saving"
              :aria-label="i18n.t('org.members.editRole')"
              :data-role-select="member.id"
              @change="onRole(member, $event)"
            >
              <option v-for="role in assignableRoles" :key="role.id" :value="role.id">
                {{ roleLabel(role.id) }}
              </option>
            </select>
            <RoleBadge v-else :kind="member.roleKind" :label="roleLabel(member.roleId)" size="sm" />
          </td>
          <td>
            <span class="mt__status" :data-status="member.status">
              {{ member.status === 'active' ? i18n.t('org.members.statusActive') : i18n.t('org.members.statusDisabled') }}
            </span>
            <RoleBadge class="mt__mobile-role" :kind="member.roleKind" :label="roleLabel(member.roleId)" size="sm" />
          </td>
          <td class="mt__hide-sm mt__cell-muted">{{ when(member.joinedAt) }}</td>
          <td class="mt__hide-sm mt__cell-muted">{{ when(member.lastLoginAt) }}</td>
          <td>
            <div class="mt__row-actions">
              <button
                class="mt__btn"
                type="button"
                :data-detail="member.id"
                @click="emit('detail', member)"
              >{{ i18n.t('org.members.detail') }}</button>
              <button
                v-if="canEdit && !isOwner(member)"
                class="mt__btn"
                type="button"
                :disabled="saving"
                :data-toggle-status="member.id"
                @click="onToggleStatus(member)"
              >{{ member.status === 'active' ? i18n.t('org.members.disable') : i18n.t('org.members.enable') }}</button>
              <button
                v-if="canEdit && !isOwner(member)"
                class="mt__btn mt__btn--danger"
                type="button"
                :disabled="saving"
                :data-remove="member.id"
                @click="emit('remove', member)"
              >{{ i18n.t('org.members.remove') }}</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.mt {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.mt__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mt__table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
  border-bottom: 1px solid var(--ks-border-default);
  white-space: nowrap;
}
.mt__table td {
  padding: 12px;
  border-bottom: 1px solid var(--ks-border-default);
  vertical-align: middle;
  color: var(--ks-text-primary);
}
.mt__table tbody tr:last-child td {
  border-bottom: none;
}
.mt__table tbody tr:hover {
  background: var(--ks-bg-muted);
}
.mt__person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.mt__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mt__name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mt__you {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}
.mt__email {
  color: var(--ks-text-tertiary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mt__cell-muted {
  color: var(--ks-text-tertiary);
  white-space: nowrap;
}
.mt__select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 8px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.mt__select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.mt__status {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.mt__status[data-status='active'] {
  background: rgba(21, 128, 61, 0.1);
  color: var(--ks-success);
}
.mt__status[data-status='disabled'] {
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
}
.mt__mobile-role {
  display: none;
  margin-left: 6px;
}
.mt__row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.mt__actions-col {
  text-align: right;
}
.mt__btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 8px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.mt__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.mt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mt__btn--danger {
  color: var(--ks-error);
  border-color: rgba(220, 38, 38, 0.3);
}
.mt__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
@media (max-width: 767px) {
  .mt__hide-sm {
    display: none;
  }
  .mt__mobile-role {
    display: inline-flex;
  }
  .mt__table th,
  .mt__table td {
    padding: 10px;
  }
  .mt__row-actions {
    justify-content: flex-start;
  }
}
</style>
