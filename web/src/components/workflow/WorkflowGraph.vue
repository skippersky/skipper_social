<script setup lang="ts">
/**
 * The Vue Flow renderer (Sprint 12).
 *
 * Split out of WorkflowCanvas so the heavy graph library is code-split: list
 * mode, the jsdom test suite and mobile users never download it. Vue Flow stays
 * a renderer only. It turns pointer gestures into intents (add / connect /
 * move / select) and the builder composable decides whether they are legal, so
 * an illegal edge can never reach the definition.
 */
import { computed, ref } from 'vue';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import type {
  Connection,
  Edge,
  EdgeMouseEvent,
  GraphNode,
  Node,
  NodeDragEvent,
  NodeMouseEvent
} from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { useI18nStore } from '../../i18n';
import { nodeById } from '../../lib/workflowGraph';
import { DRAG_MIME, missingRequiredKeys, nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import type { ConditionBranch, NodePosition, WorkflowDefinition, WorkflowNode } from '../../types';

const props = defineProps<{
  definition: WorkflowDefinition;
  readonly?: boolean;
  selectedNodeId?: string | null;
  problemNodeIds?: string[];
  /** Node id -> run state; the run detail replay paints it onto the graph. */
  nodeStates?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'add', type: string, position: NodePosition): void;
  (e: 'select', nodeId: string | null): void;
  (e: 'connect', source: string, target: string, branch?: ConditionBranch): void;
  (e: 'disconnect', edgeId: string): void;
  (e: 'move', positions: Record<string, NodePosition>): void;
}>();

const i18n = useI18nStore();
const wrapper = ref<HTMLElement | null>(null);
const { screenToFlowCoordinate } = useVueFlow();

const locked = computed(() => props.readonly === true);
const problems = computed(() => props.problemNodeIds ?? []);
const states = computed(() => props.nodeStates ?? {});

function labelOf(node: WorkflowNode): string {
  if (node.name && node.name.trim()) return node.name;
  return i18n.t(nodeTypeDefOrFallback(node.type, node.kind).labelKey);
}

const flowNodes = computed<Node[]>(() =>
  props.definition.nodes.map((node) => ({
    id: node.id,
    type: 'ks',
    position: { x: node.position.x, y: node.position.y },
    selected: props.selectedNodeId === node.id,
    draggable: !locked.value,
    data: { node }
  }))
);

const flowEdges = computed<Edge[]>(() =>
  props.definition.edges.map((edge) => {
    const isBranch = edge.branch === 'true' || edge.branch === 'false';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: isBranch ? edge.branch : undefined,
      label: isBranch ? i18n.t('workflow.branch.' + edge.branch) : edge.label ?? '',
      animated: states.value[edge.target] === 'running',
      markerEnd: MarkerType.ArrowClosed,
      class: 'wfg__edge' + (isBranch ? ' is-branch-' + edge.branch : ''),
      data: { edge }
    } as Edge;
  })
);

/** One-line config digest rendered under the node label. */
function summaryOf(node: WorkflowNode): string {
  const missing = missingRequiredKeys(node);
  if (missing.length > 0) return i18n.t('workflow.canvas.incomplete', { n: missing.length });
  const entries = Object.entries(node.config).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) return i18n.t('workflow.canvas.noConfig');
  const head = entries.slice(0, 2).map(([key, value]) => key + ': ' + String(value)).join(' / ');
  return head.length > 46 ? head.slice(0, 46) + '...' : head;
}

function kindOf(id: string): string {
  return nodeById(props.definition, id)?.kind ?? 'action';
}

function onConnect(connection: Connection): void {
  if (locked.value) return;
  const handle = connection.sourceHandle;
  const branch = handle === 'true' || handle === 'false' ? (handle as ConditionBranch) : undefined;
  emit('connect', connection.source, connection.target, branch);
}

function onNodeClick(payload: NodeMouseEvent): void {
  emit('select', payload.node.id);
}

function onEdgeClick(payload: EdgeMouseEvent): void {
  if (locked.value) return;
  emit('disconnect', payload.edge.id);
}

function onPaneClick(): void {
  emit('select', null);
}

/** Vue Flow reports the whole dragged selection, so one drop can move many nodes. */
function onNodeDragStop(payload: NodeDragEvent): void {
  if (locked.value) return;
  const positions: Record<string, NodePosition> = {};
  const dragged = payload.nodes;
  const list: GraphNode[] = dragged && dragged.length > 0 ? dragged : [payload.node];
  for (const item of list) {
    positions[item.id] = { x: Math.round(item.position.x), y: Math.round(item.position.y) };
  }
  emit('move', positions);
}

function onDragOver(event: DragEvent): void {
  if (locked.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

/** Palette drop: convert the screen point into flow space, then add the node. */
function onDrop(event: DragEvent): void {
  if (locked.value) return;
  event.preventDefault();
  const transfer = event.dataTransfer;
  const type = transfer ? transfer.getData(DRAG_MIME) || transfer.getData('text/plain') : '';
  if (!type) return;
  const point = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  emit('add', type, { x: Math.round(point.x), y: Math.round(point.y) });
}
</script>

<template>
  <div ref="wrapper" class="wfg" :class="{ 'is-readonly': locked }" @drop="onDrop" @dragover="onDragOver">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :nodes-draggable="!locked"
      :nodes-connectable="!locked"
      :edges-updatable="false"
      :elements-selectable="true"
      :min-zoom="0.3"
      :max-zoom="2"
      :default-viewport="{ x: 0, y: 0, zoom: 0.85 }"
      fit-view-on-init
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
    >
      <Background :gap="20" :size="1" pattern-color="#D8DBE6" />
      <Controls v-if="!locked" />
      <MiniMap pannable :node-stroke-width="0" />

      <template #node-ks="slot">
        <div
          class="wfg__node"
          :class="[
            'is-' + kindOf(slot.id),
            { 'is-selected': selectedNodeId === slot.id, 'is-problem': problems.includes(slot.id) }
          ]"
          :data-node-id="slot.id"
          :data-state="states[slot.id] || ''"
        >
          <Handle type="target" :position="Position.Left" />

          <span class="wfg__kind">{{ i18n.t('workflow.kind.' + kindOf(slot.id)) }}</span>
          <strong class="wfg__label">{{ labelOf(slot.data.node) }}</strong>
          <span class="wfg__summary">{{ summaryOf(slot.data.node) }}</span>

          <template v-if="kindOf(slot.id) === 'condition'">
            <Handle id="true" type="source" :position="Position.Right" class="wfg__handle wfg__handle--true" />
            <Handle id="false" type="source" :position="Position.Right" class="wfg__handle wfg__handle--false" />
          </template>
          <Handle v-else type="source" :position="Position.Right" class="wfg__handle" />
        </div>
      </template>
    </VueFlow>

    <p v-if="definition.nodes.length === 0" class="wfg__empty">
      {{ i18n.t('workflow.canvas.empty') }}
    </p>
  </div>
</template>

<style scoped>
.wfg {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-base);
  overflow: hidden;
}
.wfg.is-readonly {
  background: var(--ks-bg-muted);
}
.wfg__empty {
  position: absolute;
  inset: auto 0 0 0;
  margin: 0;
  padding: 14px;
  background: var(--ks-bg-surface);
  border-top: 1px dashed var(--ks-border-strong);
  color: var(--ks-text-tertiary);
  font-size: 12px;
  text-align: center;
  pointer-events: none;
}
.wfg__node {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 208px;
  padding: 10px 12px;
  border: 1px solid var(--ks-border-strong);
  border-left: 3px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: box-shadow var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.wfg__node.is-trigger {
  border-left-color: var(--ks-primary);
}
.wfg__node.is-condition {
  border-left-color: var(--ks-accent);
}
.wfg__node.is-action {
  border-left-color: var(--ks-success);
}
.wfg__node.is-selected {
  border-color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-float);
}
.wfg__node.is-problem {
  border-color: var(--ks-error);
  border-left-color: var(--ks-error);
}
.wfg__node[data-state='running'] {
  animation: wfg-pulse 1.2s var(--ks-ease) infinite;
}
.wfg__node[data-state='failed'] {
  border-color: var(--ks-error);
  background: var(--ks-bg-muted);
}
.wfg__node[data-state='succeeded'] {
  border-left-color: var(--ks-success);
}
.wfg__node[data-state='skipped'] {
  opacity: 0.55;
}
@keyframes wfg-pulse {
  0%,
  100% {
    box-shadow: var(--ks-shadow-card);
  }
  50% {
    box-shadow: var(--ks-shadow-float);
  }
}
.wfg__kind {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wfg__label {
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfg__summary {
  font-size: 11px;
  line-height: 15px;
  color: var(--ks-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfg__handle {
  width: 9px;
  height: 9px;
  border: 2px solid var(--ks-bg-surface);
  background: var(--ks-primary-text);
}
.wfg__handle--true {
  top: 34%;
  background: var(--ks-success);
}
.wfg__handle--false {
  top: 70%;
  background: var(--ks-warning);
}
.wfg :deep(.vue-flow__edge-text) {
  font-size: 10px;
  fill: var(--ks-text-secondary);
}
.wfg :deep(.vue-flow__edge-textbg) {
  fill: var(--ks-bg-surface);
}
.wfg :deep(.vue-flow__edge.is-branch-true .vue-flow__edge-path) {
  stroke: var(--ks-success);
}
.wfg :deep(.vue-flow__edge.is-branch-false .vue-flow__edge-path) {
  stroke: var(--ks-warning);
}
.wfg :deep(.vue-flow__controls) {
  box-shadow: var(--ks-shadow-card);
  border-radius: var(--ks-radius-btn);
  overflow: hidden;
}
.wfg :deep(.vue-flow__minimap) {
  border-radius: var(--ks-radius-btn);
  overflow: hidden;
  box-shadow: var(--ks-shadow-card);
}
</style>
