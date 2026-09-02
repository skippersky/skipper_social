<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { showToast } from 'vant';
import KsAvatar from '../components/KsAvatar.vue';
import SettingsNav from '../components/SettingsNav.vue';
import { useI18nStore } from '../i18n';
import { useAuthStore } from '../stores/auth';

const TIMEZONES = [
  'Africa/Dar_es_Salaam',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Addis_Ababa',
  'Africa/Lagos',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Asia/Shanghai',
  'America/New_York'
];
const LANGUAGES = ['en', 'sw', 'zh', 'fr'];

const auth = useAuthStore();
const i18n = useI18nStore();

const nickname = ref('');
const company = ref('');
const timezone = ref(TIMEZONES[0]);
const language = ref('en');
const avatarUrl = ref('');
const saving = ref(false);

onMounted(async () => {
  await auth.bootstrap();
  if (auth.user) {
    nickname.value = auth.user.nickname;
    company.value = auth.user.company ?? '';
    timezone.value = auth.user.timezone;
    language.value = auth.user.language;
    avatarUrl.value = auth.user.avatarUrl ?? '';
  }
});

async function onSave(): Promise<void> {
  const name = nickname.value.trim();
  if (name.length < 2 || name.length > 20) {
    showToast(i18n.t('auth.nicknameInvalid'));
    return;
  }
  saving.value = true;
  try {
    await auth.updateProfile({
      nickname: name,
      company: company.value.trim(),
      timezone: timezone.value,
      language: language.value,
      avatarUrl: avatarUrl.value.trim() || undefined
    });
    showToast(i18n.t('profile.saved'));
  } catch {
    showToast(i18n.t('api.network'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <SettingsNav>
    <section class="profile-card">
      <h2 class="profile-card__title">{{ i18n.t('profile.title') }}</h2>
      <div class="profile-card__readonly">
        <div class="profile-card__avatar">
          <KsAvatar :name="auth.user?.nickname ?? '?'" :src="auth.user?.avatarUrl" :size="64" />
        </div>
        <dl class="profile-card__facts">
          <div><dt>{{ i18n.t('profile.email') }}</dt><dd>{{ auth.user?.email }}</dd></div>
          <div><dt>{{ i18n.t('profile.joined') }}</dt><dd>{{ auth.user ? new Date(auth.user.createdAt).toLocaleDateString() : '' }}</dd></div>
          <div><dt>{{ i18n.t('profile.tier') }}</dt><dd>{{ auth.user?.subscriptionTier }}</dd></div>
        </dl>
      </div>
      <form class="profile-card__form" @submit.prevent="onSave">
        <div class="profile-field">
          <label for="pf-nickname">{{ i18n.t('auth.nickname') }}</label>
          <input id="pf-nickname" v-model="nickname" type="text" />
        </div>
        <div class="profile-field">
          <label for="pf-company">{{ i18n.t('profile.company') }}</label>
          <input id="pf-company" v-model="company" type="text" />
        </div>
        <div class="profile-field">
          <label for="pf-timezone">{{ i18n.t('profile.timezone') }}</label>
          <select id="pf-timezone" v-model="timezone">
            <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </div>
        <div class="profile-field">
          <label for="pf-language">{{ i18n.t('profile.languagePref') }}</label>
          <select id="pf-language" v-model="language">
            <option v-for="lang in LANGUAGES" :key="lang" :value="lang">{{ lang }}</option>
          </select>
        </div>
        <div class="profile-field">
          <label for="pf-avatar">{{ i18n.t('profile.avatarUrl') }}</label>
          <input id="pf-avatar" v-model="avatarUrl" type="url" placeholder="https://" />
        </div>
        <button class="profile-save" type="submit" :disabled="saving">
          {{ saving ? '...' : i18n.t('profile.save') }}
        </button>
      </form>
    </section>
  </SettingsNav>
</template>

<style scoped>
.profile-card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 24px;
}
.profile-card__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  margin-bottom: 18px;
}
.profile-card__readonly {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--ks-border-default);
}
.profile-card__facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.profile-card__facts div {
  display: flex;
  gap: 10px;
  font-size: 13px;
}
.profile-card__facts dt {
  color: var(--ks-text-tertiary);
  min-width: 72px;
}
.profile-card__facts dd {
  margin: 0;
  color: var(--ks-text-primary);
  font-weight: 500;
}
.profile-card__form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.profile-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.profile-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.profile-field input,
.profile-field select {
  height: 42px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  box-sizing: border-box;
}
.profile-field input:focus-visible,
.profile-field select:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.profile-save {
  grid-column: 1 / -1;
  height: 44px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.profile-save:disabled {
  opacity: 0.6;
  cursor: wait;
}
@media (max-width: 767px) {
  .profile-card__form {
    grid-template-columns: 1fr;
  }
}
</style>