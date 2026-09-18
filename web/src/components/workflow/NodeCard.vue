<script setup lang="ts">
/**
 * One draggable entry in the node palette (Sprint 12).
 *
 * Presentational: it knows a node type, its translated label and its accent,
 * and nothing else. Clicking adds the node at the next free canvas slot, and
 * dragging hands the type to the canvas through the shared dataTransfer key, so
 * a pointer and a keyboard user reach exactly the same code path in the builder.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { DRAG_MIME, nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import type { NodeTypeDef, WorkflowNodeKind, WorkflowNodeType } from '../../types';

const props = defineProps<{
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  def?: NodeTypeDef;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', type: WorkflowNodeType): void;
}>();

const i18n = useI18nStore();

const resolved = computed(() => props.def ?? nodeTypeDefOrFallback(props.type, props.kind));
const label = computed(() => i18n.t(resolved.value.labelKey));
const description = computed(() => i18n.t(resolved.value.descKey));
const accent = computed(() => 'is-' + resolved.value.accent);
const fieldCount = computed(() => resolved.value.fields.length);

function onAdd(): void {
  emit('add', props.type);
}

function onDragStart(event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData(DRAG_MIME, props.type);
  /* Firefox needs a non-empty generic payload before it will start a drag. */
  event.dataTransfer.setData('text/plain', props.type);
  event.dataTransfer.effectAllowed = 'copy';
}
</script>

<template>
  <button
    class="nc"
    :class="[accent, { 'nc--compact': compact }]"
    type="button"
    draggable="true"
    :data-node-type="type"
    :data-node-kind="kind"
    :aria-label="label"
    @click="onAdd"
    @dragstart="onDragStart"
  >
    <span class="nc__glyph" :class="'nc__glyph--' + kind" aria-hidden="true"></span>
    <span class="nc__body">
      <span class="nc__label">{{ label }}</span>
      <span v-if="!compact" class="nc__desc">{{ description }}</span>
    </span>
    <span v-if="!compact && fieldCount > 0" class="nc__count">{{ fieldCount }}</span>
  </button>
</template>

<style scoped>
.nc {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ks-border-default);
  border-left: 3px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  font-family: inherit;
  text-align: left;
  cursor: grab;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    background var(--ks-motion-fast) var(--ks-ease),
    transform var(--ks-motion-fast) var(--ks-ease);
}
.nc:hover {
  background: var(--ks-bg-muted);
  transform: translateY(-1px);
}
.nc:active {
  cursor: grabbing;
}
.nc:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.nc.is-primary {
  border-left-color: var(--ks-primary);
}
.nc.is-accent {
  border-left-color: var(--ks-accent);
}
.nc.is-success {
  border-left-color: var(--ks-success);
}
.nc.is-warning {
  border-left-color: var(--ks-warning);
}
.nc--compact {
  padding: 7px 10px;
  align-items: center;
}
.nc__glyph {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  border-radius: 3px;
  background: var(--ks-grad-brand);
}
.nc__glyph--condition {
  border-radius: 2px;
  transform: rotate(45deg);
  background: var(--ks-accent);
}
.nc__glyph--action {
  border-radius: 999px;
  background: var(--ks-success);
}
.nc--compact .nc__glyph {
  margin-top: 0;
}
.nc__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.nc__label {
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nc__desc {
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nc__count {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  border: 1px solid var(--ks-border-default);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
