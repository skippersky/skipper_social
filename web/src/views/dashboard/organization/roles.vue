<script setup lang="ts">
/**
 * Roles and permissions (Sprint 13).
 *
 * Two shelves, because they behave differently: the four built-in roles are fixed
 * product furniture and render read-only with an explanation of what each preset
 * covers, while custom roles are the user's own and carry edit and delete. The
 * distinction is enforced by canEdit/canDelete from useRole rather than by hiding
 * buttons, so a stale card cannot offer an action the store would refuse.
 *
 * The permission picker is PermissionTree bound to the composable's draft
 * selection. Keeping the draft in the composable and not in this component means
 * opening the editor for a second role cannot inherit the first one's ticks.
 */
import { computed, onMounted, ref } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import OrgPageShell from '../../../components/organization/OrgPageShell.vue';
import PermissionGuard from '../../../components/permission/PermissionGuard.vue';
import PermissionTree from '../../../components/organization/PermissionTree.vue';
import RoleBadge from '../../../components/permission/RoleBadge.vue';
import { useOrganization } from '../../../composables/useOrganization';
import { useRole } from '../../../composables/useRole';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { countPermissions } from '../../../lib/permissions';
import { ROLE_DESCRIPTION_MAX, ROLE_NAME_MAX } from '../../../lib/organization';
import type { ValidationErrors } from '../../../lib/settingsValidation';
import type { Role } from '../../../types';

const i18n = useI18nStore();

const { hasDemoData } = useOrganization();
const {
  builtinRoles,
  customRoles,
  permissionGroups,
  sortedRoles,
  draftPermissions,
  draftId,
  draftCount,
  loading,
  saving,
  error,
  loadRoles,
  loadPermissions,
  validate,
  startEdit,
  closeEdit,
  createRole,
  updateRole,
  deleteRole,
  canEdit,
  canDelete,
  permissionsFor
} = useRole();

const editorOpen = ref(false);
const name = ref('');
const description = ref('');
const formErrors = ref<ValidationErrors>({});
const detailRole = ref<Role | null>(null);

const editorIsCreate = computed(() => draftId.value === null);
const editorTitle = computed(() =>
  i18n.t(editorIsCreate.value ? 'org.roles.editorCreateTitle' : 'org.roles.editorEditTitle')
);

async function load(): Promise<void> {
  await Promise.all([loadRoles(), loadPermissions()]);
}

onMounted(load);

function openCreate(): void {
  startEdit(null);
  name.value = '';
  description.value = '';
  formErrors.value = {};
  editorOpen.value = true;
}

function openEdit(role: Role): void {
  startEdit(role);
  name.value = role.name;
  description.value = role.description ?? '';
  formErrors.value = {};
  editorOpen.value = true;
}

function closeEditor(): void {
  editorOpen.value = false;
  detailRole.value = null;
  closeEdit();
}

function onDraftChange(value: string[]): void {
  draftPermissions.value = value;
}

async function submitEditor(): Promise<void> {
  const payload = {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    permissions: [...draftPermissions.value]
  };
  formErrors.value = validate(payload);
  if (Object.keys(formErrors.value).length > 0) return;
  /* closeEdit() clears draftId, so remember which save this is before it does. */
  const creating = editorIsCreate.value;
  const saved = creating
    ? await createRole(payload)
    : await updateRole(draftId.value as string, payload);
  if (!saved) return;
  editorOpen.value = false;
  closeEdit();
  showToast(i18n.t(creating ? 'org.roles.editorCreatedToast' : 'org.roles.editorUpdatedToast'));
}

async function onDelete(role: Role): Promise<void> {
  if (!canDelete(role)) {
    showToast(i18n.t('org.roles.deleteBlocked'));
    return;
  }
  await showConfirmDialog({
    title: i18n.t('org.roles.deleteTitle'),
    message: i18n.t('org.roles.deleteMessage', { name: roleLabel(role) })
  });
  const removed = await deleteRole(role.id);
  if (removed) showToast(i18n.t('org.roles.deletedToast'));
}

function permissionSummary(role: Role): string {
  /* A wildcard role holds the whole catalog; a count would understate it. */
  if (role.permissions.includes('*')) return i18n.t('org.roles.allPermissions');
  const count = countPermissions(role.permissions);
  return i18n.t('org.roles.permissionCount', { n: formatNumber(count, i18n.locale) });
}

function presetSummary(kind: Role['kind']): string {
  return i18n.t('org.roleDesc.' + kind);
}

function roleLabel(role: Role): string {
  /* Built-in roles store an i18n key as their name; custom roles store literal text. */
  return role.builtin ? i18n.t(role.name) : role.name;
}

defineExpose({
  editorOpen,
  name,
  description,
  formErrors,
  detailRole,
  load,
  openCreate,
  openEdit,
  closeEditor,
  submitEditor,
  onDelete,
  onDraftChange,
  sortedRoles,
  presetPermissions: permissionsFor,
  roleLabel
});
</script>

<template>
  <OrgPageShell
    :title="i18n.t('org.roles.title')"
    :subtitle="i18n.t('org.roles.subtitle')"
    active="roles"
    :demo="hasDemoData"
    :error="error"
    :loading="loading"
    @retry="load"
  >
    <template #actions>
      <PermissionGuard permission="organization:manage_roles">
        <button class="rl__btn rl__btn--primary" type="button" data-testid="role-create" @click="openCreate">
          {{ i18n.t('org.roles.create') }}
        </button>
      </PermissionGuard>
    </template>

    <section class="rl__block">
      <h2 class="rl__block-title">{{ i18n.t('org.roles.builtinSection') }}</h2>
      <p class="rl__block-hint">{{ i18n.t('org.roles.presetTitle') }}</p>
      <div class="rl__grid" data-testid="role-builtin-grid">
        <article v-for="role in builtinRoles" :key="role.id" class="rl__card" :data-role-id="role.id">
          <header class="rl__card-head">
            <RoleBadge :kind="role.kind" :label="roleLabel(role)" />
            <span class="rl__lock" :title="i18n.t('org.roles.builtinLock')" data-testid="role-builtin-lock">&#128274;</span>
          </header>
          <p class="rl__card-desc">{{ presetSummary(role.kind) }}</p>
          <p class="rl__card-meta">
            <span>{{ i18n.t('org.roles.memberCount', { n: formatNumber(role.memberCount, i18n.locale) }) }}</span>
            <span>{{ permissionSummary(role) }}</span>
          </p>
          <div class="rl__card-actions">
            <button class="rl__btn rl__btn--sm" type="button" data-testid="role-view" @click="detailRole = role">
              {{ i18n.t('org.roles.view') }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="rl__block">
      <h2 class="rl__block-title">{{ i18n.t('org.roles.customSection') }}</h2>
      <p v-if="customRoles.length === 0" class="rl__empty" data-testid="role-custom-empty">
        {{ i18n.t('org.roles.empty') }}
        <span class="rl__empty-hint">{{ i18n.t('org.roles.emptyHint') }}</span>
      </p>
      <div v-else class="rl__grid" data-testid="role-custom-grid">
        <article v-for="role in customRoles" :key="role.id" class="rl__card" :data-role-id="role.id">
          <header class="rl__card-head">
            <RoleBadge kind="custom" :label="roleLabel(role)" />
          </header>
          <p class="rl__card-desc">{{ role.description || presetSummary('custom') }}</p>
          <p class="rl__card-meta">
            <span>{{ i18n.t('org.roles.memberCount', { n: formatNumber(role.memberCount, i18n.locale) }) }}</span>
            <span>{{ permissionSummary(role) }}</span>
          </p>
          <div class="rl__card-actions">
            <button class="rl__btn rl__btn--sm" type="button" data-testid="role-view" @click="detailRole = role">
              {{ i18n.t('org.roles.view') }}
            </button>
            <PermissionGuard permission="organization:manage_roles">
              <button
                v-if="canEdit(role)"
                class="rl__btn rl__btn--sm"
                type="button"
                data-testid="role-edit"
                @click="openEdit(role)"
              >{{ i18n.t('org.roles.edit') }}</button>
              <button
                v-if="canDelete(role)"
                class="rl__btn rl__btn--sm rl__btn--danger"
                type="button"
                data-testid="role-delete"
                @click="onDelete(role)"
              >{{ i18n.t('org.roles.delete') }}</button>
            </PermissionGuard>
          </div>
        </article>
      </div>
    </section>

    <section v-if="detailRole" class="rl__block rl__detail" data-testid="role-detail">
      <header class="rl__detail-head">
        <h2 class="rl__block-title">{{ roleLabel(detailRole) }}</h2>
        <button
          class="rl__btn rl__btn--sm"
          type="button"
          :aria-label="i18n.t('common.close')"
          data-testid="role-detail-close"
          @click="detailRole = null"
        >{{ i18n.t('common.close') }}</button>
      </header>
      <p class="rl__card-desc">{{ detailRole.description || presetSummary(detailRole.kind) }}</p>
      <PermissionTree :model-value="detailRole.permissions" :groups="permissionGroups" readonly />
    </section>

    <div
      v-if="editorOpen"
      class="rl__dialog"
      role="dialog"
      :aria-label="editorTitle"
      data-testid="role-editor"
    >
      <div class="rl__dialog-card">
        <header class="rl__dialog-head">
          <h3>{{ editorTitle }}</h3>
          <button
            type="button"
            :aria-label="i18n.t('common.close')"
            data-testid="role-editor-close"
            @click="closeEditor"
          >&times;</button>
        </header>
        <form class="rl__dialog-body" data-testid="role-editor-form" @submit.prevent="submitEditor">
          <label class="rl__field">
            <span>{{ i18n.t('org.roles.editorName') }}</span>
            <input v-model="name" type="text" :maxlength="ROLE_NAME_MAX" data-testid="role-editor-name" />
            <small v-if="formErrors.name" class="rl__err" data-testid="role-editor-name-error">
              {{ i18n.t(formErrors.name) }}
            </small>
          </label>
          <label class="rl__field">
            <span>{{ i18n.t('org.roles.editorDescription') }}</span>
            <input v-model="description" type="text" :maxlength="ROLE_DESCRIPTION_MAX" data-testid="role-editor-description" />
            <small v-if="formErrors.description" class="rl__err">{{ i18n.t(formErrors.description) }}</small>
          </label>
          <div class="rl__field">
            <span class="rl__tree-head">
              {{ i18n.t('org.roles.editorPermissions') }}
              <em data-testid="role-editor-count">{{ i18n.t('org.roles.editorSelected', { n: draftCount }) }}</em>
            </span>
            <PermissionTree
              :model-value="draftPermissions"
              :groups="permissionGroups"
              data-testid="role-editor-tree"
              @update:model-value="onDraftChange"
            />
            <small v-if="formErrors.permissions" class="rl__err" data-testid="role-editor-permissions-error">
              {{ i18n.t(formErrors.permissions) }}
            </small>
          </div>
          <footer class="rl__dialog-foot">
            <button class="rl__btn" type="button" data-testid="role-editor-cancel" @click="closeEditor">
              {{ i18n.t('common.cancel') }}
            </button>
            <button class="rl__btn rl__btn--primary" type="submit" :disabled="saving" data-testid="role-editor-save">
              {{ i18n.t('common.save') }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </OrgPageShell>
</template>

<style scoped>
.rl__block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rl__block-title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.rl__block-hint {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.rl__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.rl__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    transform var(--ks-motion-fast) var(--ks-ease);
}
.rl__card:hover {
  border-color: var(--ks-border-strong);
  transform: translateY(-1px);
}
.rl__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rl__lock {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.rl__card-desc {
  flex: 1 1 auto;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.rl__card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.rl__card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rl__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 24px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  font-size: 14px;
  color: var(--ks-text-secondary);
}
.rl__empty-hint {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.rl__detail {
  padding: 18px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
}
.rl__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rl__btn {
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
.rl__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.rl__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.rl__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.rl__btn--sm {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.rl__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.rl__btn--danger {
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--ks-error);
}
.rl__dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(23, 26, 33, 0.45);
}
.rl__dialog-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 680px;
  max-height: 90dvh;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-float);
}
.rl__dialog-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--ks-border-default);
}
.rl__dialog-head h3 {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.rl__dialog-head button {
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
.rl__dialog-head button:hover {
  background: var(--ks-bg-muted);
}
.rl__dialog-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 18px;
  overflow-y: auto;
}
.rl__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.rl__field input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
}
.rl__field input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
  border-color: var(--ks-primary);
}
.rl__tree-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.rl__tree-head em {
  font-size: 12px;
  font-style: normal;
  color: var(--ks-text-tertiary);
}
.rl__err {
  font-size: 12px;
  color: var(--ks-error);
}
.rl__dialog-foot {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
@media (max-width: 1023px) {
  .rl__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .rl__grid {
    grid-template-columns: 1fr;
  }
  .rl__dialog {
    padding: 0;
    align-items: flex-end;
  }
  .rl__dialog-card {
    max-width: none;
    max-height: 92dvh;
    border-radius: var(--ks-radius-card) var(--ks-radius-card) 0 0;
  }
}
</style>
