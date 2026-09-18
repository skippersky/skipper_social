/**
 * Workflow list, filtering and lifecycle actions (Sprint 12).
 *
 * The list page stays declarative: this composable owns the search text, the
 * status filter and the paging offset, and every mutation goes through the
 * workflow store so the demo/real api switch keeps working unchanged.
 */
import { computed, ref } from 'vue';
import { useWorkflowStore, WORKFLOW_LIST_PAGE_SIZE } from '../stores/workflow';
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowInput,
  WorkflowListParams,
  WorkflowOverview,
  WorkflowStatus
} from '../types';

export type WorkflowStatusFilter = WorkflowStatus | 'all';

export const WORKFLOW_STATUS_FILTERS: WorkflowStatusFilter[] = ['all', 'active', 'paused', 'draft'];

export function useWorkflow() {
  const store = useWorkflowStore();

  const query = ref('');
  const statusFilter = ref<WorkflowStatusFilter>('all');

  const workflows = computed(() => store.workflows);
  const total = computed(() => store.total);
  const hasMore = computed(() => store.hasMore);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const overview = computed<WorkflowOverview>(() => store.overview);
  const detail = computed(() => store.current);
  const summary = computed(() => store.summary);
  const activeWorkflows = computed(() => store.activeWorkflows);
  const pausedWorkflows = computed(() => store.pausedWorkflows);
  const draftWorkflows = computed(() => store.draftWorkflows);
  const hasDemoData = computed(() => store.hasDemoData);

  function listParams(offset = 0): WorkflowListParams {
    const params: WorkflowListParams = { limit: WORKFLOW_LIST_PAGE_SIZE, offset };
    const text = query.value.trim();
    if (text) params.query = text;
    if (statusFilter.value !== 'all') params.status = statusFilter.value;
    return params;
  }

  async function loadOverview(): Promise<WorkflowOverview> {
    return store.fetchOverview();
  }

  async function loadWorkflows(): Promise<Workflow[]> {
    return store.fetchWorkflows(listParams(0));
  }

  /** Alias kept because the spec names the entry point refresh(). */
  const refresh = loadWorkflows;

  async function search(text: string): Promise<Workflow[]> {
    query.value = text;
    return loadWorkflows();
  }

  async function filterStatus(next: WorkflowStatusFilter): Promise<Workflow[]> {
    statusFilter.value = next;
    return loadWorkflows();
  }

  async function loadMore(): Promise<void> {
    await store.loadMoreWorkflows(listParams(workflows.value.length));
  }

  /** Detail page entry: the workflow row plus its graph summary. */
  async function open(workflowId: string): Promise<Workflow | null> {
    const workflow = await store.fetchWorkflow(workflowId);
    if (workflow) await store.fetchSummary(workflowId);
    return workflow;
  }

  async function createWorkflow(input: WorkflowInput): Promise<Workflow | null> {
    return store.createWorkflow(input);
  }

  async function updateWorkflow(
    workflowId: string,
    patch: Partial<WorkflowInput>
  ): Promise<Workflow | null> {
    return store.updateWorkflow(workflowId, patch);
  }

  async function deleteWorkflow(workflowId: string): Promise<boolean> {
    return store.deleteWorkflow(workflowId);
  }

  async function enableWorkflow(workflowId: string): Promise<Workflow | null> {
    return store.setStatus(workflowId, 'active');
  }

  async function disableWorkflow(workflowId: string): Promise<Workflow | null> {
    return store.setStatus(workflowId, 'paused');
  }

  /** One entry point for the list switch: flip to the opposite live status. */
  async function toggleStatus(workflow: Workflow): Promise<Workflow | null> {
    return store.setStatus(workflow.id, workflow.status === 'active' ? 'paused' : 'active');
  }

  async function duplicateWorkflow(workflowId: string): Promise<Workflow | null> {
    return store.duplicateWorkflow(workflowId);
  }

  async function autoLayout(workflowId: string): Promise<Workflow | null> {
    return store.layoutWorkflow(workflowId);
  }

  /** Loads an existing graph onto the builder canvas. */
  function editDefinition(definition?: Partial<WorkflowDefinition> | null): WorkflowDefinition {
    return store.setDefinition(definition);
  }

  return {
    workflows,
    total,
    hasMore,
    loading,
    saving,
    error,
    overview,
    detail,
    summary,
    activeWorkflows,
    pausedWorkflows,
    draftWorkflows,
    hasDemoData,
    query,
    statusFilter,
    listParams,
    loadOverview,
    loadWorkflows,
    refresh,
    search,
    filterStatus,
    loadMore,
    open,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    enableWorkflow,
    disableWorkflow,
    toggleStatus,
    duplicateWorkflow,
    autoLayout,
    editDefinition
  };
}
