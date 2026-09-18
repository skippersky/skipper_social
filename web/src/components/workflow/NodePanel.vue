<script setup lang="ts">
/**
 * Left rail of the builder: every node type the engine knows, grouped by kind
 * (Sprint 12).
 *
 * The panel is pure presentation over lib/workflowNodes. A click emits "add"
 * and a drag carries the type through the shared DRAG_MIME payload, so pointer
 * and drag-and-drop users land on the same builder code path. Search narrows
 * the list without touching the store.
 */
import { computed, ref } from 'vue';
import { useI18nStore } from '../../i18n';
import { nodesByKind } from '../../lib/workflowNodes';
import NodeCard from './NodeCard.vue';
import type { NodeTypeDef, WorkflowNodeKind, WorkflowNodeType } from '../../types';

const emit = defineEmits<{
  (e: 'add', type: WorkflowNodeType): void;
  (e: 'drag', type: WorkflowNodeType): void;
}>();

const i18n = useI18nStore();

/** Palette order matches the engine rule: one trigger, then branches, then actions. */
const GROUPS: WorkflowNodeKind[] = ['trigger', 'condition', 'action'];

const search = ref('');
const collapsed = ref<Record<string, boolean>>({});

const groups = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return GROUPS.map((kind) => {
    const all: NodeTypeDef[] = nodesByKind(kind);
    const items = needle
      ? all.filter((def) =>
          (i18n.t(def.labelKey) + ' ' + i18n.t(def.descKey) + ' ' + def.type)
            .toLowerCase()
            .includes(needle)
        )
      : all;
    return { kind, all: all.length, items };
  });
});

const visibleCount = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0));

function isCollapsed(kind: WorkflowNodeKind): boolean {
  return collapsed.value[kind] === true;
}

function toggle(kind: WorkflowNodeKind): void {
  collapsed.value = { ...collapsed.value, [kind]: !isCollapsed(kind) };
}

function clearSearch(): void {
  search.value = '';
}

function onAdd(type: WorkflowNodeType): void {
  emit('add', type);
}

function onDrag(type: WorkflowNodeType): void {
  emit('drag', type);
}
</script>

<template>
  <aside class="np" :aria-label="i18n.t('workflow.palette.title')">
    <header class="np__head">
      <h2 class="np__title">{{ i18n.t('workflow.palette.title') }}</h2>
      <span class="np__count">{{ visibleCount }}</span>
    </header>

    <div class="np__search">
      <input
        v-model="search"
        class="np__input"
        type="search"
        :placeholder="i18n.t('workflow.palette.searchPlaceholder')"
        :aria-label="i18n.t('workflow.palette.searchPlaceholder')"
      />
      <button
        v-if="search"
        class="np__clear"
        type="button"
        :aria-label="i18n.t('workflow.palette.clearSearch')"
        @click="clearSearch"
      >&times;</button>
    </div>

    <p v-if="visibleCount === 0" class="np__none">{{ i18n.t('workflow.palette.noMatch') }}</p>

    <section v-for="group in groups" :key="group.kind" class="np__group" :data-kind="group.kind">
      <button
        class="np__group-head"
        type="button"
        :aria-expanded="!isCollapsed(group.kind)"
        @click="toggle(group.kind)"
      >
        <span class="np__chevron" :class="{ 'is-open': !isCollapsed(group.kind) }" aria-hidden="true"></span>
        <span class="np__group-label">{{ i18n.t('workflow.kind.' + group.kind) }}</span>
        <span class="np__group-count">{{ group.items.length }}/{{ group.all }}</span>
      </button>

      <div v-if="!isCollapsed(group.kind)" class="np__items">
        <NodeCard
          v-for="def in group.items"
          :key="def.type"
          :type="def.type"
          :kind="def.kind"
          :def="def"
          @add="onAdd"
          @dragstart="onDrag(def.type)"
        />
        <p v-if="group.items.length === 0" class="np__group-empty">
          {{ i18n.t('workflow.palette.noMatch') }}
        </p>
      </div>
    </section>

    <p class="np__hint">{{ i18n.t('workflow.palette.hint') }}</p>
  </aside>
</template>

<style scoped>
.np {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  height: 100%;
  padding: 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  overflow-y: auto;
}
.np__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.np__title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.np__count {
  flex: none;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.np__search {
  position: relative;
  display: flex;
  align-items: center;
}
.np__input {
  width: 100%;
  height: 36px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.np__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.np__clear {
  position: absolute;
  right: 6px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.np__none,
.np__group-empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.np__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.np__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 4px;
  border: none;
  border-bottom: 1px solid var(--ks-border-default);
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}
.np__group-head:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.np__chevron {
  flex: none;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--ks-text-tertiary);
  border-bottom: 2px solid var(--ks-text-tertiary);
  transform: rotate(-45deg);
  transition: transform var(--ks-motion-fast) var(--ks-ease);
}
.np__chevron.is-open {
  transform: rotate(45deg);
}
.np__group-label {
  flex: 1 1 auto;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.np__group-count {
  flex: none;
  font-size: 11px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.np__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.np__hint {
  margin: auto 0 0;
  padding-top: 8px;
  border-top: 1px solid var(--ks-border-default);
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
}

@media (max-width: 1023px) {
  .np {
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    overflow: visible;
  }
  .np__hint {
    display: none;
  }
}
</style>
