<script setup lang="ts">
import type { Tag } from '../../types';

const props = defineProps<{ tags: Tag[]; modelValue: string[] }>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>();

function toggle(tagId: string): void {
  const next = props.modelValue.includes(tagId)
    ? props.modelValue.filter((id) => id !== tagId)
    : [...props.modelValue, tagId];
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="tag-select">
    <button
      v-for="tag in tags"
      :key="tag.id"
      class="tag-select__chip"
      :class="{ 'is-active': modelValue.includes(tag.id) }"
      type="button"
      :style="modelValue.includes(tag.id) ? { background: `${tag.color}29`, color: tag.color, borderColor: tag.color } : undefined"
      :aria-pressed="modelValue.includes(tag.id)"
      @click="toggle(tag.id)"
    >
      <span class="tag-select__dot" :style="{ background: tag.color }" aria-hidden="true"></span>
      {{ tag.name }}
    </button>
  </div>
</template>

<style scoped>
.tag-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-select__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.tag-select__chip.is-active {
  font-weight: 700;
}
.tag-select__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>