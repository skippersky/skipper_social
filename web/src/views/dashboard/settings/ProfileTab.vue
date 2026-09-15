<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { showToast } from 'vant';
import { DEMO_TIMEZONES } from '../../../api/settings';
import AvatarUploader from '../../../components/settings/AvatarUploader.vue';
import { useProfile } from '../../../composables/useProfile';
import { useI18nStore } from '../../../i18n';
import { UI_LOCALES } from '../../../i18n/messages';
import { BIO_MAX } from '../../../lib/settingsValidation';

const i18n = useI18nStore();
const {
  form,
  errors,
  canSave,
  saving,
  restoredDraft,
  loadProfile,
  patchForm,
  discardDraft,
  updateProfile,
  uploadAvatar
} = useProfile();

const bioCount = computed(() => form.value.bio.length);
const timezones = computed(() =>
  form.value.timezone && !DEMO_TIMEZONES.includes(form.value.timezone)
    ? [form.value.timezone, ...DEMO_TIMEZONES]
    : DEMO_TIMEZONES
);

async function onSave(): Promise<void> {
  if (await updateProfile()) showToast(i18n.t('settings.saved'));
  else showToast(i18n.t('settings.saveFailed'));
}

async function onAvatar(file: File): Promise<void> {
  if (await uploadAvatar(file)) showToast(i18n.t('settings.saved'));
  else showToast(i18n.t('settings.avatarFailed'));
}

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <div class="tab">
    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.avatarTitle') }}</h2>
      <AvatarUploader
        :model-value="form.avatarUrl"
        :name="form.name || '?'"
        :busy="saving"
        @select="onAvatar"
      />
    </section>

    <p v-if="restoredDraft" class="tab__notice">
      <span>{{ i18n.t('settings.draftRestored') }}</span>
      <button class="tab__notice-btn" type="button" @click="discardDraft">
        {{ i18n.t('settings.draftDiscard') }}
      </button>
    </p>

    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.profileTitle') }}</h2>
      <form class="tab__form" @submit.prevent="onSave">
        <div class="field">
          <label for="sp-name">{{ i18n.t('settings.field.name') }}</label>
          <input
            id="sp-name"
            :value="form.name"
            type="text"
            maxlength="50"
            :class="{ 'has-error': Boolean(errors.name) }"
            @input="patchForm({ name: ($event.target as HTMLInputElement).value })"
          />
          <p v-if="errors.name" class="field__error">{{ i18n.t(errors.name) }}</p>
        </div>

        <div class="field">
          <label for="sp-email">{{ i18n.t('settings.field.email') }}</label>
          <input id="sp-email" :value="form.email" type="email" readonly />
          <p class="field__help">{{ i18n.t('settings.emailReadonlyHint') }}</p>
        </div>

        <div class="field">
          <label for="sp-phone">{{ i18n.t('settings.field.phone') }}</label>
          <input
            id="sp-phone"
            :value="form.phone"
            type="tel"
            placeholder="+255 7XX XXX XXX"
            :class="{ 'has-error': Boolean(errors.phone) }"
            @input="patchForm({ phone: ($event.target as HTMLInputElement).value })"
          />
          <p v-if="errors.phone" class="field__error">{{ i18n.t(errors.phone) }}</p>
        </div>

        <div class="field">
          <label for="sp-company">{{ i18n.t('settings.field.company') }}</label>
          <input
            id="sp-company"
            :value="form.company"
            type="text"
            @input="patchForm({ company: ($event.target as HTMLInputElement).value })"
          />
        </div>

        <div class="field">
          <label for="sp-bio">{{ i18n.t('settings.field.bio') }}</label>
          <textarea
            id="sp-bio"
            :value="form.bio"
            rows="3"
            :maxlength="BIO_MAX"
            :class="{ 'has-error': Boolean(errors.bio) }"
            @input="patchForm({ bio: ($event.target as HTMLTextAreaElement).value })"
          ></textarea>
          <p class="field__help">
            {{ i18n.t('settings.bioCounter', { count: bioCount, max: BIO_MAX }) }}
          </p>
          <p v-if="errors.bio" class="field__error">{{ i18n.t(errors.bio) }}</p>
        </div>

        <div class="field">
          <label for="sp-timezone">{{ i18n.t('settings.field.timezone') }}</label>
          <select
            id="sp-timezone"
            :value="form.timezone"
            @change="patchForm({ timezone: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </div>

        <div class="field">
          <label for="sp-language">{{ i18n.t('settings.field.language') }}</label>
          <select
            id="sp-language"
            :value="form.language"
            @change="patchForm({ language: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="lang in UI_LOCALES" :key="lang" :value="lang">
              {{ i18n.t('settings.lang.' + lang) }}
            </option>
          </select>
        </div>

        <div class="tab__actions">
          <button class="tab__btn" type="button" @click="discardDraft">
            {{ i18n.t('common.cancel') }}
          </button>
          <button class="tab__btn tab__btn--primary" type="submit" :disabled="!canSave">
            {{ saving ? i18n.t('common.loading') : i18n.t('settings.save') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tab__card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
}
.tab__card-title {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tab__notice {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid rgba(180, 83, 9, 0.35);
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 13px;
}
.tab__notice-btn {
  margin-left: auto;
  height: 30px;
  padding: 0 12px;
  border: 1px solid currentColor;
  border-radius: var(--ks-radius-btn);
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tab__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.field input,
.field select {
  height: 42px;
}
.field textarea {
  padding: 10px 12px;
  resize: vertical;
}
.field input:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.field input.has-error,
.field textarea.has-error {
  border-color: var(--ks-error);
}
.field input[readonly] {
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
.field__help {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.field__error {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-error);
}
.tab__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.tab__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tab__btn:hover {
  background: var(--ks-bg-muted);
}
.tab__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tab__btn--primary:hover {
  filter: brightness(1.05);
  background: var(--ks-grad-brand);
}
.tab__btn--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 767px) {
  .tab__form {
    grid-template-columns: minmax(0, 1fr);
  }
  .tab__actions {
    flex-direction: column-reverse;
  }
  .tab__btn {
    width: 100%;
  }
}
</style>
