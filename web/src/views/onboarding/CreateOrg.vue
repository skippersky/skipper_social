<script setup lang="ts">
/**
 * Create organisation, first-run onboarding (Sprint 13).
 *
 * Four steps, and only the second one is mandatory. A brand-new account lands here
 * from the route guard with no tenant, so the wizard has to be finishable in one
 * click: step 3 invites nobody if the user skips it, and the skip link in the header
 * abandons the whole flow and drops them in the workspace.
 *
 * Invitations are sent against the organisation just created, not the previous one,
 * which is why the roles are re-read after createOrganization resolves. The store's
 * tenant header is already pointing at the new organisation by then.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import KsAvatar from '../../components/KsAvatar.vue';
import { usePageMeta } from '../../composables/usePageMeta';
import { useMember } from '../../composables/useMember';
import { useOrganization } from '../../composables/useOrganization';
import { useRole } from '../../composables/useRole';
import { useI18nStore } from '../../i18n';
import { ORG_DESCRIPTION_MAX, ORG_NAME_MAX } from '../../lib/organization';
import type { ValidationErrors } from '../../lib/settingsValidation';
import type { Organization } from '../../types';

const TOTAL_STEPS = 4;

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('org.onboarding.metaTitle'), i18n.t('org.onboarding.metaDescription'));

const { createOrganization, validate, loadOrganizations, organizations, loading, saving, error } =
  useOrganization();
const { roles, loadRoles } = useRole();
const { inviteMember, parseEmails } = useMember();

const step = ref(1);
const form = ref({ name: '', logoUrl: '', description: '' });
const formErrors = ref<ValidationErrors>({});
const inviteEmails = ref('');
const inviteRoleId = ref('');
const created = ref<Organization | null>(null);

const canGoNext = computed(() => step.value < TOTAL_STEPS);
const parsedEmails = computed(() => parseEmails(inviteEmails.value));
const stepLabel = computed(() =>
  i18n.t('org.onboarding.stepOf', { current: step.value, total: TOTAL_STEPS })
);

onMounted(async () => {
  /* An account that already has a tenant is offered "create another", not onboarding. */
  await loadOrganizations();
});

function next(): void {
  if (canGoNext.value) step.value += 1;
}

function back(): void {
  if (step.value > 1) step.value -= 1;
}

async function submitCreate(): Promise<void> {
  const payload = {
    name: form.value.name,
    logoUrl: form.value.logoUrl.trim() || undefined,
    description: form.value.description.trim() || undefined
  };
  formErrors.value = validate(payload);
  if (Object.keys(formErrors.value).length > 0) return;
  const org = await createOrganization(payload);
  if (!org) return;
  created.value = org;
  showToast(i18n.t('org.onboarding.createdToast'));
  await loadRoles(org.id);
  inviteRoleId.value = roles.value.find((role) => role.kind === 'member')?.id ?? '';
  step.value = 3;
}

async function submitInvites(): Promise<void> {
  const org = created.value;
  if (!org || parsedEmails.value.length === 0 || !inviteRoleId.value) {
    step.value = 4;
    return;
  }
  const sent = await inviteMember({ emailsRaw: inviteEmails.value, roleId: inviteRoleId.value });
  if (sent) showToast(i18n.t('org.invite.successToast', { n: sent.length }));
  step.value = 4;
}

/** Where "finish" lands: back where the guard interrupted, else the workspace. */
function finish(): void {
  const redirect = route.query.redirect;
  void router.push(typeof redirect === 'string' && redirect !== '' ? redirect : '/home');
}

function skip(): void {
  if (created.value) finish();
  else void router.push('/home');
}

function onStepAction(): void {
  if (step.value === 2) void submitCreate();
  else if (step.value === 3) void submitInvites();
  else if (step.value === 4) finish();
  else next();
}

defineExpose({
  step,
  form,
  formErrors,
  inviteEmails,
  inviteRoleId,
  created,
  parsedEmails,
  next,
  back,
  submitCreate,
  submitInvites,
  finish,
  skip,
  onStepAction,
  alreadyHasOrg: organizations
});
</script>

<template>
  <div class="ob">
    <div class="ob__pattern" aria-hidden="true"></div>
    <main class="ob__card" data-testid="onboarding-card">
      <header class="ob__head">
        <div>
          <p class="ob__overline">{{ stepLabel }}</p>
          <h1 class="ob__title">{{ i18n.t('org.onboarding.title') }}</h1>
        </div>
        <button class="ob__skip" type="button" data-testid="onboarding-skip" @click="skip">
          {{ i18n.t('org.onboarding.skip') }}
        </button>
      </header>

      <ol class="ob__steps" aria-hidden="true">
        <li
          v-for="index in TOTAL_STEPS"
          :key="index"
          class="ob__step-dot"
          :class="{ 'is-done': index < step, 'is-active': index === step }"
        ></li>
      </ol>

      <p v-if="error" class="ob__error" role="alert" data-testid="onboarding-error">{{ i18n.t(error) }}</p>

      <section v-if="step === 1" class="ob__body" data-testid="onboarding-step-1">
        <h2 class="ob__subtitle">{{ i18n.t('org.onboarding.welcomeTitle') }}</h2>
        <p class="ob__text">{{ i18n.t('org.onboarding.welcomeBody') }}</p>
        <ul class="ob__list">
          <li>{{ i18n.t('org.onboarding.step1') }}</li>
          <li>{{ i18n.t('org.onboarding.step2') }}</li>
          <li>{{ i18n.t('org.onboarding.step3') }}</li>
          <li>{{ i18n.t('org.onboarding.step4') }}</li>
        </ul>
      </section>

      <form v-else-if="step === 2" class="ob__body" data-testid="onboarding-step-2" @submit.prevent="submitCreate">
        <label class="ob__field">
          <span>{{ i18n.t('org.onboarding.nameLabel') }}</span>
          <input
            v-model="form.name"
            type="text"
            :maxlength="ORG_NAME_MAX"
            :placeholder="i18n.t('org.onboarding.namePlaceholder')"
            data-testid="onboarding-name"
          />
          <small v-if="formErrors.name" class="ob__err" data-testid="onboarding-name-error">
            {{ i18n.t(formErrors.name) }}
          </small>
        </label>
        <label class="ob__field">
          <span>{{ i18n.t('org.onboarding.logoLabel') }}</span>
          <input
            v-model="form.logoUrl"
            type="url"
            :placeholder="i18n.t('org.settings.logoPlaceholder')"
            data-testid="onboarding-logo"
          />
        </label>
        <label class="ob__field">
          <span>{{ i18n.t('org.onboarding.descriptionLabel') }}</span>
          <textarea
            v-model="form.description"
            rows="3"
            :maxlength="ORG_DESCRIPTION_MAX"
            data-testid="onboarding-description"
          ></textarea>
          <small v-if="formErrors.description" class="ob__err">{{ i18n.t(formErrors.description) }}</small>
        </label>
        <div v-if="form.logoUrl" class="ob__preview">
          <KsAvatar :name="form.name || '?'" :src="form.logoUrl" :size="44" />
        </div>
      </form>

      <section v-else-if="step === 3" class="ob__body" data-testid="onboarding-step-3">
        <h2 class="ob__subtitle">{{ i18n.t('org.onboarding.inviteTitle') }}</h2>
        <p class="ob__text">{{ i18n.t('org.onboarding.inviteBody') }}</p>
        <label class="ob__field">
          <span>{{ i18n.t('org.invite.emailsLabel') }}</span>
          <textarea
            v-model="inviteEmails"
            rows="3"
            :placeholder="i18n.t('org.invite.emailsPlaceholder')"
            data-testid="onboarding-invite-emails"
          ></textarea>
          <small class="ob__hint">
            {{ i18n.t('org.invite.parsedCount', { n: parsedEmails.length }) }}
          </small>
        </label>
        <label class="ob__field">
          <span>{{ i18n.t('org.invite.roleLabel') }}</span>
          <select v-model="inviteRoleId" class="ob__select" data-testid="onboarding-invite-role">
            <option v-for="role in roles.filter((r) => r.kind !== 'owner')" :key="role.id" :value="role.id">
              {{ role.builtin ? i18n.t(role.name) : role.name }}
            </option>
          </select>
        </label>
      </section>

      <section v-else class="ob__body ob__body--done" data-testid="onboarding-step-4">
        <span class="ob__done-mark" aria-hidden="true"></span>
        <h2 class="ob__subtitle">{{ i18n.t('org.onboarding.doneTitle') }}</h2>
        <p class="ob__text">{{ i18n.t('org.onboarding.doneBody') }}</p>
        <p v-if="created" class="ob__created" data-testid="onboarding-created">{{ created.name }}</p>
      </section>

      <footer class="ob__foot">
        <button
          v-if="step > 1 && step < TOTAL_STEPS"
          class="ob__btn"
          type="button"
          data-testid="onboarding-back"
          @click="back"
        >{{ i18n.t('org.onboarding.back') }}</button>
        <span v-else></span>
        <button
          class="ob__btn ob__btn--primary"
          type="button"
          :disabled="saving || loading"
          data-testid="onboarding-next"
          @click="onStepAction"
        >
          {{
            step === TOTAL_STEPS
              ? i18n.t('org.onboarding.finish')
              : step === 2
                ? i18n.t('org.switch.create')
                : i18n.t('org.onboarding.next')
          }}
        </button>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.ob {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--ks-bg-page);
}
.ob__pattern {
  position: absolute;
  inset: auto 0 0;
  height: 34px;
  opacity: 0.45;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='28' viewBox='0 0 56 28'%3E%3Cpath d='M0 28 L14 8 L28 28 Z' fill='%23F4633A' fill-opacity='0.10'/%3E%3Cpath d='M28 28 L42 8 L56 28 Z' fill='%235B5BD6' fill-opacity='0.08'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
}
.ob__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 560px;
  padding: 28px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.ob__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.ob__overline {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-primary-text);
}
.ob__title {
  margin: 6px 0 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ob__skip {
  flex: none;
  border: none;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-family: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
.ob__steps {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ob__step-dot {
  flex: 1 1 0;
  height: 4px;
  border-radius: 2px;
  background: var(--ks-bg-muted);
}
.ob__step-dot.is-done {
  background: var(--ks-border-strong);
}
.ob__step-dot.is-active {
  background: var(--ks-grad-brand);
}
.ob__error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(220, 38, 38, 0.26);
  border-radius: var(--ks-radius-btn);
  background: rgba(220, 38, 38, 0.06);
  color: var(--ks-error);
  font-size: 13px;
}
.ob__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ob__body--done {
  align-items: center;
  text-align: center;
}
.ob__subtitle {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.ob__text {
  margin: 0;
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.ob__list {
  margin: 0;
  padding: 0 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.ob__done-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ks-grad-brand);
  position: relative;
}
.ob__done-mark::after {
  content: "";
  position: absolute;
  left: 15px;
  top: 12px;
  width: 8px;
  height: 16px;
  border: solid var(--ks-ink-on-grad);
  border-width: 0 3px 3px 0;
  transform: rotate(45deg);
}
.ob__created {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-primary-text);
}
.ob__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--ks-text-secondary);
}
.ob__field input,
.ob__field textarea,
.ob__select {
  padding: 10px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
}
.ob__field textarea {
  resize: vertical;
}
.ob__field input:focus-visible,
.ob__field textarea:focus-visible,
.ob__select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
  border-color: var(--ks-primary);
}
.ob__hint {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.ob__err {
  font-size: 12px;
  color: var(--ks-error);
}
.ob__preview {
  display: flex;
  justify-content: center;
}
.ob__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ob__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.ob__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.ob__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ob__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ob__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
@media (max-width: 767px) {
  .ob {
    padding: 24px 14px;
  }
  .ob__card {
    padding: 20px;
  }
  .ob__title {
    font-size: 19px;
    line-height: 26px;
  }
  .ob__foot .ob__btn {
    flex: 1 1 auto;
  }
}
</style>
