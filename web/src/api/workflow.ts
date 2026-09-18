/**
 * Automation workflow endpoints (Sprint 12).
 *
 * Same contract as every other api module: try the real backend first and fall
 * back to api/demoWorkflow when the endpoint is missing, so the builder, the
 * monitor and the template library all stay usable offline. Nothing here knows
 * how a graph is validated or laid out; that lives in lib/workflowGraph, and
 * both the server path and the demo path return the same shapes.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './http';
import { isMissingBackend } from './demo';
import {
  demoCreateFromTemplate,
  demoCreateWorkflow,
  demoDeleteWorkflow,
  demoDuplicateWorkflow,
  demoLayoutWorkflow,
  demoNodeTypes,
  demoRunById,
  demoRunStats,
  demoSetWorkflowStatus,
  demoStopRun,
  demoTriggerRun,
  demoUpdateWorkflow,
  demoUseWorkflowTemplate,
  demoValidateWorkflow,
  demoWorkflowById,
  demoWorkflowOverview,
  demoWorkflowRuns,
  demoWorkflowSummary,
  demoWorkflowTemplates,
  demoWorkflows
} from './demoWorkflow';
import type { DefinitionSummary } from '../lib/workflowGraph';
import type {
  NodeTypeDef,
  PagedWorkflowRuns,
  PagedWorkflows,
  Workflow,
  WorkflowDefinition,
  WorkflowInput,
  WorkflowListParams,
  WorkflowNodeKind,
  WorkflowOverview,
  WorkflowRun,
  WorkflowRunListParams,
  WorkflowRunStats,
  WorkflowTemplate,
  WorkflowValidation
} from '../types';

const WORKFLOWS = '/api/v1/workflows';
const RUNS = '/api/v1/workflow-runs';
const TEMPLATES = '/api/v1/workflow-templates';
const CATALOG = '/api/v1/workflow';

/** Page size for the workflow list; the runs list uses the same step. */
export const WORKFLOW_PAGE_SIZE = 20;
export const RUN_PAGE_SIZE = 20;

function id(value: string): string {
  return encodeURIComponent(value);
}

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? '?' + text : '';
}

/* ---------------------------------------------------------------- workflows */

export async function getWorkflows(params?: WorkflowListParams): Promise<PagedWorkflows> {
  try {
    return await apiGet<PagedWorkflows>(
      WORKFLOWS +
        toQuery({
          query: params?.query,
          status: params?.status,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflows(params);
  }
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
  try {
    return await apiGet<Workflow>(WORKFLOWS + '/' + id(workflowId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowById(workflowId);
  }
}

export async function createWorkflow(input: WorkflowInput): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(WORKFLOWS, input);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateWorkflow(input);
  }
}

export async function updateWorkflow(
  workflowId: string,
  patch: Partial<WorkflowInput>
): Promise<Workflow> {
  try {
    return await apiPut<Workflow>(WORKFLOWS + '/' + id(workflowId), patch);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateWorkflow(workflowId, patch);
  }
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  try {
    await apiDelete<void>(WORKFLOWS + '/' + id(workflowId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDeleteWorkflow(workflowId);
  }
}

export async function enableWorkflow(workflowId: string): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(WORKFLOWS + '/' + id(workflowId) + '/enable', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSetWorkflowStatus(workflowId, 'active');
  }
}

export async function disableWorkflow(workflowId: string): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(WORKFLOWS + '/' + id(workflowId) + '/disable', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSetWorkflowStatus(workflowId, 'paused');
  }
}

/** Copies a workflow into a new draft; the server keeps the graph untouched. */
export async function duplicateWorkflow(workflowId: string): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(WORKFLOWS + '/' + id(workflowId) + '/duplicate', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoDuplicateWorkflow(workflowId);
  }
}

/** Server-side auto layout, so the canvas and the API agree on coordinates. */
export async function layoutWorkflow(workflowId: string): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(WORKFLOWS + '/' + id(workflowId) + '/layout', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoLayoutWorkflow(workflowId);
  }
}

/** Counts used by the detail header without shipping the whole graph again. */
export async function getWorkflowSummary(workflowId: string): Promise<DefinitionSummary> {
  try {
    return await apiGet<DefinitionSummary>(WORKFLOWS + '/' + id(workflowId) + '/summary');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowSummary(workflowId);
  }
}

export async function validateWorkflow(definition: WorkflowDefinition): Promise<WorkflowValidation> {
  try {
    return await apiPost<WorkflowValidation>(WORKFLOWS + '/validate', { definition });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoValidateWorkflow(definition);
  }
}

export async function getWorkflowOverview(): Promise<WorkflowOverview> {
  try {
    return await apiGet<WorkflowOverview>(WORKFLOWS + '/overview');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowOverview();
  }
}

/* --------------------------------------------------------------------- runs */

export async function getWorkflowRuns(
  workflowId: string,
  params?: WorkflowRunListParams
): Promise<PagedWorkflowRuns> {
  try {
    return await apiGet<PagedWorkflowRuns>(
      WORKFLOWS +
        '/' +
        id(workflowId) +
        '/runs' +
        toQuery({
          status: params?.status,
          from: params?.from,
          to: params?.to,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowRuns({ ...params, workflowId });
  }
}

/** Cross-workflow run feed used by the monitor page when no id is selected. */
export async function getAllWorkflowRuns(params?: WorkflowRunListParams): Promise<PagedWorkflowRuns> {
  try {
    return await apiGet<PagedWorkflowRuns>(
      RUNS +
        toQuery({
          workflowId: params?.workflowId,
          status: params?.status,
          from: params?.from,
          to: params?.to,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowRuns(params);
  }
}

export async function getWorkflowRunDetail(runId: string): Promise<WorkflowRun> {
  try {
    return await apiGet<WorkflowRun>(RUNS + '/' + id(runId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRunById(runId);
  }
}

export async function stopWorkflowRun(runId: string): Promise<WorkflowRun> {
  try {
    return await apiPost<WorkflowRun>(RUNS + '/' + id(runId) + '/stop', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoStopRun(runId);
  }
}

/** Manual test run: the engine starts an instance with synthetic trigger data. */
export async function triggerWorkflowRun(workflowId: string): Promise<WorkflowRun> {
  try {
    return await apiPost<WorkflowRun>(WORKFLOWS + '/' + id(workflowId) + '/runs', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoTriggerRun(workflowId);
  }
}

export async function getWorkflowRunStats(params?: WorkflowRunListParams): Promise<WorkflowRunStats> {
  try {
    return await apiGet<WorkflowRunStats>(
      RUNS +
        '/stats' +
        toQuery({
          workflowId: params?.workflowId,
          status: params?.status,
          from: params?.from,
          to: params?.to
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRunStats(params);
  }
}

/* ---------------------------------------------------------------- templates */

export async function getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  try {
    return await apiGet<WorkflowTemplate[]>(TEMPLATES);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWorkflowTemplates();
  }
}

/** Records a template use so the library can sort by popularity. */
export async function useWorkflowTemplate(templateId: string): Promise<WorkflowTemplate> {
  try {
    return await apiPost<WorkflowTemplate>(TEMPLATES + '/' + id(templateId) + '/use', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUseWorkflowTemplate(templateId);
  }
}

/**
 * Instantiates a preset into a new draft. The caller passes an already
 * translated name so i18n never leaks into the API layer.
 */
export async function createWorkflowFromTemplate(
  templateId: string,
  name: string
): Promise<Workflow> {
  try {
    return await apiPost<Workflow>(TEMPLATES + '/' + id(templateId) + '/instantiate', { name });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateFromTemplate(templateId, name);
  }
}

/* ------------------------------------------------------------------ catalog */

/** Full node palette, or one kind when the property panel asks for a subset. */
export async function getNodeTypes(kind?: WorkflowNodeKind): Promise<NodeTypeDef[]> {
  try {
    return await apiGet<NodeTypeDef[]>(CATALOG + '/nodes' + toQuery({ kind }));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNodeTypes(kind);
  }
}

export async function getTriggers(): Promise<NodeTypeDef[]> {
  try {
    return await apiGet<NodeTypeDef[]>(CATALOG + '/triggers');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNodeTypes('trigger');
  }
}

export async function getConditions(): Promise<NodeTypeDef[]> {
  try {
    return await apiGet<NodeTypeDef[]>(CATALOG + '/conditions');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNodeTypes('condition');
  }
}

export async function getActions(): Promise<NodeTypeDef[]> {
  try {
    return await apiGet<NodeTypeDef[]>(CATALOG + '/actions');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoNodeTypes('action');
  }
}
