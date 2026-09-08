<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import TagSelector from './TagSelector.vue';
import { useI18nStore } from '../../i18n';
import type { Customer, CustomerInput, Tag } from '../../types';

const props = withDefaults(defineProps<{
  tags: Tag[];
  customer?: Customer | null;
  submitting?: boolean;
}>(), { customer: null, submitting: false });

const emit = defineEmits<{
  (e: 'submit', input: CustomerInput): void;
  (e: 'cancel'): void;
}>();

const i18n = useI18nStore();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d[\d\s-]{6,14}$/;

const name = ref('');
const phone = ref('');
const email = ref('');
const address = ref('');
const notes = ref('');
const tagIds = ref<string[]>([]);
const fieldErrors = ref<Record<string, string>>({});

const isEdit = computed(() => Boolean(props.customer));

function reset(): void {
  name.value = props.customer?.name ?? '';
  phone.value = props.customer?.phone ?? '';
  email.value = props.customer?.email ?? '';
  address.value = props.customer?.address ?? '';
  notes.value = props.customer?.notes ?? '';
  tagIds.value = (props.customer?.tags ?? []).map((tag) => tag.id);
  fieldErrors.value = {};
}

watch(() => props.customer, reset, { immediate: true });

function validate(): boolean {
  const errors: Record<string, string> = {};
  if (!name.value.trim()) errors.name = i18n.t('common.required');
  if (phone.value.trim() && !PHONE_RE.test(phone.value.trim())) errors.phone = i18n.t('auth.phoneInvalid');
  if (email.value.trim() && !EMAIL_RE.test(email.value.trim())) errors.email = i18n.t('auth.emailInvalid');
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

function onSubmit(): void {
  if (props.submitting || !validate()) return;
  emit('submit', {
    name: name.value.trim(),
    phone: phone.value.trim(),
    email: email.value.trim(),
    address: address.value.trim(),
    notes: notes.value.trim(),
    tagIds: [...tagIds.value]
  });
}
</script>

<template>
  <form class="cust-form" @submit.prevent="onSubmit">
    <p class="cust-form__title">
      {{ isEdit ? i18n.t('customers.editTitle') : i18n.t('customers.createTitle') }}
    </p>

    <label class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldName') }}</span>
      <input v-model="name" class="cust-form__input" type="text" autocomplete="off" />
      <span v-if="fieldErrors.name" class="cust-form__error">{{ fieldErrors.name }}</span>
    </label>

    <label class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldPhone') }}</span>
      <input v-model="phone" class="cust-form__input" type="tel" autocomplete="off" />
      <span v-if="fieldErrors.phone" class="cust-form__error">{{ fieldErrors.phone }}</span>
    </label>

    <label class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldEmail') }}</span>
      <input v-model="email" class="cust-form__input" type="email" autocomplete="off" />
      <span v-if="fieldErrors.email" class="cust-form__error">{{ fieldErrors.email }}</span>
    </label>

    <label class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldAddress') }}</span>
      <input v-model="address" class="cust-form__input" type="text" autocomplete="off" />
    </label>

    <label class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldNotes') }}</span>
      <textarea v-model="notes" class="cust-form__input cust-form__input--area" rows="3"></textarea>
    </label>

    <div class="cust-form__field">
      <span class="cust-form__label">{{ i18n.t('customers.fieldTags') }}</span>
      <TagSelector v-model="tagIds" :tags="tags" />
    </div>

    <div class="cust-form__actions">
      <button class="cust-form__cancel" type="button" @click="emit('cancel')">
        {{ i18n.t('customers.cancel') }}
      </button>
      <button class="cust-form__submit" type="submit" :disabled="submitting">
        {{ isEdit ? i18n.t('customers.formSave') : i18n.t('customers.formCreate') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.cust-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cust-form__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.cust-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cust-form__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.cust-form__input {
  border: 1px solid var(--ks-border-strong);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  padding: 9px 12px;
  box-sizing: border-box;
  font-family: inherit;
}
.cust-form__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.cust-form__input--area {
  resize: vertical;
  min-height: 64px;
}
.cust-form__error {
  font-size: 11px;
  color: var(--ks-error);
}
.cust-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.cust-form__cancel {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cust-form__submit {
  height: 38px;
  padding: 0 18px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.cust-form__submit:disabled {
  opacity: 0.6;
  cursor: default;
}
.cust-form__submit:not(:disabled):hover {
  filter: brightness(1.05);
}
</style>