/**
 * Workflow canvas editing (Sprint 12).
 *
 * Owns everything the builder does to a graph: dropping nodes, wiring edges,
 * editing the property panel, auto arranging and validating. The graph itself
 * lives in the workflow store so navigating away and back does not lose work,
 * and every edit delegates to a pure function in lib/workflowGraph, which means
 * the canvas can never produce a shape the validator would not recognise.
 *
 * Vue Flow stays a renderer: it emits intents (add / connect / move) and this
 * composable turns them into immutable definition updates.
 */
import { computed, ref } from 'vue';
import { useWorkflowStore } from '../stores/workflow';
import {
  autoLayout,
  canConnect,
  createNode,
  nodeById,
  outgoing,
  summarizeDefinition,
  triggerOf,
  validateDefinition
} from '../lib/workflowGraph';
import type { ConnectProblem, DefinitionSummary } from '../lib/workflowGraph';
import { defaultConfigFor, fieldsFor, missingRequiredKeys } from '../lib/workflowNodes';
import { CONDITION_BRANCHES } from '../types';
import type {
  ConditionBranch,
  NodeConfig,
  NodeFieldDef,
  NodePosition,
  Workflow,
  WorkflowDefinition,
  WorkflowInput,
  WorkflowIssue,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowValidation
} from '../types';

export interface ConnectResult {
  ok: boolean;
  /** Reason for a refusal, null when the connection was accepted. */
  problem: ConnectProblem | 'branch-full' | null;
  edgeId: string | null;
}

/** Maps a refusal onto the toast key the builder renders. */
export const CONNECT_PROBLEM_KEYS: Record<string, string> = {
  'missing-node': 'workflow.connect.missingNode',
  'self-loop': 'workflow.connect.selfLoop',
  duplicate: 'workflow.connect.duplicate',
  'branch-full': 'workflow.connect.branchFull'
};

/**
 * Picks the branch label for an edge leaving a condition node. Condition nodes
 * have exactly two outputs, so the first free label wins and a third attempt is
 * refused rather than silently overwriting a branch.
 */
export function resolveBranch(
  def: WorkflowDefinition,
  sourceId: string,
  branch?: ConditionBranch
): ConditionBranch | null | undefined {
  const node = nodeById(def, sourceId);
  if (!node || node.kind !== 'condition') return undefined;
  if (branch) return branch;
  const used = new Set(outgoing(def, sourceId).map((edge) => edge.branch));
  return CONDITION_BRANCHES.find((candidate) => !used.has(candidate)) ?? null;
}

export function useWorkflowBuilder() {
  const store = useWorkflowStore();

  const definition = computed(() => store.definition);
  const selectedNode = computed(() => store.selectedNode);
  const selectedNodeId = computed(() => store.selectedNodeId);
  const dirty = computed(() => store.dirty);
  const saving = computed(() => store.saving);
  const validation = computed(() => store.validation);
  const nodeCount = computed(() => store.nodeCount);
  const edgeCount = computed(() => store.edgeCount);
  const triggerKind = computed(() => store.triggerKind);
  const issues = computed<WorkflowIssue[]>(() => validation.value.issues);
  const isValid = computed(() => validation.value.valid && validation.value.issues.length === 0);
  const issueNodeIds = computed(() => store.issueNodeIds);
  const triggerNode = computed(() => triggerOf(definition.value));
  const graphSummary = computed<DefinitionSummary>(() => summarizeDefinition(definition.value));

  /** Synchronous rule check; the canvas highlights before any round trip. */
  const validationLocal = ref<WorkflowValidation>({ valid: true, issues: [] });

  /** Node ids that still miss a required config value; drives panel badges. */
  const incompleteNodeIds = computed(() =>
    definition.value.nodes
      .filter((node) => missingRequiredKeys(node).length > 0)
      .map((node) => node.id)
  );

  const canSave = computed(() => nodeCount.value > 0 && incompleteNodeIds.value.length === 0);

  /** Ids painted as problematic: validator hits plus missing config. */
  const problemNodeIds = computed(() =>
    Array.from(new Set(issueNodeIds.value.concat(incompleteNodeIds.value)))
  );

  const nodeIssues = computed<Record<string, WorkflowIssue[]>>(() => {
    const map: Record<string, WorkflowIssue[]> = {};
    for (const item of validation.value.issues) {
      if (!item.nodeId) continue;
      (map[item.nodeId] ??= []).push(item);
    }
    return map;
  });

  /* ------------------------------------------------------------- canvas init */

  /** Loads a workflow onto the canvas, or starts a blank draft. */
  function initCanvas(workflow?: Workflow | null): WorkflowDefinition {
    return store.setDefinition(workflow?.definition ?? null);
  }

  function clearCanvas(): void {
    store.clearDefinition();
  }

  /* -------------------------------------------------------------- node edits */

  function addNode(type: WorkflowNodeType, position?: NodePosition): WorkflowNode {
    return store.addNode(type, position);
  }

  /** Drop target for the palette: builds the node then hands it to the store. */
  function addNodeAt(type: WorkflowNodeType, position: NodePosition): WorkflowNode {
    const node = createNode(type, position);
    node.config = { ...defaultConfigFor(type), ...node.config };
    return store.addExistingNode(node);
  }

  function removeNode(nodeId: string): void {
    store.removeNode(nodeId);
  }

  function selectNode(nodeId: string | null): void {
    store.selectNode(nodeId);
  }

  function renameNode(nodeId: string, name: string): void {
    store.patchNode(nodeId, { name });
  }

  function updateNodeConfig(nodeId: string, patch: NodeConfig): void {
    store.patchConfig(nodeId, patch);
  }

  function updateNode(nodeId: string, patch: Partial<WorkflowNode>): void {
    store.patchNode(nodeId, patch);
  }

  /** Property panel helper: the field schema for a node type. */
  function fieldsForNode(node: Pick<WorkflowNode, 'type' | 'kind'> | null): NodeFieldDef[] {
    return node ? fieldsFor(node.type) : [];
  }

  function missingFor(node: Pick<WorkflowNode, 'type' | 'config'> | null): string[] {
    return node ? missingRequiredKeys(node) : [];
  }

  /* -------------------------------------------------------------- node moves */

  function moveNode(nodeId: string, position: NodePosition): void {
    store.moveNode(nodeId, position);
  }

  /** Vue Flow reports a batch after a multi-select drag. */
  function moveNodes(positions: Record<string, NodePosition>): void {
    store.moveNodes(positions);
  }

  /* -------------------------------------------------------------- edge edits */

  function connectNodes(source: string, target: string, branch?: ConditionBranch): ConnectResult {
    const resolved = resolveBranch(definition.value, source, branch);
    if (resolved === null) return { ok: false, problem: 'branch-full', edgeId: null };
    const problem = canConnect(definition.value, source, target, resolved ?? undefined);
    if (problem) return { ok: false, problem, edgeId: null };
    const next = store.connect(source, target, resolved ?? undefined);
    const edge = next.edges[next.edges.length - 1];
    return { ok: true, problem: null, edgeId: edge?.id ?? null };
  }

  function disconnectNodes(edgeId: string): void {
    store.disconnect(edgeId);
  }

  /* ------------------------------------------------------------------ layout */

  /** Re-runs the shared BFS layout so a messy canvas becomes readable. */
  function autoArrange(): WorkflowDefinition {
    return store.layoutWorking();
  }

  /** Pure preview used by the template library before anything is persisted. */
  function previewLayout(def: WorkflowDefinition): WorkflowDefinition {
    return autoLayout(def);
  }

  /* -------------------------------------------------------------- validation */

  function validateLocal(graph: WorkflowDefinition = definition.value): WorkflowValidation {
    validationLocal.value = validateDefinition(graph);
    return validationLocal.value;
  }

  /** Local rules first for instant feedback, then the server when available. */
  async function validateFlow(
    graph: WorkflowDefinition = definition.value
  ): Promise<WorkflowValidation> {
    validateLocal(graph);
    return store.validate(graph);
  }

  /* -------------------------------------------------------------------- save */

  /**
   * Persists the canvas. Validation runs first and a failing graph is never
   * published as active, which mirrors the server rule in demoWorkflow.
   */
  async function save(meta: {
    id?: string;
    name: string;
    description?: string;
    status?: WorkflowInput['status'];
  }): Promise<Workflow | null> {
    const result = validateLocal();
    if (meta.status === 'active' && !result.valid) return null;
    const payload: WorkflowInput = {
      name: meta.name,
      description: meta.description ?? '',
      definition: definition.value,
      status: meta.status ?? 'draft'
    };
    if (meta.id) return store.updateWorkflow(meta.id, payload);
    return store.createWorkflow(payload);
  }

  return {
    definition,
    selectedNode,
    selectedNodeId,
    dirty,
    saving,
    validation,
    validationLocal,
    nodeCount,
    edgeCount,
    triggerKind,
    triggerNode,
    graphSummary,
    issues,
    isValid,
    issueNodeIds,
    incompleteNodeIds,
    problemNodeIds,
    nodeIssues,
    canSave,
    initCanvas,
    clearCanvas,
    addNode,
    addNodeAt,
    removeNode,
    selectNode,
    renameNode,
    updateNodeConfig,
    updateNode,
    fieldsForNode,
    missingFor,
    moveNode,
    moveNodes,
    connectNodes,
    disconnectNodes,
    autoArrange,
    previewLayout,
    validateFlow,
    validateLocal,
    save
  };
}
