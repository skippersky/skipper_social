<script setup lang="ts">
import { computed, ref } from 'vue';
import { showToast } from 'vant';
import { useI18nStore } from '../../i18n';
import { avatarErrorI18nKey, MAX_AVATAR_BYTES, prepareAvatar } from '../../lib/avatar';
import KsAvatar from '../KsAvatar.vue';

const props = withDefaults(
  defineProps<{ modelValue?: string; name: string; busy?: boolean }>(),
  { modelValue: '', busy: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', file: File): void;
}>();

const i18n = useI18nStore();
const input = ref<HTMLInputElement | null>(null);
/** Locally prepared image, shown immediately so the crop is visible at once. */
const preview = ref('');
const wasCompressed = ref(false);

const src = computed(() => preview.value || props.modelValue || '');
const budgetLabel = computed(() => Math.round(MAX_AVATAR_BYTES / (1024 * 1024)) + ' MB');

function pick(): void {
  if (props.busy) return;
  input.value?.click();
}

async function onChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (target) target.value = '';
  if (!file) return;
  try {
    const prepared = await prepareAvatar(file);
    preview.value = prepared.dataUrl;
    wasCompressed.value = prepared.compressed;
    emit('update:modelValue', prepared.dataUrl);
    emit('select', file);
    if (prepared.compressed) showToast(i18n.t('settings.avatarCompressed'));
  } catch (error) {
    preview.value = '';
    wasCompressed.value = false;
    showToast(i18n.t(avatarErrorI18nKey(error)));
  }
}
</script>

<template>
  <div class="avatar-uploader">
    <KsAvatar :name="name" :src="src" :size="72" />
    <div class="avatar-uploader__copy">
      <p class="avatar-uploader__title">{{ i18n.t('settings.avatarTitle') }}</p>
      <p class="avatar-uploader__hint">
        {{ i18n.t('settings.avatarHint', { size: budgetLabel }) }}
      </p>
      <button
        class="avatar-uploader__btn"
        type="button"
        :disabled="busy"
        @click="pick"
      >{{ busy ? i18n.t('common.loading') : i18n.t('settings.avatarChange') }}</button>
      <input
        ref="input"
        class="avatar-uploader__input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        :aria-label="i18n.t('settings.avatarChange')"
        @change="onChange"
      />
    </div>
  </div>
</template>

<style scoped>
.avatar-uploader {
  display: flex;
  align-items: center;
  gap: 16px;
}
.avatar-uploader__copy {
  min-width: 0;
}
.avatar-uploader__title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.avatar-uploader__hint {
  margin: 2px 0 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.avatar-uploader__btn {
  height: 34px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.avatar-uploader__btn:hover {
  background: var(--ks-bg-muted);
}
.avatar-uploader__btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.avatar-uploader__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
