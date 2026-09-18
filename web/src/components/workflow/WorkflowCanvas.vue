<script setup lang="ts">
/**
 * The workflow canvas (Sprint 12).
 *
 * One component, two renderings of the same definition. Desktop gets the Vue
 * Flow graph, loaded lazily so the heavy library never ships to a phone or a
 * test runner; narrow screens and jsdom get the list renderer, which exposes
 * exactly the same intents (select, disconnect) in a form that works without
 * pointer precision. The builder view cannot tell them apart, which is what
 * keeps mobile a real editing surface rather than a read-only fallback.
 */
import { computed, defineAsyncComponent } from 'vue';
import { useI18nStore } from '../../i18n';
import { outgoing } from '../../lib/workflowGraph';
import { missingRequiredKeys, nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import type {
  ConditionBranch,
  NodePosition,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode
} from '../../types';

/** Graph mode pulls Vue Flow in as a separate chunk. */
const WorkflowGraph = defineAsyncComponent(() => import('./WorkflowGraph.vue'));

const props = withDefaults(
  defineProps<{
    definition: WorkflowDefinition;
    variant?: 'graph' | 'list';
    readonly?: boolean;
    selectedNodeId?: string | null;
    problemNodeIds?: string[];
    nodeStates?: Record<string, string>;
  }>(),
  { variant: 'graph', readonly: false, selectedNodeId: null }
);

const emit = defineEmits<{
  (e: 'select', nodeId: string | null): void;
  (e: 'connect', source: string, target: string, branch?: ConditionBranch): void;
  (e: 'disconnect', edgeId: string): void;
  (e: 'move', positions: Record<string, NodePosition>): void;
  (e: 'add', type: string, position: NodePosition): void;
}>();

const i18n = useI18nStore();

const locked = computed(() => props.readonly);
const isGraph = computed(() => props.variant === 'graph');
const problems = computed(() => props.problemNodeIds ?? []);
const nodes = computed(() => props.definition.nodes);
const edges = computed(() => props.definition.edges);
const states = computed(() => props.nodeStates ?? {});

function labelOf(node: WorkflowNode): string {
  if (node.name && node.name.trim()) return node.name;
  return i18n.t(nodeTypeDefOrFallback(node.type, node.kind).labelKey);
}

function typeLabelOf(node: WorkflowNode): string {
  return i18n.t(nodeTypeDefOrFallback(node.type, node.kind).labelKey);
}

function nameOf(id: string): string {
  const node = nodes.value.find((item) => item.id === id);
  return node ? labelOf(node) : id;
}

function missingCount(node: WorkflowNode): number {
  return missingRequiredKeys(node).length;
}

function configDigest(node: WorkflowNode): string {
  const entries = Object.entries(node.config).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) return i18n.t('workflow.canvas.noConfig');
  return entries
    .slice(0, 3)
    .map(([key, value]) => key + ': ' + String(value))
    .join(' / ');
}

function branchesOf(node: WorkflowNode): WorkflowEdge[] {
  return outgoing(props.definition, node.id);
}

function branchLabel(edge: WorkflowEdge): string {
  if (edge.branch === 'true' || edge.branch === 'false') {
    return i18n.t('workflow.branch.' + edge.branch);
  }
  return i18n.t('workflow.canvas.next');
}

function onSelect(nodeId: string | null): void {
  emit('select', nodeId);
}

function onDisconnect(edgeId: string): void {
  if (locked.value) return;
  emit('disconnect', edgeId);
}

function onRelayAdd(type: string, position: NodePosition): void {
  emit('add', type, position);
}

function onRelayConnect(source: string, target: string, branch?: ConditionBranch): void {
  emit('connect', source, target, branch);
}

function onRelayMove(positions: Record<string, NodePosition>): void {
  emit('move', positions);
}
</script>

<template>
  <div class="wc" :data-variant="variant">
    <WorkflowGraph
      v-if="isGraph"
      :definition="definition"
      :readonly="locked"
      :selected-node-id="selectedNodeId"
      :problem-node-ids="problems"
      :node-states="states"
      @add="onRelayAdd"
      @select="onSelect"
      @connect="onRelayConnect"
      @disconnect="onDisconnect"
      @move="onRelayMove"
    />

    <div v-else class="wc__list" :data-readonly="String(locked)">
      <p v-if="nodes.length === 0" class="wc__empty">{{ i18n.t('workflow.canvas.empty') }}</p>

      <ol class="wc__nodes">
        <li
          v-for="(node, index) in nodes"
          :key="node.id"
          class="wc__node"
          :class="[
            'is-' + node.kind,
            { 'is-selected': selectedNodeId === node.id, 'is-problem': problems.includes(node.id) }
          ]"
          :data-node-id="node.id"
          :data-state="states[node.id] || ''"
        >
          <button class="wc__node-main" type="button" @click="onSelect(node.id)">
            <span class="wc__step">{{ index + 1 }}</span>
            <span class="wc__node-body">
              <span class="wc__node-head">
                <span class="wc__kind">{{ i18n.t('workflow.kind.' + node.kind) }}</span>
                <strong class="wc__label">{{ labelOf(node) }}</strong>
              </span>
              <span class="wc__type">{{ typeLabelOf(node) }}</span>
              <span class="wc__digest">{{ configDigest(node) }}</span>
              <span v-if="missingCount(node) > 0" class="wc__missing">
                {{ i18n.t('workflow.canvas.incomplete', { n: missingCount(node) }) }}
              </span>
            </span>
          </button>

          <ul v-if="branchesOf(node).length > 0" class="wc__branches">
            <li v-for="edge in branchesOf(node)" :key="edge.id" class="wc__branch">
              <span class="wc__branch-label" :class="edge.branch ? 'is-' + edge.branch : ''">
                {{ branchLabel(edge) }}
              </span>
              <span class="wc__branch-target">{{ nameOf(edge.target) }}</span>
              <button
                v-if="!locked"
                class="wc__branch-cut"
                type="button"
                :aria-label="i18n.t('workflow.canvas.disconnect')"
                @click="onDisconnect(edge.id)"
              >&times;</button>
            </li>
          </ul>
        </li>
      </ol>

      <p v-if="nodes.length > 0" class="wc__edge-count">
        {{ i18n.t('workflow.canvas.edgeCount', { n: edges.length }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.wc {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
}
.wc__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wc__empty {
  margin: 0;
  padding: 28px 12px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.wc__nodes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wc__node {
  border: 1px solid var(--ks-border-default);
  border-left: 3px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  overflow: hidden;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.wc__node.is-trigger {
  border-left-color: var(--ks-primary);
}
.wc__node.is-condition {
  border-left-color: var(--ks-accent);
}
.wc__node.is-action {
  border-left-color: var(--ks-success);
}
.wc__node.is-selected {
  border-color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-float);
}
.wc__node.is-problem {
  border-color: var(--ks-error);
  border-left-color: var(--ks-error);
}
.wc__node[data-state='running'] {
  animation: wc-pulse 1.2s var(--ks-ease) infinite;
}
.wc__node[data-state='failed'] {
  border-color: var(--ks-error);
  background: var(--ks-bg-muted);
}
.wc__node[data-state='skipped'] {
  opacity: 0.6;
}
@keyframes wc-pulse {
  0%,
  100% {
    box-shadow: var(--ks-shadow-card);
  }
  50% {
    box-shadow: var(--ks-shadow-float);
  }
}
.wc__node-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.wc__node-main:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: -2px;
}
.wc__step {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ks-bg-muted);
  border: 1px solid var(--ks-border-strong);
  color: var(--ks-text-secondary);
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.wc__node-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}
.wc__node-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.wc__kind {
  flex: none;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wc__label {
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wc__type,
.wc__digest {
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wc__missing {
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-error);
  font-weight: 600;
}
.wc__branches {
  list-style: none;
  margin: 0;
  padding: 8px 12px 10px;
  border-top: 1px dashed var(--ks-border-default);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wc__branch {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.wc__branch-label {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--ks-border-strong);
  font-size: 10px;
  font-weight: 700;
  color: var(--ks-text-secondary);
}
.wc__branch-label.is-true {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.wc__branch-label.is-false {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.wc__branch-target {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--ks-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wc__branch-cut {
  flex: none;
  width: 22px;
  height: 22px;
  border: 1px solid var(--ks-border-default);
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-tertiary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.wc__branch-cut:hover {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.wc__branch-cut:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wc__edge-count {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--ks-border-default);
  font-size: 11px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
