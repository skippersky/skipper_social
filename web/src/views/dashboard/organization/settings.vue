<script setup lang="ts">
/**
 * Organisation settings (Sprint 13).
 *
 * Five tabs over one settings object. Each tab saves only its own section, which
 * is why OrganizationSettingsInput makes every section optional: an admin toggling
 * 2FA should not silently re-submit a half-edited IP allowlist from another tab.
 *
 * The danger tab is gated twice. canDestroy comes from the role kind, so an admin
 * never sees controls the server would reject, and both destructive actions still
 * require typing the organisation name, which confirmNameMatches checks against the
 * live name rather than a copy captured when the tab opened.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import OrgPageShell from '../../../components/organization/OrgPageShell.vue';
import PermissionGuard from '../../../components/permission/PermissionGuard.vue';
import { useMember } from '../../../composables/useMember';
import { useOrganization } from '../../../composables/useOrganization';
import { useI18nStore } from '../../../i18n';
import {
  RETENTION_CHOICES,
  SESSION_TIMEOUT_CHOICES,
  validateIpAllowlist,
  validateSettings
} from '../../../lib/organization';
import { ORG_DESCRIPTION_MAX, ORG_NAME_MAX } from '../../../lib/organization';
import type { ValidationErrors } from '../../../lib/settingsValidation';
import type { OrganizationSettings } from '../../../types';

type SettingsTab = 'basic' | 'security' | 'notifications' | 'data' | 'danger';

const TABS: SettingsTab[] = ['basic', 'security', 'notifications', 'data', 'danger'];

const i18n = useI18nStore();
const router = useRouter();

const {
  currentOrganization,
  settings,
  loading,
  saving,
  error,
  hasDemoData,
  isOwner,
  canManage,
  loadCurrentOrganization,
  loadSettings,
  saveSettings,
  updateOrganization,
  validate,
  deleteOrganization,
  transferOwnership
} = useOrganization();
const { members, loadMembers } = useMember();

const tab = ref<SettingsTab>('basic');
const basic = ref({ name: '', logoUrl: '', description: '' });
const security = ref({ twoFactorRequired: false, ipAllowlist: [] as string[], sessionTimeoutMinutes: 60 });
const notifications = ref({
  memberJoined: true,
  memberRemoved: true,
  roleChanged: true,
  criticalAction: true
});
const data = ref({ messageRetentionDays: 180, logRetentionDays: 90 });
const ipDraft = ref('');
const formErrors = ref<ValidationErrors>({});
const confirmName = ref('');
const transferTarget = ref('');
const confirming = ref<'' | 'transfer' | 'delete'>('');

/** Candidates for ownership: active members who are not already the owner. */
const transferCandidates = computed(() =>
  members.value.filter(
    (member) => member.status === 'active' && member.userId !== currentOrganization.value?.ownerId
  )
);

function timeoutLabel(minutes: number): string {
  return i18n.t('org.settings.timeout' + minutes);
}

function retentionLabel(days: number): string {
  return i18n.t('org.settings.retention' + days);
}

function syncFrom(source: OrganizationSettings | null): void {
  if (!source) return;
  security.value = {
    twoFactorRequired: source.security.twoFactorRequired,
    ipAllowlist: [...source.security.ipAllowlist],
    sessionTimeoutMinutes: source.security.sessionTimeoutMinutes
  };
  notifications.value = { ...source.notifications };
  data.value = { ...source.data };
}

function syncBasic(): void {
  const org = currentOrganization.value;
  if (!org) return;
  basic.value = { name: org.name, logoUrl: org.logoUrl ?? '', description: org.description ?? '' };
}

watch(settings, syncFrom);
watch(currentOrganization, syncBasic);

async function load(): Promise<void> {
  await loadCurrentOrganization();
  syncBasic();
  await Promise.all([loadSettings(), loadMembers()]);
  syncFrom(settings.value);
}

onMounted(load);

function selectTab(next: SettingsTab): void {
  tab.value = next;
  formErrors.value = {};
}

async function saveBasic(): Promise<void> {
  const org = currentOrganization.value;
  if (!org) return;
  const payload = {
    name: basic.value.name,
    logoUrl: basic.value.logoUrl.trim() || undefined,
    description: basic.value.description.trim() || undefined
  };
  formErrors.value = validate(payload);
  if (Object.keys(formErrors.value).length > 0) return;
  const updated = await updateOrganization(org.id, payload);
  if (updated) showToast(i18n.t('org.settings.savedToast'));
}

function addIp(): void {
  const entry = ipDraft.value.trim();
  if (entry === '') return;
  const next = [...security.value.ipAllowlist, entry];
  const problem = validateIpAllowlist(next);
  if (problem) {
    formErrors.value = { ipAllowlist: problem };
    return;
  }
  security.value.ipAllowlist = next;
  ipDraft.value = '';
  formErrors.value = {};
}

function removeIp(entry: string): void {
  security.value.ipAllowlist = security.value.ipAllowlist.filter((item) => item !== entry);
}

/** One entry point for the three non-basic tabs, each sending only its section. */
async function saveSection(section: 'security' | 'notifications' | 'data'): Promise<void> {
  const org = currentOrganization.value;
  if (!org) return;
  const candidate: OrganizationSettings = {
    security: { ...security.value },
    notifications: { ...notifications.value },
    data: { ...data.value }
  };
  formErrors.value = validateSettings(candidate);
  if (Object.keys(formErrors.value).length > 0) return;
  const saved = await saveSettings({ [section]: candidate[section] });
  if (saved) {
    syncFrom(saved);
    showToast(i18n.t('org.settings.savedToast'));
  }
}

function exportData(): void {
  /* The download itself is a backend job; the ui only confirms the request. */
  showToast(i18n.t('org.settings.exportStarted'));
}

function startConfirm(kind: 'transfer' | 'delete'): void {
  confirming.value = kind;
  confirmName.value = '';
  formErrors.value = {};
}

async function submitTransfer(): Promise<void> {
  if (!transferTarget.value) {
    formErrors.value = { transfer: 'org.error.transferTarget' };
    return;
  }
  const updated = await transferOwnership(transferTarget.value, confirmName.value);
  if (!updated) {
    formErrors.value = { confirm: 'org.settings.confirmMismatch' };
    return;
  }
  confirming.value = '';
  showToast(i18n.t('org.settings.transferredToast'));
  await loadCurrentOrganization();
}

async function submitDelete(): Promise<void> {
  const org = currentOrganization.value;
  if (!org) return;
  const removed = await deleteOrganization(org.id, confirmName.value);
  if (!removed) {
    formErrors.value = { confirm: 'org.settings.confirmMismatch' };
    return;
  }
  showToast(i18n.t('org.settings.deletedToast'));
  void router.push('/dashboard/organization/switch');
}

defineExpose({
  tab,
  basic,
  security,
  notifications,
  data,
  ipDraft,
  formErrors,
  confirmName,
  transferTarget,
  confirming,
  load,
  selectTab,
  saveBasic,
  addIp,
  removeIp,
  saveSection,
  exportData,
  startConfirm,
  submitTransfer,
  submitDelete
});
</script>

<template>
  <OrgPageShell
    :title="i18n.t('org.settings.title')"
    :subtitle="i18n.t('org.settings.subtitle')"
    active="settings"
    :demo="hasDemoData"
    :error="error"
    :loading="loading"
    @retry="load"
  >
    <nav class="st__tabs" role="tablist" data-testid="settings-tabs">
      <button
        v-for="item in TABS"
        :key="item"
        class="st__tab"
        type="button"
        role="tab"
        :aria-selected="tab === item"
        :data-tab="item"
        data-testid="settings-tab"
        @click="selectTab(item)"
      >{{ i18n.t('org.settings.tab' + item.charAt(0).toUpperCase() + item.slice(1)) }}</button>
    </nav>

    <section v-if="tab === 'basic'" class="st__panel" data-testid="settings-panel-basic">
      <label class="st__field">
        <span>{{ i18n.t('org.settings.nameLabel') }}</span>
        <input v-model="basic.name" type="text" :maxlength="ORG_NAME_MAX" data-testid="settings-name" />
        <small v-if="formErrors.name" class="st__err" data-testid="settings-name-error">{{ i18n.t(formErrors.name) }}</small>
      </label>
      <label class="st__field">
        <span>{{ i18n.t('org.settings.logoLabel') }}</span>
        <input
          v-model="basic.logoUrl"
          type="url"
          :placeholder="i18n.t('org.settings.logoPlaceholder')"
          data-testid="settings-logo"
        />
        <small class="st__hint">{{ i18n.t('org.settings.logoHint') }}</small>
      </label>
      <label class="st__field">
        <span>{{ i18n.t('org.settings.descriptionLabel') }}</span>
        <textarea v-model="basic.description" rows="3" :maxlength="ORG_DESCRIPTION_MAX" data-testid="settings-description"></textarea>
        <small v-if="formErrors.description" class="st__err">{{ i18n.t(formErrors.description) }}</small>
      </label>
      <div class="st__actions">
        <button class="st__btn st__btn--primary" type="button" :disabled="saving" data-testid="settings-save-basic" @click="saveBasic">
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </section>

    <section v-else-if="tab === 'security'" class="st__panel" data-testid="settings-panel-security">
      <label class="st__row">
        <span class="st__row-copy">
          <strong>{{ i18n.t('org.settings.twoFactor') }}</strong>
          <small>{{ i18n.t('org.settings.twoFactorHint') }}</small>
        </span>
        <input v-model="security.twoFactorRequired" type="checkbox" class="st__check" data-testid="settings-2fa" />
      </label>
      <div class="st__field">
        <span>{{ i18n.t('org.settings.ipAllowlist') }}</span>
        <small class="st__hint">{{ i18n.t('org.settings.ipAllowlistHint') }}</small>
        <div class="st__ip-row">
          <input
            v-model="ipDraft"
            type="text"
            :placeholder="i18n.t('org.settings.ipPlaceholder')"
            data-testid="settings-ip-input"
            @keyup.enter="addIp"
          />
          <button class="st__btn" type="button" data-testid="settings-ip-add" @click="addIp">
            {{ i18n.t('org.settings.ipAdd') }}
          </button>
        </div>
        <small v-if="formErrors.ipAllowlist" class="st__err" data-testid="settings-ip-error">
          {{ i18n.t(formErrors.ipAllowlist) }}
        </small>
        <ul v-if="security.ipAllowlist.length > 0" class="st__chips" data-testid="settings-ip-list">
          <li v-for="entry in security.ipAllowlist" :key="entry" class="st__chip">
            {{ entry }}
            <button type="button" :aria-label="i18n.t('common.close')" data-testid="settings-ip-remove" @click="removeIp(entry)">&times;</button>
          </li>
        </ul>
        <p v-else class="st__muted">{{ i18n.t('org.settings.ipEmpty') }}</p>
      </div>
      <label class="st__field">
        <span>{{ i18n.t('org.settings.sessionTimeout') }}</span>
        <select v-model.number="security.sessionTimeoutMinutes" class="st__select" data-testid="settings-timeout">
          <option v-for="minutes in SESSION_TIMEOUT_CHOICES" :key="minutes" :value="minutes">
            {{ timeoutLabel(minutes) }}
          </option>
        </select>
        <small v-if="formErrors.sessionTimeoutMinutes" class="st__err">{{ i18n.t(formErrors.sessionTimeout) }}</small>
      </label>
      <div class="st__actions">
        <button class="st__btn st__btn--primary" type="button" :disabled="saving || !canManage" data-testid="settings-save-security" @click="saveSection('security')">
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </section>

    <section v-else-if="tab === 'notifications'" class="st__panel" data-testid="settings-panel-notifications">
      <label class="st__row">
        <span class="st__row-copy"><strong>{{ i18n.t('org.settings.notifyMemberJoined') }}</strong></span>
        <input v-model="notifications.memberJoined" type="checkbox" class="st__check" data-testid="settings-notify-memberJoined" />
      </label>
      <label class="st__row">
        <span class="st__row-copy"><strong>{{ i18n.t('org.settings.notifyMemberRemoved') }}</strong></span>
        <input v-model="notifications.memberRemoved" type="checkbox" class="st__check" data-testid="settings-notify-memberRemoved" />
      </label>
      <label class="st__row">
        <span class="st__row-copy"><strong>{{ i18n.t('org.settings.notifyRoleChanged') }}</strong></span>
        <input v-model="notifications.roleChanged" type="checkbox" class="st__check" data-testid="settings-notify-roleChanged" />
      </label>
      <label class="st__row">
        <span class="st__row-copy"><strong>{{ i18n.t('org.settings.notifyCriticalAction') }}</strong></span>
        <input v-model="notifications.criticalAction" type="checkbox" class="st__check" data-testid="settings-notify-criticalAction" />
      </label>
      <div class="st__actions">
        <button class="st__btn st__btn--primary" type="button" :disabled="saving || !canManage" data-testid="settings-save-notifications" @click="saveSection('notifications')">
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </section>

    <section v-else-if="tab === 'data'" class="st__panel" data-testid="settings-panel-data">
      <label class="st__field">
        <span>{{ i18n.t('org.settings.messageRetention') }}</span>
        <select v-model.number="data.messageRetentionDays" class="st__select" data-testid="settings-message-retention">
          <option v-for="days in RETENTION_CHOICES" :key="days" :value="days">{{ retentionLabel(days) }}</option>
        </select>
      </label>
      <label class="st__field">
        <span>{{ i18n.t('org.settings.logRetention') }}</span>
        <select v-model.number="data.logRetentionDays" class="st__select" data-testid="settings-log-retention">
          <option v-for="days in RETENTION_CHOICES" :key="days" :value="days">{{ retentionLabel(days) }}</option>
        </select>
        <small v-if="formErrors.messageRetentionDays" class="st__err">{{ i18n.t(formErrors.messageRetentionDays) }}</small>
        <small v-if="formErrors.logRetentionDays" class="st__err">{{ i18n.t(formErrors.logRetentionDays) }}</small>
      </label>
      <div class="st__export">
        <div>
          <strong>{{ i18n.t('org.settings.exportData') }}</strong>
          <small class="st__hint">{{ i18n.t('org.settings.exportHint') }}</small>
        </div>
        <button class="st__btn" type="button" data-testid="settings-export" @click="exportData">
          {{ i18n.t('org.settings.exportData') }}
        </button>
      </div>
      <div class="st__actions">
        <button class="st__btn st__btn--primary" type="button" :disabled="saving || !canManage" data-testid="settings-save-data" @click="saveSection('data')">
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </section>

    <section v-else class="st__panel st__panel--danger" data-testid="settings-panel-danger">
      <h2 class="st__danger-title">{{ i18n.t('org.settings.dangerTitle') }}</h2>
      <p class="st__hint">{{ i18n.t('org.settings.dangerHint') }}</p>

      <PermissionGuard permission="organization:update_settings">
        <div v-if="isOwner" class="st__danger-row">
          <div class="st__danger-copy">
            <strong>{{ i18n.t('org.settings.transfer') }}</strong>
            <small>{{ i18n.t('org.settings.transferHint') }}</small>
          </div>
          <button
            v-if="confirming !== 'transfer'"
            class="st__btn"
            type="button"
            data-testid="settings-transfer-open"
            @click="startConfirm('transfer')"
          >{{ i18n.t('org.settings.transfer') }}</button>
        </div>

        <form v-if="isOwner && confirming === 'transfer'" class="st__confirm" data-testid="settings-transfer-form" @submit.prevent="submitTransfer">
          <label class="st__field">
            <span>{{ i18n.t('org.settings.transferMember') }}</span>
            <select v-model="transferTarget" class="st__select" data-testid="settings-transfer-member">
              <option value="" disabled>{{ i18n.t('org.settings.transferMember') }}</option>
              <option v-for="member in transferCandidates" :key="member.id" :value="member.id">
                {{ member.name }} ({{ member.email }})
              </option>
            </select>
            <small v-if="formErrors.transfer" class="st__err" data-testid="settings-transfer-target-error">
              {{ i18n.t(formErrors.transfer) }}
            </small>
          </label>
          <label class="st__field">
            <span>{{ i18n.t('org.settings.transferMessage', { name: currentOrganization?.name ?? '' }) }}</span>
            <input v-model="confirmName" type="text" data-testid="settings-transfer-confirm" />
          </label>
          <small v-if="formErrors.confirm" class="st__err" data-testid="settings-transfer-error">{{ i18n.t(formErrors.confirm) }}</small>
          <div class="st__actions">
            <button class="st__btn" type="button" data-testid="settings-transfer-cancel" @click="confirming = ''">
              {{ i18n.t('common.cancel') }}
            </button>
            <button class="st__btn st__btn--danger" type="submit" :disabled="saving" data-testid="settings-transfer-submit">
              {{ i18n.t('org.settings.transfer') }}
            </button>
          </div>
        </form>
      </PermissionGuard>

      <div class="st__danger-row">
        <div class="st__danger-copy">
          <strong>{{ i18n.t('org.settings.delete') }}</strong>
          <small>{{ i18n.t('org.settings.deleteHint') }}</small>
        </div>
        <button
          v-if="confirming !== 'delete' && isOwner"
          class="st__btn st__btn--danger"
          type="button"
          data-testid="settings-delete-open"
          @click="startConfirm('delete')"
        >{{ i18n.t('org.settings.delete') }}</button>
      </div>

      <form v-if="confirming === 'delete' && isOwner" class="st__confirm" data-testid="settings-delete-form" @submit.prevent="submitDelete">
        <label class="st__field">
          <span>{{ i18n.t('org.settings.deleteMessage', { name: currentOrganization?.name ?? '' }) }}</span>
          <input
            v-model="confirmName"
            type="text"
            :placeholder="i18n.t('org.settings.confirmPlaceholder')"
            data-testid="settings-delete-confirm"
          />
        </label>
        <small v-if="formErrors.confirm" class="st__err" data-testid="settings-delete-error">{{ i18n.t(formErrors.confirm) }}</small>
        <div class="st__actions">
          <button class="st__btn" type="button" data-testid="settings-delete-cancel" @click="confirming = ''">
            {{ i18n.t('common.cancel') }}
          </button>
          <button class="st__btn st__btn--danger" type="submit" :disabled="saving" data-testid="settings-delete-submit">
            {{ i18n.t('org.settings.delete') }}
          </button>
        </div>
      </form>
    </section>
  </OrgPageShell>
</template>

<style scoped>
.st__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: fit-content;
  max-width: 100%;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  overflow-x: auto;
}
.st__tab {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.st__tab:hover {
  background: var(--ks-bg-muted);
}
.st__tab[aria-selected='true'] {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.st__tab:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.st__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.st__panel--danger {
  border-color: rgba(220, 38, 38, 0.28);
}
.st__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.st__field input,
.st__field textarea,
.st__select {
  padding: 10px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
}
.st__field textarea {
  resize: vertical;
}
.st__field input:focus-visible,
.st__field textarea:focus-visible,
.st__select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
  border-color: var(--ks-primary);
}
.st__hint {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.st__err {
  font-size: 12px;
  color: var(--ks-error);
}
.st__muted {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.st__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ks-border-default);
}
.st__row:last-of-type {
  border-bottom: none;
}
.st__row-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
  color: var(--ks-text-primary);
}
.st__row-copy small {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.st__check {
  width: 18px;
  height: 18px;
  flex: none;
  accent-color: var(--ks-primary);
  cursor: pointer;
}
.st__ip-row {
  display: flex;
  gap: 8px;
}
.st__ip-row input {
  flex: 1 1 auto;
  min-width: 0;
}
.st__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.st__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  font-size: 12px;
  color: var(--ks-text-primary);
}
.st__chip button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.st__chip button:hover {
  background: var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.st__export {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--ks-border-default);
  border-bottom: 1px solid var(--ks-border-default);
}
.st__export > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
  color: var(--ks-text-primary);
}
.st__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.st__btn {
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
.st__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.st__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.st__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.st__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.st__btn--danger {
  border-color: rgba(220, 38, 38, 0.34);
  background: rgba(220, 38, 38, 0.06);
  color: var(--ks-error);
}
.st__danger-title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-error);
}
.st__danger-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--ks-border-default);
}
.st__danger-copy {
  display: flex;
  flex: 1 1 260px;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
  color: var(--ks-text-primary);
}
.st__danger-copy small {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.st__confirm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(220, 38, 38, 0.26);
  border-radius: var(--ks-radius-btn);
  background: rgba(220, 38, 38, 0.04);
}
@media (max-width: 767px) {
  .st__panel {
    padding: 16px;
  }
  .st__tabs {
    width: 100%;
  }
  .st__tab {
    flex: 1 1 auto;
    padding: 0 10px;
  }
}
</style>
