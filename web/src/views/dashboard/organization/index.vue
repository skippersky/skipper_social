<script setup lang="ts">
/**
 * Organisation overview (Sprint 13).
 *
 * The landing page of the tenant module: who this organisation is, four counts
 * that summarise it, the actions an admin actually takes, and the recent activity
 * trail. Every read and write goes through useOrganization/useMember, so the page
 * holds no fetch logic of its own, and each privileged control sits inside a
 * PermissionGuard instead of a role check scattered through the template.
 *
 * Editing the organisation happens in an inline panel rather than a second route:
 * it is three fields, and a panel keeps the user next to the activity trail that
 * records the change they just made.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import ActivityFeed from '../../../components/organization/ActivityFeed.vue';
import InviteDialog from '../../../components/organization/InviteDialog.vue';
import KsAvatar from '../../../components/KsAvatar.vue';
import OrgPageShell from '../../../components/organization/OrgPageShell.vue';
import PermissionGuard from '../../../components/permission/PermissionGuard.vue';
import RoleBadge from '../../../components/permission/RoleBadge.vue';
import { useMember } from '../../../composables/useMember';
import { useOrganization } from '../../../composables/useOrganization';
import { useRole } from '../../../composables/useRole';
import { useI18nStore } from '../../../i18n';
import { formatNumber } from '../../../lib/metrics';
import { ORG_DESCRIPTION_MAX, ORG_NAME_MAX } from '../../../lib/organization';
import type { ValidationErrors } from '../../../lib/settingsValidation';

const i18n = useI18nStore();
const router = useRouter();

const {
  currentOrganization,
  overview,
  activity,
  loading,
  saving,
  error,
  hasDemoData,
  loadCurrentOrganization,
  loadOverview,
  loadActivity,
  updateOrganization,
  validate
} = useOrganization();
const { roles, loadInvitations, inviteMember } = useMember();
/* The invite dialog offers a role per invitee, so the roster of roles must be
   loaded here too; bootstrap only primes permissions, not roles. */
const { loadRoles } = useRole();

const inviteOpen = ref(false);
const editing = ref(false);
const form = ref({ name: '', logoUrl: '', description: '' });
const formErrors = ref<ValidationErrors>({});

const stats = computed(() => [
  { key: 'totalMembers', labelKey: 'org.stat.totalMembers', value: overview.value.totalMembers },
  { key: 'activeMembers', labelKey: 'org.stat.activeMembers', value: overview.value.activeMembers },
  { key: 'customRoles', labelKey: 'org.stat.customRoles', value: overview.value.customRoles },
  { key: 'pendingInvitations', labelKey: 'org.stat.pendingInvitations', value: overview.value.pendingInvitations }
]);

const roleKind = computed(() => currentOrganization.value?.myRoleKind ?? 'viewer');

const createdLabel = computed(() => {
  const org = currentOrganization.value;
  if (!org) return '';
  return i18n.t('org.createdAt', {
    when: new Date(org.createdAt).toLocaleDateString(i18n.locale)
  });
});

async function load(): Promise<void> {
  const org = await loadCurrentOrganization();
  if (org) form.value = { name: org.name, logoUrl: org.logoUrl ?? '', description: org.description ?? '' };
  await Promise.all([loadOverview(), loadActivity(undefined, 10), loadInvitations(), loadRoles()]);
}

onMounted(load);

function startEdit(): void {
  const org = currentOrganization.value;
  if (!org) return;
  form.value = { name: org.name, logoUrl: org.logoUrl ?? '', description: org.description ?? '' };
  formErrors.value = {};
  editing.value = true;
}

async function saveEdit(): Promise<void> {
  const org = currentOrganization.value;
  if (!org) return;
  const payload = {
    name: form.value.name,
    logoUrl: form.value.logoUrl.trim() || undefined,
    description: form.value.description.trim() || undefined
  };
  formErrors.value = validate(payload);
  if (Object.keys(formErrors.value).length > 0) return;
  const updated = await updateOrganization(org.id, payload);
  if (!updated) return;
  editing.value = false;
  showToast(i18n.t('org.settings.savedToast'));
  await Promise.all([loadOverview(), loadActivity()]);
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
  await Promise.all([loadOverview(), loadActivity(), loadInvitations()]);
}

function go(path: string): void {
  void router.push(path);
}

defineExpose({ stats, editing, form, formErrors, startEdit, saveEdit, onInvite, load });
</script>

<template>
  <OrgPageShell
    :title="i18n.t('org.overview.title')"
    :subtitle="i18n.t('org.subtitle')"
    active="overview"
    :demo="hasDemoData"
    :error="error"
    :loading="loading"
    @retry="load"
  >
    <template #actions>
      <PermissionGuard permission="organization:invite_members">
        <button
          class="ov__btn ov__btn--primary"
          type="button"
          data-testid="org-invite"
          @click="inviteOpen = true"
        >{{ i18n.t('org.action.invite') }}</button>
      </PermissionGuard>
      <button class="ov__btn" type="button" data-testid="org-goto-switch" @click="go('/dashboard/organization/switch')">
        {{ i18n.t('org.switch.title') }}
      </button>
    </template>

    <section v-if="currentOrganization" class="ov__card" data-testid="org-info">
      <KsAvatar :name="currentOrganization.name" :src="currentOrganization.logoUrl" :size="56" />
      <div class="ov__identity">
        <h2 class="ov__name">{{ currentOrganization.name }}</h2>
        <p v-if="currentOrganization.description" class="ov__desc">{{ currentOrganization.description }}</p>
        <p class="ov__meta">
          <span>{{ i18n.t('org.orgIdLabel') }}: {{ currentOrganization.id }}</span>
          <span>{{ createdLabel }}</span>
          <span>{{ i18n.t('org.membersCount', { n: formatNumber(currentOrganization.memberCount, i18n.locale) }) }}</span>
        </p>
      </div>
      <div class="ov__identity-side">
        <RoleBadge :kind="roleKind" />
        <PermissionGuard permission="organization:update_settings">
          <button class="ov__btn" type="button" data-testid="org-edit-info" @click="startEdit">
            {{ i18n.t('org.overview.editInfo') }}
          </button>
        </PermissionGuard>
      </div>
    </section>

    <p v-if="!currentOrganization && !loading" class="ov__missing" data-testid="org-missing">
      {{ i18n.t('org.notFound') }}
    </p>

    <form v-if="editing" class="ov__card ov__edit" data-testid="org-edit-form" @submit.prevent="saveEdit">
      <label class="ov__field">
        <span>{{ i18n.t('org.settings.nameLabel') }}</span>
        <input v-model="form.name" type="text" :maxlength="ORG_NAME_MAX" data-testid="org-edit-name" />
        <small v-if="formErrors.name" class="ov__err" data-testid="org-edit-name-error">{{ i18n.t(formErrors.name) }}</small>
      </label>
      <label class="ov__field">
        <span>{{ i18n.t('org.settings.logoLabel') }}</span>
        <input v-model="form.logoUrl" type="url" :placeholder="i18n.t('org.settings.logoPlaceholder')" data-testid="org-edit-logo" />
        <small class="ov__hint">{{ i18n.t('org.settings.logoHint') }}</small>
      </label>
      <label class="ov__field">
        <span>{{ i18n.t('org.settings.descriptionLabel') }}</span>
        <textarea
          v-model="form.description"
          rows="3"
          :maxlength="ORG_DESCRIPTION_MAX"
          data-testid="org-edit-description"
        ></textarea>
        <small v-if="formErrors.description" class="ov__err">{{ i18n.t(formErrors.description) }}</small>
      </label>
      <div class="ov__edit-actions">
        <button class="ov__btn" type="button" data-testid="org-edit-cancel" @click="editing = false">
          {{ i18n.t('common.cancel') }}
        </button>
        <button class="ov__btn ov__btn--primary" type="submit" :disabled="saving" data-testid="org-edit-save">
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </form>

    <section class="ov__stats" data-testid="org-stats">
      <article v-for="stat in stats" :key="stat.key" class="ov__stat">
        <p class="ov__stat-value" :data-stat="stat.key">{{ formatNumber(stat.value, i18n.locale) }}</p>
        <p class="ov__stat-label">{{ i18n.t(stat.labelKey) }}</p>
      </article>
    </section>

    <section class="ov__quick" data-testid="org-quick-actions">
      <h3 class="ov__section-title">{{ i18n.t('org.quickActions') }}</h3>
      <div class="ov__quick-grid">
        <PermissionGuard permission="organization:view_members">
          <button class="ov__quick-item" type="button" data-testid="org-quick-members" @click="go('/dashboard/organization/members')">
            {{ i18n.t('org.action.members') }}
          </button>
        </PermissionGuard>
        <PermissionGuard permission="organization:manage_roles">
          <button class="ov__quick-item" type="button" data-testid="org-quick-roles" @click="go('/dashboard/organization/roles')">
            {{ i18n.t('org.action.manageRoles') }}
          </button>
        </PermissionGuard>
        <PermissionGuard permission="organization:update_settings">
          <button class="ov__quick-item" type="button" data-testid="org-quick-settings" @click="go('/dashboard/organization/settings')">
            {{ i18n.t('org.action.settings') }}
          </button>
        </PermissionGuard>
      </div>
    </section>

    <section class="ov__card">
      <h3 class="ov__section-title">{{ i18n.t('org.activity.title') }}</h3>
      <ActivityFeed :activities="activity" :limit="10" />
    </section>

    <InviteDialog
      :show="inviteOpen"
      :roles="roles"
      :saving="saving"
      @update:show="inviteOpen = $event"
      @submit="onInvite"
    />
  </OrgPageShell>
</template>

<style scoped>
.ov__card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.ov__missing {
  margin: 0;
  padding: 28px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  font-size: 14px;
  color: var(--ks-text-secondary);
  text-align: center;
}
.ov__identity {
  flex: 1 1 auto;
  min-width: 0;
}
.ov__name {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 19px;
  line-height: 26px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ov__desc {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.ov__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.ov__identity-side {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.ov__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.ov__stat {
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
}
.ov__stat-value {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 26px;
  line-height: 32px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ov__stat-label {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.ov__section-title {
  margin: 0 0 12px;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.ov__quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.ov__quick-item {
  height: 44px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.ov__quick-item:hover {
  background: var(--ks-grad-soft);
  border-color: var(--ks-primary);
}
.ov__quick-item:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ov__btn {
  height: 34px;
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
.ov__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.ov__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ov__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ov__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.ov__btn--primary:hover:not(:disabled) {
  background: var(--ks-grad-brand);
  filter: brightness(1.04);
}
.ov__edit {
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
}
.ov__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.ov__field input,
.ov__field textarea {
  padding: 10px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
}
.ov__field input:focus-visible,
.ov__field textarea:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
  border-color: var(--ks-primary);
}
.ov__hint {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.ov__err {
  font-size: 12px;
  color: var(--ks-error);
}
.ov__edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 1023px) {
  .ov__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ov__quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .ov__card {
    flex-wrap: wrap;
  }
  .ov__identity-side {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .ov__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .ov__quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
