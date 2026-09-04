<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { QuickReplyTemplate } from '../../types';

const props = defineProps<{ show: boolean; templates: QuickReplyTemplate[] }>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', template: QuickReplyTemplate): void;
}>();

const i18n = useI18nStore();

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
});
</script>

<template>
  <van-popup v-model:show="visible" position="bottom" round :style="{ maxHeight: '60%' }">
    <div class="quick-popup">
      <p class="quick-popup__title">{{ i18n.t('inbox.quickReply') }}</p>
      <button
        v-for="template in templates"
        :key="template.id"
        class="quick-popup__item"
        type="button"
        @click="emit('select', template)"
      >
        <span class="quick-popup__item-title">{{ template.title }}</span>
        <span class="quick-popup__item-text">{{ template.text }}</span>
      </button>
    </div>
  </van-popup>
</template>

<script lang="ts">
export default {
  name: 'QuickReplyPopup'
};
</script>

<style scoped>
.quick-popup {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 55dvh;
  overflow-y: auto;
}
.quick-popup__title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
}
.quick-popup__item {
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.quick-popup__item:hover {
  border-color: var(--ks-border-strong);
  background: var(--ks-bg-muted);
}
.quick-popup__item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.quick-popup__item-text {
  font-size: 12px;
  color: var(--ks-text-secondary);
}
</style>