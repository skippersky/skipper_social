<script setup lang="ts">
/**
 * InviteDialog (Sprint 13).
 *
 * Same shape as the accepted CredentialFormDialog: a show prop, an update:show
 * emit and a hand-rolled overlay, so dialogs across the product behave alike.
 *
 * Validation runs through lib/organization, which reuses the accepted email rule
 * from settingsValidation. Errors are i18n keys rendered next to the field, and
 * the parsed address count is shown live so a comma-separated paste is verifiable
 * before it is sent rather than after.
 */
import { computed, ref, watch } from 'vue';
import RoleBadge from '../permission/RoleBadge.vue';
import { useI18nStore } from '../../i18n';
import {
  dedupeEmails,
  INVITE_MESSAGE_MAX,
  splitEmails,
  validateInvitationInput
} from '../../lib/organization';
import type { InvitationInput, Role } from '../../types';

const props = withDefaults(
  defineProps<{
    show: boolean;
    roles: Role[];
    defaultRoleId?: string;
    existingEmails?: string[];
    saving?: boolean;
  }>(),
  { defaultRoleId: undefined, existingEmails: () => [], saving: false }
);

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void;
  (event: 'submit', payload: { emailsRaw: string; emails: string[]; roleId: string; message?: string }): void;
}>();

const i18n = useI18nStore();

const emailsRaw = ref('');
const message = ref('');
const errors = ref<Record<string, string>>({});

/** Owner is never offered: an invite cannot create a second owner. */
const assignableRoles = computed(() => props.roles.filter((role) => role.kind !== 'owner'));

const selectedRoleId = ref<string>(props.defaultRoleId ?? assignableRoles.value[0]?.id ?? '');

const parsedEmails = computed(() => dedupeEmails(splitEmails(emailsRaw.value)));

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    emailsRaw.value = '';
    message.value = '';
    errors.value = {};
    selectedRoleId.value = props.defaultRoleId ?? assignableRoles.value[0]?.id ?? '';
  }
);

watch(
  () => emailsRaw.value,
  () => {
    /* Clearing the field clears the complaint; re-validating on every keystroke
       would flag a half-typed address as invalid. */
    if (emailsRaw.value.trim() === '' && errors.value.emails) {
      const next = { ...errors.value };
      delete next.emails;
      errors.value = next;
    }
  }
);

function selectRole(roleId: string): void {
  selectedRoleId.value = roleId;
}

function close(): void {
  emit('update:show', false);
}

function currentInput(): InvitationInput {
  return { emails: parsedEmails.value, roleId: selectedRoleId.value, message: message.value };
}

function onSubmit(): void {
  const found = validateInvitationInput(currentInput(), props.existingEmails);
  errors.value = found;
  if (Object.keys(found).length > 0) return;
  emit('submit', {
    emailsRaw: emailsRaw.value,
    emails: parsedEmails.value,
    roleId: selectedRoleId.value,
    message: message.value.trim() === '' ? undefined : message.value.trim()
  });
}

function selectedRole(): Role | undefined {
  return props.roles.find((role) => role.id === selectedRoleId.value);
}

defineExpose({ parsedEmails, errors, onSubmit, close, currentInput, selectRole, selectedRoleId });
</script>

<template>
  <div
    v-if="show"
    class="id-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="i18n.t('org.invite.title')"
    data-testid="invite-dialog"
    @click.self="close"
  >
    <div class="id-dialog">
      <header class="id-dialog__head">
        <h2 class="id-dialog__title">{{ i18n.t('org.invite.title') }}</h2>
        <button
          class="id-dialog__close"
          type="button"
          :aria-label="i18n.t('common.close')"
          data-testid="invite-close"
          @click="close"
        >&times;</button>
      </header>

      <form class="id-dialog__body" @submit.prevent="onSubmit">
        <label class="id-field" for="invite-emails">
          <span class="id-field__label">{{ i18n.t('org.invite.emailsLabel') }}</span>
          <textarea
            id="invite-emails"
            v-model="emailsRaw"
            class="id-field__textarea"
            rows="3"
            data-testid="invite-emails"
            :placeholder="i18n.t('org.invite.emailsPlaceholder')"
            :aria-invalid="errors.emails ? 'true' : 'false'"
          ></textarea>
          <span class="id-field__hint">{{ i18n.t('org.invite.emailsHint') }}</span>
          <span v-if="parsedEmails.length > 0" class="id-field__count" data-testid="invite-parsed">
            {{ i18n.t('org.invite.parsedCount', { n: parsedEmails.length }) }}
          </span>
          <span v-if="errors.emails" class="id-field__error" data-testid="invite-emails-error">
            {{ i18n.t(errors.emails) }}
          </span>
        </label>

        <div class="id-field">
          <span class="id-field__label">{{ i18n.t('org.invite.roleLabel') }}</span>
          <div class="id-roles" role="radiogroup" :aria-label="i18n.t('org.invite.roleLabel')">
            <button
              v-for="role in assignableRoles"
              :key="role.id"
              class="id-role"
              :class="{ 'is-selected': role.id === selectedRoleId }"
              type="button"
              role="radio"
              :aria-checked="role.id === selectedRoleId"
              :data-role-id="role.id"
              data-testid="invite-role"
              @click="selectRole(role.id)"
            >
              <RoleBadge :kind="role.kind" :label="role.builtin ? i18n.t(role.name) : role.name" size="sm" />
            </button>
          </div>
          <span v-if="errors.roleId" class="id-field__error" data-testid="invite-role-error">
            {{ i18n.t(errors.roleId) }}
          </span>
          <p v-if="selectedRole()" class="id-field__hint">
            {{ selectedRole()?.builtin ? i18n.t(selectedRole()?.description ?? '') : selectedRole()?.description }}
          </p>
        </div>

        <label class="id-field" for="invite-message">
          <span class="id-field__label">{{ i18n.t('org.invite.messageLabel') }}</span>
          <textarea
            id="invite-message"
            v-model="message"
            class="id-field__textarea"
            rows="2"
            :maxlength="INVITE_MESSAGE_MAX"
            data-testid="invite-message"
            :placeholder="i18n.t('org.invite.messagePlaceholder')"
          ></textarea>
          <span v-if="errors.message" class="id-field__error">{{ i18n.t(errors.message) }}</span>
        </label>

        <footer class="id-dialog__foot">
          <button class="id-btn" type="button" @click="close">{{ i18n.t('common.cancel') }}</button>
          <button
            class="id-btn id-btn--primary"
            type="submit"
            :disabled="saving"
            data-testid="invite-submit"
          >{{ i18n.t('org.invite.submit') }}</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.id-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(23, 26, 33, 0.45);
}
.id-dialog {
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
}
.id-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--ks-border-default);
}
.id-dialog__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.id-dialog__close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.id-dialog__close:hover {
  background: var(--ks-bg-muted);
}
.id-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}
.id-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.id-field__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-text-secondary);
}
.id-field__textarea {
  padding: 10px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  resize: vertical;
}
.id-field__textarea:focus {
  outline: none;
  border-color: var(--ks-primary);
  box-shadow: 0 0 0 3px rgba(244, 99, 58, 0.14);
}
.id-field__textarea[aria-invalid='true'] {
  border-color: var(--ks-error);
}
.id-field__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.id-field__count {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-primary-text);
}
.id-field__error {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-error);
}
.id-roles {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.id-role {
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease);
}
.id-role.is-selected {
  border-color: var(--ks-primary);
  background: var(--ks-grad-soft);
}
.id-role:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
.id-dialog__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
.id-btn {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.id-btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.id-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.id-btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.id-btn--primary:hover:not(:disabled) {
  filter: brightness(1.04);
}
.id-btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
</style>
