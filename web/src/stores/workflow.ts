/**
 * Workflow store (Sprint 12).
 *
 * Single source of truth for the workflow list, the working graph on the
 * builder canvas, the run monitor and the template library. Views and
 * composables never import api/workflow directly, so swapping the demo backend
 * for the real engine needs no UI change. Errors are stored as i18n keys.
 *
 * Graph mutations are deliberately thin: each one delegates to a pure function
 * in lib/workflowGraph and replaces the definition wholesale. That keeps the
 * canvas reactive (a new object identity per edit) and means the store can
 * never drift from the rules the validator and the tests assert on.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiErrorI18nKey } from '../api/http';
import * as workflowApi from '../api/workflow';
import {
  autoLayout,
  createNode,
  emptyDefinition,
  normalizeDefinition,
  triggerKindOf,
  validateDefinition,
  withConfigPatch,
  withEdge,
  withNode,
  withNodePatch,
  withoutEdge,
  withoutNode,
  withPositions
} from '../lib/workflowGraph';
import type { DefinitionSummary } from '../lib/workflowGraph';
import { defaultConfigFor } from '../lib/workflowNodes';
import { computeRunStats, emptyRunStats, nodeStateCounts } from '../lib/workflowRun';
import type {
  ConditionBranch,
  NodeConfig,
  NodePosition,
  NodeTypeDef,
  PagedWorkflowRuns,
  Workflow,
  WorkflowDefinition,
  WorkflowInput,
  WorkflowListParams,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowOverview,
  WorkflowRun,
  WorkflowRunListParams,
  WorkflowRunStats,
  WorkflowStatus,
  WorkflowTemplate,
  WorkflowValidation
} from '../types';

const EMPTY_OVERVIEW: WorkflowOverview = {
  activeWorkflows: 0,
  todayTriggers: 0,
  todaySucceeded: 0,
  todayFailed: 0
};

export const WORKFLOW_LIST_PAGE_SIZE = 20;
export const WORKFLOW_RUN_PAGE_SIZE = 20;

export const useWorkflowStore = defineStore('workflow', () => {
  /* ------------------------------------------------------------------ state */

  const overview = ref<WorkflowOverview>({ ...EMPTY_OVERVIEW });
  const workflows = ref<Workflow[]>([]);
  const total = ref(0);
  const hasMore = ref(false);
  const current = ref<Workflow | null>(null);
  const summary = ref<DefinitionSummary | null>(null);
  const runs = ref<WorkflowRun[]>([]);
  const runsTotal = ref(0);
  const runsHasMore = ref(false);
  const currentRun = ref<WorkflowRun | null>(null);
  const runStats = ref<WorkflowRunStats>(emptyRunStats());
  const templates = ref<WorkflowTemplate[]>([]);
  const nodeTypes = ref<NodeTypeDef[]>([]);
  const validation = ref<WorkflowValidation>({ valid: true, issues: [] });

  /** The graph being edited on the canvas; not yet the persisted one. */
  const definition = ref<WorkflowDefinition>(emptyDefinition());
  const selectedNodeId = ref<string | null>(null);
  const dirty = ref(false);

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  /* ---------------------------------------------------------------- getters */

  const activeWorkflows = computed(() => workflows.value.filter((item) => item.status === 'active'));
  const pausedWorkflows = computed(() => workflows.value.filter((item) => item.status === 'paused'));
  const draftWorkflows = computed(() => workflows.value.filter((item) => item.status === 'draft'));
  const hasDemoData = computed(() => workflows.value.some((item) => item.demo === true));
  const runsAreDemo = computed(() => runs.value.some((item) => item.demo === true));
  const selectedNode = computed<WorkflowNode | null>(
    () => definition.value.nodes.find((node) => node.id === selectedNodeId.value) ?? null
  );
  const triggerKind = computed(() => triggerKindOf(definition.value));
  const nodeCount = computed(() => definition.value.nodes.length);
  const edgeCount = computed(() => definition.value.edges.length);
  const hasRunningRuns = computed(() => runs.value.some((run) => run.status === 'running'));
  const issueNodeIds = computed(
    () => validation.value.issues.map((item) => item.nodeId).filter(Boolean) as string[]
  );
  const currentNodeStateCounts = computed(() =>
    currentRun.value ? nodeStateCounts(currentRun.value) : null
  );

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function resetError(): void {
    error.value = null;
  }

  /** Merges a freshly mutated row back into the list so counters stay honest. */
  function applyWorkflow(workflow: Workflow): void {
    const index = workflows.value.findIndex((item) => item.id === workflow.id);
    if (index >= 0) {
      const next = [...workflows.value];
      next[index] = workflow;
      workflows.value = next;
    }
    if (current.value?.id === workflow.id) current.value = workflow;
  }

  function removeWorkflow(workflowId: string): void {
    workflows.value = workflows.value.filter((item) => item.id !== workflowId);
    total.value = Math.max(0, total.value - 1);
    if (current.value?.id === workflowId) current.value = null;
  }

  /* --------------------------------------------------------------- overview */

  async function fetchOverview(): Promise<WorkflowOverview> {
    loading.value = true;
    resetError();
    try {
      overview.value = await workflowApi.getWorkflowOverview();
      return overview.value;
    } catch (err) {
      fail(err);
      return { ...EMPTY_OVERVIEW };
    } finally {
      loading.value = false;
    }
  }

  /* -------------------------------------------------------------- workflows */

  async function fetchWorkflows(params?: WorkflowListParams): Promise<Workflow[]> {
    loading.value = true;
    resetError();
    try {
      const page = await workflowApi.getWorkflows({ limit: WORKFLOW_LIST_PAGE_SIZE, ...params });
      if (params?.offset && params.offset > 0) {
        const known = new Set(workflows.value.map((item) => item.id));
        workflows.value = workflows.value.concat(
          page.workflows.filter((item) => !known.has(item.id))
        );
      } else {
        workflows.value = page.workflows;
      }
      total.value = page.total;
      hasMore.value = page.hasMore;
      return workflows.value;
    } catch (err) {
      fail(err);
      return workflows.value;
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreWorkflows(params?: WorkflowListParams): Promise<void> {
    if (!hasMore.value || loading.value) return;
    await fetchWorkflows({
      ...params,
      offset: workflows.value.length,
      limit: WORKFLOW_LIST_PAGE_SIZE
    });
  }

  async function fetchWorkflow(workflowId: string): Promise<Workflow | null> {
    loading.value = true;
    resetError();
    try {
      current.value = await workflowApi.getWorkflow(workflowId);
      applyWorkflow(current.value);
      return current.value;
    } catch (err) {
      fail(err);
      current.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSummary(workflowId: string): Promise<DefinitionSummary | null> {
    resetError();
    try {
      summary.value = await workflowApi.getWorkflowSummary(workflowId);
      return summary.value;
    } catch (err) {
      fail(err);
      summary.value = null;
      return null;
    }
  }

  async function createWorkflow(input: WorkflowInput): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      const created = await workflowApi.createWorkflow(input);
      workflows.value = [created, ...workflows.value];
      total.value += 1;
      current.value = created;
      return created;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function updateWorkflow(
    workflowId: string,
    patch: Partial<WorkflowInput>
  ): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      const updated = await workflowApi.updateWorkflow(workflowId, patch);
      applyWorkflow(updated);
      dirty.value = false;
      return updated;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteWorkflow(workflowId: string): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      await workflowApi.deleteWorkflow(workflowId);
      removeWorkflow(workflowId);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /** Enable/pause in one call so the list switch and the detail button agree. */
  async function setStatus(workflowId: string, status: WorkflowStatus): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      let updated: Workflow;
      if (status === 'active') updated = await workflowApi.enableWorkflow(workflowId);
      else if (status === 'paused') updated = await workflowApi.disableWorkflow(workflowId);
      else updated = await workflowApi.updateWorkflow(workflowId, { status });
      applyWorkflow(updated);
      return updated;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function duplicateWorkflow(workflowId: string): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      const copy = await workflowApi.duplicateWorkflow(workflowId);
      workflows.value = [copy, ...workflows.value];
      total.value += 1;
      return copy;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function layoutWorkflow(workflowId: string): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      const laid = await workflowApi.layoutWorkflow(workflowId);
      applyWorkflow(laid);
      return laid;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function validate(graph: WorkflowDefinition = definition.value): Promise<WorkflowValidation> {
    resetError();
    try {
      validation.value = await workflowApi.validateWorkflow(graph);
    } catch (err) {
      fail(err);
      /* Same rule set locally, so a failed call still highlights the nodes. */
      validation.value = validateDefinition(graph);
    }
    return validation.value;
  }

  /* ------------------------------------------------------------------- runs */

  async function readRunPage(params?: WorkflowRunListParams): Promise<PagedWorkflowRuns> {
    const limit = params?.limit ?? WORKFLOW_RUN_PAGE_SIZE;
    if (params?.workflowId) {
      return workflowApi.getWorkflowRuns(params.workflowId, { ...params, limit });
    }
    return workflowApi.getAllWorkflowRuns({ ...params, limit });
  }

  async function fetchRuns(params?: WorkflowRunListParams): Promise<WorkflowRun[]> {
    loading.value = true;
    resetError();
    try {
      const page = await readRunPage(params);
      if (params?.offset && params.offset > 0) {
        const known = new Set(runs.value.map((item) => item.id));
        runs.value = runs.value.concat(page.runs.filter((item) => !known.has(item.id)));
      } else {
        runs.value = page.runs;
      }
      runsTotal.value = page.total;
      runsHasMore.value = page.hasMore;
      return runs.value;
    } catch (err) {
      fail(err);
      return runs.value;
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreRuns(params?: WorkflowRunListParams): Promise<void> {
    if (!runsHasMore.value || loading.value) return;
    await fetchRuns({ ...params, offset: runs.value.length, limit: WORKFLOW_RUN_PAGE_SIZE });
  }

  function mergeRun(run: WorkflowRun): void {
    currentRun.value = run;
    const index = runs.value.findIndex((item) => item.id === run.id);
    if (index >= 0) {
      const next = [...runs.value];
      next[index] = run;
      runs.value = next;
    }
  }

  async function fetchRun(runId: string): Promise<WorkflowRun | null> {
    loading.value = true;
    resetError();
    try {
      const run = await workflowApi.getWorkflowRunDetail(runId);
      mergeRun(run);
      return run;
    } catch (err) {
      fail(err);
      currentRun.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  /** Silent refresh for the poller: never flips the page level loading flag. */
  async function pollRun(runId: string): Promise<WorkflowRun | null> {
    try {
      const run = await workflowApi.getWorkflowRunDetail(runId);
      mergeRun(run);
      return run;
    } catch {
      /* A dropped poll must not kill the monitor; the next tick retries. */
      return currentRun.value;
    }
  }

  async function pollRuns(params?: WorkflowRunListParams): Promise<WorkflowRun[]> {
    try {
      const page = await readRunPage(params);
      runs.value = page.runs;
      runsTotal.value = page.total;
      runsHasMore.value = page.hasMore;
      return runs.value;
    } catch {
      return runs.value;
    }
  }

  async function stopRun(runId: string): Promise<WorkflowRun | null> {
    saving.value = true;
    resetError();
    try {
      const run = await workflowApi.stopWorkflowRun(runId);
      mergeRun(run);
      return run;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function triggerRun(workflowId: string): Promise<WorkflowRun | null> {
    saving.value = true;
    resetError();
    try {
      const run = await workflowApi.triggerWorkflowRun(workflowId);
      runs.value = [run, ...runs.value];
      runsTotal.value += 1;
      currentRun.value = run;
      return run;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function fetchRunStats(params?: WorkflowRunListParams): Promise<WorkflowRunStats> {
    resetError();
    try {
      runStats.value = await workflowApi.getWorkflowRunStats(params);
      return runStats.value;
    } catch (err) {
      fail(err);
      runStats.value = computeRunStats(runs.value);
      return runStats.value;
    }
  }

  /* -------------------------------------------------------------- templates */

  async function fetchTemplates(): Promise<WorkflowTemplate[]> {
    loading.value = true;
    resetError();
    try {
      templates.value = await workflowApi.getWorkflowTemplates();
      return templates.value;
    } catch (err) {
      fail(err);
      return templates.value;
    } finally {
      loading.value = false;
    }
  }

  async function createFromTemplate(templateId: string, name: string): Promise<Workflow | null> {
    saving.value = true;
    resetError();
    try {
      const created = await workflowApi.createWorkflowFromTemplate(templateId, name);
      workflows.value = [created, ...workflows.value];
      total.value += 1;
      current.value = created;
      const used = templates.value.findIndex((item) => item.id === templateId);
      if (used >= 0) {
        const next = [...templates.value];
        next[used] = { ...next[used], useCount: next[used].useCount + 1 };
        templates.value = next;
      }
      return created;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /* ---------------------------------------------------------------- catalog */

  async function fetchNodeTypes(): Promise<NodeTypeDef[]> {
    resetError();
    try {
      nodeTypes.value = await workflowApi.getNodeTypes();
      return nodeTypes.value;
    } catch (err) {
      fail(err);
      return nodeTypes.value;
    }
  }

  /* ------------------------------------------------------------ graph edits */

  /** Loads a graph onto the canvas and clears the dirty flag. */
  function setDefinition(next?: Partial<WorkflowDefinition> | null): WorkflowDefinition {
    definition.value = normalizeDefinition(next);
    selectedNodeId.value = null;
    dirty.value = false;
    validation.value = { valid: true, issues: [] };
    return definition.value;
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId;
  }

  function addNode(type: WorkflowNodeType, position?: NodePosition): WorkflowNode {
    const node = createNode(type, position);
    node.config = { ...defaultConfigFor(type), ...node.config };
    definition.value = withNode(definition.value, node);
    selectedNodeId.value = node.id;
    dirty.value = true;
    return node;
  }

  function addExistingNode(node: WorkflowNode): WorkflowNode {
    definition.value = withNode(definition.value, node);
    selectedNodeId.value = node.id;
    dirty.value = true;
    return node;
  }

  function removeNode(nodeId: string): void {
    definition.value = withoutNode(definition.value, nodeId);
    if (selectedNodeId.value === nodeId) selectedNodeId.value = null;
    dirty.value = true;
  }

  function patchNode(nodeId: string, patch: Partial<WorkflowNode>): WorkflowDefinition {
    definition.value = withNodePatch(definition.value, nodeId, patch);
    dirty.value = true;
    return definition.value;
  }

  function patchConfig(nodeId: string, patch: NodeConfig): WorkflowDefinition {
    definition.value = withConfigPatch(definition.value, nodeId, patch);
    dirty.value = true;
    return definition.value;
  }

  function moveNode(nodeId: string, position: NodePosition): WorkflowDefinition {
    definition.value = withPositions(definition.value, { [nodeId]: position });
    dirty.value = true;
    return definition.value;
  }

  function moveNodes(positions: Record<string, NodePosition>): WorkflowDefinition {
    definition.value = withPositions(definition.value, positions);
    dirty.value = true;
    return definition.value;
  }

  function connect(source: string, target: string, branch?: ConditionBranch): WorkflowDefinition {
    definition.value = withEdge(definition.value, source, target, branch);
    dirty.value = true;
    return definition.value;
  }

  function disconnect(edgeId: string): WorkflowDefinition {
    definition.value = withoutEdge(definition.value, edgeId);
    dirty.value = true;
    return definition.value;
  }

  function layoutWorking(): WorkflowDefinition {
    definition.value = autoLayout(definition.value);
    dirty.value = true;
    return definition.value;
  }

  function clearDefinition(): void {
    setDefinition(null);
  }

  function markClean(): void {
    dirty.value = false;
  }

  function markDirty(): void {
    dirty.value = true;
  }

  /* ------------------------------------------------------------------ reset */

  function $reset(): void {
    overview.value = { ...EMPTY_OVERVIEW };
    workflows.value = [];
    total.value = 0;
    hasMore.value = false;
    current.value = null;
    summary.value = null;
    runs.value = [];
    runsTotal.value = 0;
    runsHasMore.value = false;
    currentRun.value = null;
    runStats.value = emptyRunStats();
    templates.value = [];
    nodeTypes.value = [];
    validation.value = { valid: true, issues: [] };
    definition.value = emptyDefinition();
    selectedNodeId.value = null;
    dirty.value = false;
    loading.value = false;
    saving.value = false;
    error.value = null;
  }

  return {
    overview,
    workflows,
    total,
    hasMore,
    current,
    summary,
    runs,
    runsTotal,
    runsHasMore,
    currentRun,
    runStats,
    templates,
    nodeTypes,
    validation,
    definition,
    selectedNodeId,
    dirty,
    loading,
    saving,
    error,
    activeWorkflows,
    pausedWorkflows,
    draftWorkflows,
    hasDemoData,
    runsAreDemo,
    selectedNode,
    triggerKind,
    nodeCount,
    edgeCount,
    hasRunningRuns,
    issueNodeIds,
    currentNodeStateCounts,
    resetError,
    applyWorkflow,
    removeWorkflow,
    fetchOverview,
    fetchWorkflows,
    loadMoreWorkflows,
    fetchWorkflow,
    fetchSummary,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    setStatus,
    duplicateWorkflow,
    layoutWorkflow,
    validate,
    fetchRuns,
    loadMoreRuns,
    fetchRun,
    pollRun,
    pollRuns,
    stopRun,
    triggerRun,
    fetchRunStats,
    fetchTemplates,
    createFromTemplate,
    fetchNodeTypes,
    setDefinition,
    selectNode,
    addNode,
    addExistingNode,
    removeNode,
    patchNode,
    patchConfig,
    moveNode,
    moveNodes,
    connect,
    disconnect,
    layoutWorking,
    clearDefinition,
    markClean,
    markDirty,
    $reset
  };
});
