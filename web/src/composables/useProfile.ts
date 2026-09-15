import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { isProfileValid, validateProfile } from '../lib/settingsValidation';
import type { ValidationErrors } from '../lib/settingsValidation';
import type { SettingsProfile } from '../types';

/** Unsaved edits survive a tab switch or a reload until they are saved. */
export const PROFILE_DRAFT_KEY = 'ks-settings-profile-draft';

function emptyProfile(): SettingsProfile {
  return {
    name: '',
    email: '',
    phone: '',
    bio: '',
    avatarUrl: '',
    company: '',
    timezone: 'UTC',
    language: 'en'
  };
}

export function readProfileDraft(): Partial<SettingsProfile> | null {
  try {
    const raw = localStorage.getItem(PROFILE_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<SettingsProfile>) : null;
  } catch {
    return null;
  }
}

export function writeProfileDraft(value: Partial<SettingsProfile>): void {
  try {
    localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

export function clearProfileDraft(): void {
  try {
    localStorage.removeItem(PROFILE_DRAFT_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Profile tab state: a dirty-checked editable draft plus the cached copy that
 * makes an accidental navigation recoverable.
 */
export function useProfile() {
  const store = useSettingsStore();
  const form = ref<SettingsProfile>(emptyProfile());
  const baseline = ref<SettingsProfile>(emptyProfile());
  const restoredDraft = ref(false);

  const errors = computed<ValidationErrors>(() => validateProfile(form.value));
  const valid = computed(() => Object.keys(errors.value).length === 0);
  const complete = computed(() => isProfileValid(form.value));
  const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(baseline.value));
  const canSave = computed(() => valid.value && dirty.value && !store.saving);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const avatarUrl = computed(() => form.value.avatarUrl);

  function applyProfile(profile: SettingsProfile): void {
    baseline.value = { ...profile };
    form.value = { ...profile };
  }

  async function loadProfile(): Promise<SettingsProfile | null> {
    const profile = await store.fetchProfile();
    if (!profile) return null;
    applyProfile(profile);
    const draft = readProfileDraft();
    restoredDraft.value = draft !== null;
    if (draft) form.value = { ...profile, ...draft };
    return profile;
  }

  /** Every keystroke is cached so the draft can be offered back later. */
  function patchForm(patch: Partial<SettingsProfile>): void {
    form.value = { ...form.value, ...patch };
    writeProfileDraft(form.value);
  }

  function discardDraft(): void {
    clearProfileDraft();
    form.value = { ...baseline.value };
    restoredDraft.value = false;
  }

  function resetForm(): void {
    form.value = { ...baseline.value };
    restoredDraft.value = false;
  }

  async function updateProfile(): Promise<boolean> {
    if (!valid.value) return false;
    const ok = await store.updateProfile({
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      bio: form.value.bio.trim(),
      avatarUrl: form.value.avatarUrl.trim(),
      company: form.value.company.trim(),
      timezone: form.value.timezone,
      language: form.value.language
    });
    if (!ok) return false;
    clearProfileDraft();
    restoredDraft.value = false;
    if (store.profile) applyProfile(store.profile);
    // Keeps the header avatar and nickname aligned with the saved form.
    await useAuthStore().refreshUser();
    return true;
  }

  async function uploadAvatar(file: File): Promise<boolean> {
    const result = await store.uploadAvatar(file);
    if (!result) return false;
    form.value = { ...form.value, avatarUrl: result.url };
    baseline.value = { ...baseline.value, avatarUrl: result.url };
    writeProfileDraft(form.value);
    await useAuthStore().refreshUser();
    return true;
  }

  return {
    store,
    form,
    baseline,
    errors,
    valid,
    complete,
    dirty,
    canSave,
    loading,
    saving,
    error,
    avatarUrl,
    restoredDraft,
    loadProfile,
    patchForm,
    discardDraft,
    resetForm,
    updateProfile,
    uploadAvatar
  };
}
