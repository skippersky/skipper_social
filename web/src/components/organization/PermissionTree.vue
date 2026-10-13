<script setup lang="ts">
/**
 * PermissionTree (Sprint 13).
 *
 * The role editor's permission picker: eight groups, each with a header checkbox
 * that selects or clears the whole group, and one row per action carrying its
 * description so a name like "Export" is never ambiguous about what it exports.
 *
 * Groups start collapsed except the first, because 29 rows on screen at once
 * makes the dialog a wall of checkboxes and hides the decision the admin is
 * actually making. Read-only mode renders the same tree with every control
 * disabled, which is how a built-in role's rights are shown.
 */
import { computed, ref } from 'vue';
import { useI18nStore } from '../../i18n';
import { PERMISSION_GROUPS } from '../../lib/permissions';
import type { PermissionGroup } from '../../types';

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    groups?: PermissionGroup[];
    readonly?: boolean;
  }>(),
  { groups: undefined, readonly: false }
);

const emit = defineEmits<{ (event: 'update:modelValue', value: string[]): void }>();

const i18n = useI18nStore();

const catalog = computed(() =>
  props.groups && props.groups.length > 0 ? props.groups : PERMISSION_GROUPS
);

const selected = computed(() => new Set(props.modelValue));

/** All but the first group start collapsed to keep the dialog scannable. */
const expanded = ref<Record<string, boolean>>(
  Object.fromEntries(PERMISSION_GROUPS.map((group, index) => [group.key, index === 0]))
);

const selectedCount = computed(() => props.modelValue.length);

function isExpanded(key: string): boolean {
  return expanded.value[key] === true;
}

function toggleGroupOpen(key: string): void {
  expanded.value = { ...expanded.value, [key]: !isExpanded(key) };
}

function groupKeys(group: PermissionGroup): string[] {
  return group.permissions.map((permission) => permission.key);
}

function isGroupComplete(group: PermissionGroup): boolean {
  const keys = groupKeys(group);
  return keys.length > 0 && keys.every((key) => selected.value.has(key));
}

function isGroupPartial(group: PermissionGroup): boolean {
  const keys = groupKeys(group);
  const on = keys.filter((key) => selected.value.has(key)).length;
  return on > 0 && on < keys.length;
}

function onToggleGroup(group: PermissionGroup): void {
  if (props.readonly) return;
  const keys = groupKeys(group);
  const next = isGroupComplete(group)
    ? props.modelValue.filter((key) => !keys.includes(key))
    : [...new Set([...props.modelValue, ...keys])];
  emit('update:modelValue', next);
}

function onTogglePermission(key: string): void {
  if (props.readonly) return;
  const next = selected.value.has(key)
    ? props.modelValue.filter((entry) => entry !== key)
    : [...props.modelValue, key];
  emit('update:modelValue', next);
}

defineExpose({ isGroupComplete, isGroupPartial, toggleGroupOpen, isExpanded, selectedCount });
</script>

<template>
  <div class="pt" :data-readonly="readonly ? 'true' : 'false'" data-testid="permission-tree">
    <p class="pt__summary" data-testid="permission-count">
      {{ i18n.t('org.roles.editorSelected', { n: selectedCount }) }}
    </p>

    <section v-for="group in catalog" :key="group.key" class="pt__group" :data-group="group.key">
      <header class="pt__head">
        <label class="pt__check">
          <input
            type="checkbox"
            :checked="isGroupComplete(group)"
            :disabled="readonly"
            :aria-label="i18n.t('org.roles.editorToggleGroup')"
            :data-group-toggle="group.key"
            @change="onToggleGroup(group)"
          />
          <span
            class="pt__group-label"
            :class="{ 'is-partial': isGroupPartial(group) }"
            role="button"
            tabindex="0"
            :aria-expanded="isExpanded(group.key)"
            :data-group-header="group.key"
            @click="toggleGroupOpen(group.key)"
            @keydown.enter.prevent="toggleGroupOpen(group.key)"
            @keydown.space.prevent="toggleGroupOpen(group.key)"
          >{{ i18n.t(group.label) }}</span>
        </label>
        <button
          class="pt__caret"
          type="button"
          :aria-label="i18n.t(group.label)"
          :aria-expanded="isExpanded(group.key)"
          :data-group-caret="group.key"
          @click="toggleGroupOpen(group.key)"
        >{{ isExpanded(group.key) ? '\u2212' : '+' }}</button>
      </header>

      <ul v-if="isExpanded(group.key)" class="pt__list">
        <li v-for="permission in group.permissions" :key="permission.key" class="pt__row">
          <label class="pt__check" :data-permission="permission.key">
            <input
              type="checkbox"
              :checked="selected.has(permission.key)"
              :disabled="readonly"
              :data-permission-input="permission.key"
              @change="onTogglePermission(permission.key)"
            />
            <span class="pt__text">
              <span class="pt__label">{{ i18n.t(permission.label) }}</span>
              <span v-if="permission.description" class="pt__desc">
                {{ i18n.t(permission.description) }}
              </span>
            </span>
          </label>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.pt {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pt__summary {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--ks-primary-text);
}
.pt__group {
  border: 1px solid var(--ks-border-default);
  border-radius: 12px;
  background: var(--ks-bg-surface);
  overflow: hidden;
}
.pt__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--ks-bg-muted);
}
.pt__check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
}
.pt__check input[type='checkbox'] {
  margin: 2px 0 0;
  width: 15px;
  height: 15px;
  flex: none;
  accent-color: var(--ks-primary);
  cursor: pointer;
}
.pt__check input[type='checkbox']:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
.pt__group-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.pt__group-label.is-partial {
  color: var(--ks-primary-text);
}
.pt__group-label:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
  border-radius: 4px;
}
.pt__caret {
  flex: none;
  width: 26px;
  height: 26px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 8px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.pt__caret:hover {
  background: var(--ks-bg-muted);
}
.pt__list {
  margin: 0;
  padding: 4px 12px 10px;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.pt__row {
  padding: 7px 0;
  border-bottom: 1px solid var(--ks-border-default);
}
.pt__row:last-child {
  border-bottom: none;
}
.pt__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pt__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.pt__desc {
  font-size: 12px;
  line-height: 17px;
  color: var(--ks-text-tertiary);
}
.pt[data-readonly='true'] .pt__check {
  cursor: default;
}
.pt[data-readonly='true'] .pt__caret {
  cursor: pointer;
}
</style>
