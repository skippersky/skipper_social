<script setup lang="ts">
/**
 * Workflow builder (Sprint 12).
 *
 * Three panes: the node palette, the canvas and the property form. On a narrow
 * screen the panes collapse into tabs and the canvas degrades to the editable
 * step list, which keeps orchestration usable on a phone. Every graph mutation
 * goes through useWorkflowBuilder so the store, the validator and the canvas can
 * never drift apart, and a graph left over from the template library survives
 * the first mount instead of being cleared.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import NodePanel from '../../../components/workflow/NodePanel.vue';
import NodePropertyPanel from '../../../components/workflow/NodePropertyPanel.vue';
import WorkflowCanvas from '../../../components/workflow/WorkflowCanvas.vue';
import { CONNECT_PROBLEM_KEYS, useWorkflowBuilder } from '../../../composables/useWorkflowBuilder';
import { useWorkflow } from '../../../composables/useWorkflow';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import type {
  ConditionBranch,
  NodeConfig,
  NodePosition,
  WorkflowIssue,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowValidation
} from '../../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();

usePageMeta(i18n.t('workflow.builder.metaTitle'), i18n.t('workflow.builder.metaDescription'));

const {
  definition,
  selectedNode,
  selectedNodeId,
  dirty,
  saving,
  nodeCount,
  edgeCount,
  validationLocal,
  incompleteNodeIds,
  canSave,
  initCanvas,
  clearCanvas,
  addNode,
  addNodeAt,
  removeNode,
  selectNode,
  updateNode,
  updateNodeConfig,
  moveNodes,
  connectNodes,
  disconnectNodes,
  autoArrange,
  validateFlow,
  validateLocal,
  missingFor,
  save
} = useWorkflowBuilder();

const { open, error } = useWorkflow();

const workflowId = ref<string | null>(null);
const nameText = ref('');
const descText = ref('');
/** Narrow screens show one pane at a time. */
const tab = ref<'palette' | 'canvas' | 'property'>('canvas');
const isMobile = ref(false);

const variant = computed<'graph' | 'list'>(() => (isMobile.value ? 'list' : 'graph'));

const pageTitle = computed(() =>
  workflowId.value === null
    ? i18n.t('workflow.builder.createTitle')
    : i18n.t('workflow.builder.editTitle')
);

const counts = computed(() =>
  i18n.t('workflow.builder.counts', { nodes: nodeCount.value, edges: edgeCount.value })
);

const missingKeys = computed(() => (selectedNode.value ? missingFor(selectedNode.value) : []));

/**
 * Newest rule check wins. Every edit re-runs the synchronous validator, and a
 * server answer takes over until the graph changes again, so the panel under
 * the canvas is never a step behind what the user just drew.
 */
const serverValidation = ref<WorkflowValidation | null>(null);

const visibleIssues = computed<WorkflowIssue[]>(
  () => (serverValidation.value ?? validationLocal.value).issues
);

const issuesByNode = computed<Record<string, WorkflowIssue[]>>(() => {
  const map: Record<string, WorkflowIssue[]> = {};
  for (const item of visibleIssues.value) {
    if (!item.nodeId) continue;
    (map[item.nodeId] ??= []).push(item);
  }
  return map;
});

const selectedIssues = computed(() =>
  selectedNode.value ? (issuesByNode.value[selectedNode.value.id] ?? []) : []
);

/** Validator hits plus missing config, so the canvas badges follow the panel. */
const problemIds = computed<string[]>(() => {
  const fromIssues = visibleIssues.value.map((item) => item.nodeId).filter(Boolean) as string[];
  return Array.from(new Set(fromIssues.concat(incompleteNodeIds.value)));
});

const isSaving = computed(() => saving.value);

function queryText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/* ----------------------------------------------------------------- viewport */

function syncViewport(): void {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 1024;
}

/* ------------------------------------------------------------------- canvas */

function onPaletteAdd(type: WorkflowNodeType): void {
  const node = addNode(type);
  selectNode(node.id);
  if (isMobile.value) tab.value = 'property';
}

function onPaletteDrag(): void {
  /* The palette owns the drag payload; the canvas reports the drop. */
}

function onCanvasAdd(type: string, position: NodePosition): void {
  const node = addNodeAt(type as WorkflowNodeType, position);
  selectNode(node.id);
}

function onSelect(nodeId: string | null): void {
  selectNode(nodeId);
}

function onConnect(source: string, target: string, branch?: ConditionBranch): void {
  const result = connectNodes(source, target, branch);
  if (result.ok || result.problem === null) return;
  const key = CONNECT_PROBLEM_KEYS[result.problem];
  showToast(i18n.t(key ?? 'workflow.connect.missingNode'));
}

function onDisconnect(edgeId: string): void {
  disconnectNodes(edgeId);
}

function onMove(positions: Record<string, NodePosition>): void {
  moveNodes(positions);
}

/* ------------------------------------------------------------------ property */

function onPatch(patch: Partial<WorkflowNode>): void {
  if (selectedNode.value) updateNode(selectedNode.value.id, patch);
}

function onConfig(patch: NodeConfig): void {
  if (selectedNode.value) updateNodeConfig(selectedNode.value.id, patch);
}

function onRemoveNode(nodeId: string): void {
  removeNode(nodeId);
  selectNode(null);
}

function onPropertyClose(): void {
  selectNode(null);
  if (isMobile.value) tab.value = 'canvas';
}

function focusIssue(nodeId?: string): void {
  if (!nodeId) return;
  selectNode(nodeId);
  if (isMobile.value) tab.value = 'property';
}

/* ------------------------------------------------------------------ toolbar */

async function onValidate(): Promise<void> {
  const result = await validateFlow();
  serverValidation.value = result;
  const count = result.issues.length;
  showToast(
    result.valid && count === 0
      ? i18n.t('workflow.builder.validToast')
      : i18n.t('workflow.builder.invalidToast', { n: count })
  );
}

function onAutoLayout(): void {
  autoArrange();
}

async function onClear(): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('workflow.builder.clear'),
      message: i18n.t('workflow.builder.clearConfirm'),
      confirmButtonText: i18n.t('workflow.builder.confirm'),
      cancelButtonText: i18n.t('workflow.builder.cancel')
    });
  } catch {
    return; /* dismissed */
  }
  clearCanvas();
  selectNode(null);
}

/**
 * One persist path for both buttons. A blank name and an incomplete node are
 * refused before the request, and an invalid graph is never published active.
 */
async function persist(status: 'draft' | 'active'): Promise<void> {
  const name = nameText.value.trim();
  if (name === '') {
    showToast(i18n.t('workflow.builder.nameRequired'));
    return;
  }
  if (!canSave.value) {
    showToast(i18n.t('workflow.builder.cannotSave'));
    return;
  }
  if (status === 'active' && !validateLocal().valid) {
    showToast(i18n.t('workflow.builder.publishBlocked'));
    return;
  }
  const saved = await save({
    id: workflowId.value ?? undefined,
    name,
    description: descText.value.trim(),
    status
  });
  if (saved === null) {
    showToast(i18n.t('workflow.builder.saveFailed'));
    return;
  }
  showToast(i18n.t('workflow.builder.savedToast'));
  workflowId.value = saved.id;
  void router.replace('/dashboard/workflows/' + saved.id);
}

function onSave(): void {
  void persist('draft');
}

function onPublish(): void {
  void persist('active');
}

function backToList(): void {
  void router.push('/dashboard/workflows');
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

/* One edit, one re-check: the panel and the canvas badges stay in step. */
watch(
  definition,
  () => {
    serverValidation.value = null;
    validateLocal();
  },
  { deep: true }
);

/* --------------------------------------------------------------------- boot */

async function boot(): Promise<void> {
  const id = queryText(route.query.id);
  if (id !== '') {
    workflowId.value = id;
    const loaded = await open(id);
    if (loaded) {
      initCanvas(loaded);
      nameText.value = loaded.name;
      descText.value = loaded.description;
    } else {
      showToast(i18n.t('workflow.detail.notFound'));
    }
  } else if (definition.value.nodes.length === 0) {
    /* Blank builder, unless the template library already staged a graph. */
    initCanvas(null);
    nameText.value = queryText(route.query.name);
  }
  validateLocal();
}

onMounted(() => {
  syncViewport();
  if (typeof window !== 'undefined') window.addEventListener('resize', syncViewport);
  void boot();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', syncViewport);
});
</script>

<template>
  <section class="wfb">
    <header class="wfb__top">
      <button
        class="wfb__home"
        type="button"
        :aria-label="i18n.t('workflow.backToList')"
        @click="backToList"
      >&larr;</button>
      <div class="wfb__heading">
        <h1 class="wfb__title">{{ pageTitle }}</h1>
        <p class="wfb__subtitle">
          <span>{{ counts }}</span>
          <span v-if="dirty" class="wfb__unsaved">{{ i18n.t('workflow.builder.unsaved') }}</span>
        </p>
      </div>
      <div class="wfb__actions">
        <button class="wfb__btn" type="button" :disabled="isSaving" @click="onValidate">
          {{ i18n.t('workflow.builder.validate') }}
        </button>
        <button class="wfb__btn" type="button" :disabled="isSaving" @click="onAutoLayout">
          {{ i18n.t('workflow.builder.autoLayout') }}
        </button>
        <button
          class="wfb__btn is-ghost"
          type="button"
          :disabled="isSaving || nodeCount === 0"
          @click="onClear"
        >{{ i18n.t('workflow.builder.clear') }}</button>
        <button class="wfb__btn" type="button" :disabled="isSaving" @click="onSave">
          {{ isSaving ? i18n.t('workflow.builder.saving') : i18n.t('workflow.builder.save') }}
        </button>
        <button class="wfb__btn is-primary" type="button" :disabled="isSaving" @click="onPublish">
          {{ i18n.t('workflow.builder.publish') }}
        </button>
      </div>
    </header>

    <form class="wfb__meta" @submit.prevent="onSave">
      <label class="wfb__field">
        <span class="wfb__label">{{ i18n.t('workflow.builder.nameLabel') }}</span>
        <input
          v-model="nameText"
          class="wfb__input"
          type="text"
          :placeholder="i18n.t('workflow.builder.namePlaceholder')"
        />
      </label>
      <label class="wfb__field wfb__field--wide">
        <span class="wfb__label">{{ i18n.t('workflow.builder.descLabel') }}</span>
        <input
          v-model="descText"
          class="wfb__input"
          type="text"
          :placeholder="i18n.t('workflow.builder.descPlaceholder')"
        />
      </label>
    </form>

    <div class="wfb__tabs" role="tablist">
      <button
        class="wfb__tab"
        :class="{ 'is-active': tab === 'palette' }"
        type="button"
        role="tab"
        :aria-selected="tab === 'palette'"
        @click="tab = 'palette'"
      >{{ i18n.t('workflow.builder.tabPalette') }}</button>
      <button
        class="wfb__tab"
        :class="{ 'is-active': tab === 'canvas' }"
        type="button"
        role="tab"
        :aria-selected="tab === 'canvas'"
        @click="tab = 'canvas'"
      >{{ i18n.t('workflow.builder.tabCanvas') }}</button>
      <button
        class="wfb__tab"
        :class="{ 'is-active': tab === 'property' }"
        type="button"
        role="tab"
        :aria-selected="tab === 'property'"
        @click="tab = 'property'"
      >{{ i18n.t('workflow.builder.tabProperty') }}</button>
    </div>

    <div class="wfb__body">
      <aside class="wfb__pane wfb__pane--left" :data-tab="tab">
        <NodePanel @add="onPaletteAdd" @drag="onPaletteDrag" />
      </aside>

      <div class="wfb__pane wfb__pane--canvas" :data-tab="tab">
        <WorkflowCanvas
          :definition="definition"
          :variant="variant"
          :selected-node-id="selectedNodeId"
          :problem-node-ids="problemIds"
          @select="onSelect"
          @connect="onConnect"
          @disconnect="onDisconnect"
          @move="onMove"
          @add="onCanvasAdd"
        />
        <p class="wfb__hint">
          {{ isMobile ? i18n.t('workflow.builder.mobileHint') : i18n.t('workflow.builder.canvasHint') }}
        </p>
      </div>

      <aside class="wfb__pane wfb__pane--right" :data-tab="tab">
        <NodePropertyPanel
          :node="selectedNode"
          :issues="selectedIssues"
          :missing="missingKeys"
          @patch="onPatch"
          @config="onConfig"
          @remove="onRemoveNode"
          @close="onPropertyClose"
        />
        <p v-if="selectedNode && missingKeys.length > 0" class="wfb__missing">
          {{ i18n.t('workflow.property.missing', { keys: missingKeys.join(', ') }) }}
        </p>
        <p v-if="selectedNode && selectedIssues.length > 0" class="wfb__node-issues">
          {{ i18n.t('workflow.property.issues') }}
        </p>
      </aside>
    </div>

    <section class="wfb__issues">
      <h2 class="wfb__issues-title">{{ i18n.t('workflow.builder.issuesTitle') }}</h2>
      <p v-if="visibleIssues.length === 0" class="wfb__issues-ok">
        {{ i18n.t('workflow.builder.noIssues') }}
      </p>
      <ul v-else class="wfb__issue-list">
        <li v-for="(item, index) in visibleIssues" :key="index" class="wfb__issue">
          <button
            v-if="item.nodeId"
            class="wfb__issue-btn"
            type="button"
            @click="focusIssue(item.nodeId)"
          >{{ i18n.t(item.messageKey) }}</button>
          <span v-else>{{ i18n.t(item.messageKey) }}</span>
        </li>
      </ul>
      <p v-if="incompleteNodeIds.length > 0" class="wfb__incomplete">
        {{ i18n.t('workflow.builder.cannotSave') }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.wfb {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  box-sizing: border-box;
}
.wfb__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.wfb__home {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.wfb__home:hover {
  background: var(--ks-bg-muted);
}
.wfb__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wfb__heading {
  flex: 1 1 280px;
  min-width: 0;
}
.wfb__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wfb__subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.wfb__unsaved {
  padding: 1px 8px;
  border: 1px solid var(--ks-warning);
  border-radius: 999px;
  color: var(--ks-warning);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.wfb__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wfb__btn {
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.wfb__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
  border-color: var(--ks-primary-text);
}
.wfb__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wfb__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wfb__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wfb__btn.is-primary:hover:not(:disabled) {
  background: var(--ks-grad-brand);
  filter: brightness(1.05);
}
.wfb__btn.is-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ks-text-secondary);
}
.wfb__btn.is-ghost:hover:not(:disabled) {
  background: var(--ks-bg-muted);
  color: var(--ks-error);
  border-color: transparent;
}
.wfb__meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.wfb__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 240px;
  min-width: 0;
}
.wfb__field--wide {
  flex: 2 1 360px;
}
.wfb__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.wfb__input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.wfb__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.wfb__tabs {
  display: none;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.wfb__tab {
  flex: 1 1 auto;
  height: 32px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.wfb__tab.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.wfb__tab:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wfb__body {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 320px);
  gap: 14px;
  align-items: start;
}
.wfb__pane {
  min-width: 0;
}
.wfb__pane--canvas {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 520px;
}
.wfb__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.wfb__missing {
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--ks-warning);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-warning);
  font-size: 12px;
  line-height: 18px;
}
.wfb__node-issues {
  margin: 8px 0 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ks-error);
}
.wfb__issues {
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wfb__issues-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wfb__issues-ok {
  margin: 0;
  font-size: 12px;
  color: var(--ks-success);
}
.wfb__issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wfb__issue {
  padding: 8px 10px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  color: var(--ks-error);
  font-size: 12px;
  line-height: 18px;
}
.wfb__issue-btn {
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
}
.wfb__issue-btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
.wfb__incomplete {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ks-warning);
}

@media (max-width: 1279px) {
  .wfb__body {
    grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  }
  .wfb__pane--right {
    grid-column: 1 / -1;
  }
}
@media (max-width: 1023px) {
  .wfb__tabs {
    display: flex;
  }
  .wfb__body {
    grid-template-columns: minmax(0, 1fr);
  }
  .wfb__pane[data-tab='palette'].wfb__pane--left {
    display: block;
  }
  .wfb__pane--left,
  .wfb__pane--right {
    display: none;
  }
  .wfb__pane--canvas {
    display: flex;
    min-height: 360px;
  }
  .wfb__pane--left[data-tab='palette'] {
    display: block;
  }
  .wfb__pane--canvas[data-tab='canvas'] {
    display: flex;
  }
  .wfb__pane--right[data-tab='property'] {
    display: block;
  }
}
@media (max-width: 767px) {
  .wfb {
    padding: 16px 12px 40px;
  }
  .wfb__title {
    font-size: 19px;
    line-height: 26px;
  }
  .wfb__actions {
    width: 100%;
  }
  .wfb__actions .wfb__btn {
    flex: 1 1 auto;
  }
  .wfb__actions .wfb__btn.is-primary {
    flex: 1 1 100%;
  }
  .wfb__field,
  .wfb__field--wide {
    flex: 1 1 100%;
  }
}
</style>
