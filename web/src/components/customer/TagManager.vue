<script setup lang="ts">
import { ref } from 'vue';
import { useI18nStore } from '../../i18n';
import { TAG_COLORS, type Tag } from '../../types';

defineProps<{ tags: Tag[]; loading?: boolean }>();

const emit = defineEmits<{
  (e: 'create', name: string, color: string): void;
  (e: 'update', id: string, patch: { name: string; color: string }): void;
  (e: 'delete', id: string): void;
}>();

const i18n = useI18nStore();

const newName = ref('');
const newColor = ref<string>(TAG_COLORS[0]);
const nameError = ref(false);
const editingId = ref<string | null>(null);
const editName = ref('');
const editColor = ref<string>(TAG_COLORS[0]);

function submitCreate(): void {
  const name = newName.value.trim();
  if (!name) {
    nameError.value = true;
    return;
  }
  nameError.value = false;
  emit('create', name, newColor.value);
  newName.value = '';
}

function startEdit(tag: Tag): void {
  editingId.value = tag.id;
  editName.value = tag.name;
  editColor.value = tag.color;
}

function cancelEdit(): void {
  editingId.value = null;
}

function submitEdit(): void {
  const name = editName.value.trim();
  if (!editingId.value || !name) return;
  emit('update', editingId.value, { name, color: editColor.value });
  editingId.value = null;
}

defineExpose({ submitCreate, startEdit, submitEdit, cancelEdit });
</script>

<template>
  <div class="tag-manager">
    <p class="tag-manager__title">{{ i18n.t('tags.title') }}</p>
    <div v-if="!tags.length && !loading" class="tag-manager__empty">{{ i18n.t('tags.empty') }}</div>
    <ul class="tag-manager__list">
      <li v-for="tag in tags" :key="tag.id" class="tag-manager__row">
        <template v-if="editingId === tag.id">
          <input v-model="editName" class="tag-manager__input" :aria-label="i18n.t('tags.name')" />
          <span class="tag-manager__colors">
            <button
              v-for="color in TAG_COLORS"
              :key="color"
              class="tag-manager__color"
              :class="{ 'is-active': editColor === color }"
              type="button"
              :style="{ background: color }"
              :aria-label="color"
              @click="editColor = color"
            ></button>
          </span>
          <button class="tag-manager__save" type="button" @click="submitEdit">
            {{ i18n.t('tags.save') }}
          </button>
          <button class="tag-manager__cancel" type="button" @click="cancelEdit">
            {{ i18n.t('customers.cancel') }}
          </button>
        </template>
        <template v-else>
          <span class="tag-manager__chip" :style="{ background: `${tag.color}1f`, color: tag.color }">
            {{ tag.name }}
          </span>
          <span class="tag-manager__row-actions">
            <button class="tag-manager__action" type="button" @click="startEdit(tag)">
              {{ i18n.t('tags.edit') }}
            </button>
            <button class="tag-manager__action tag-manager__action--danger" type="button" @click="emit('delete', tag.id)">
              {{ i18n.t('tags.delete') }}
            </button>
          </span>
        </template>
      </li>
    </ul>
    <form class="tag-manager__create" @submit.prevent="submitCreate">
      <div class="tag-manager__field">
        <input
          v-model="newName"
          class="tag-manager__input"
          :placeholder="i18n.t('tags.name')"
          :aria-label="i18n.t('tags.name')"
        />
        <p v-if="nameError" class="tag-manager__error">{{ i18n.t('common.required') }}</p>
      </div>
      <span class="tag-manager__colors">
        <button
          v-for="color in TAG_COLORS"
          :key="color"
          class="tag-manager__color"
          :class="{ 'is-active': newColor === color }"
          type="button"
          :style="{ background: color }"
          :aria-label="color"
          @click="newColor = color"
        ></button>
      </span>
      <button class="tag-manager__add" type="submit">{{ i18n.t('tags.add') }}</button>
    </form>
  </div>
</template>

<style scoped>
.tag-manager {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tag-manager__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tag-manager__empty {
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.tag-manager__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tag-manager__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 8px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
}
.tag-manager__chip {
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  padding: 4px 12px;
}
.tag-manager__row-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.tag-manager__action {
  border: none;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}
.tag-manager__action:hover {
  background: var(--ks-bg-muted);
}
.tag-manager__action--danger {
  color: var(--ks-error);
}
.tag-manager__input {
  height: 32px;
  min-width: 120px;
  border: 1px solid var(--ks-border-default);
  border-radius: 8px;
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  padding: 0 10px;
  box-sizing: border-box;
}
.tag-manager__colors {
  display: inline-flex;
  gap: 6px;
}
.tag-manager__color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.tag-manager__color.is-active {
  border-color: var(--ks-text-primary);
}
.tag-manager__save {
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.tag-manager__cancel {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: 8px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.tag-manager__create {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid var(--ks-border-default);
  padding-top: 12px;
}
.tag-manager__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tag-manager__error {
  margin: 0;
  font-size: 11px;
  color: var(--ks-error);
}
.tag-manager__add {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.tag-manager__add:hover {
  background: var(--ks-grad-soft);
}
</style>