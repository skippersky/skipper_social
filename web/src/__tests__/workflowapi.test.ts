/**
 * Sprint 12 API layer tests for the automation workflow module.
 *
 * Every endpoint follows the house contract: try the real backend, and only
 * when the backend is provably absent (network failure, timeout, 404) fall back
 * to api/demoWorkflow so the builder and the monitor keep working offline. A
 * hard 5xx must surface instead of being disguised as demo data. These tests
 * pin the URL each call builds, the demo fallback, and the error passthrough.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as workflowApi from '../api/workflow';
import { ApiError } from '../api/http';
import {
  demoNodeTypes,
  demoResetWorkflows,
  demoRunStats,
  demoWorkflowById,
  demoWorkflowOverview,
  demoWorkflowRuns,
  demoWorkflowSummary,
  demoWorkflows,
  readRuns,
  readWorkflows
} from '../api/demoWorkflow';
import { summarizeDefinition, validateDefinition } from '../lib/workflowGraph';
import { WORKFLOW_TEMPLATES } from '../lib/workflowTemplates';
import { NODE_TYPES, nodesByKind } from '../lib/workflowNodes';
import type { WorkflowDefinition, WorkflowInput } from '../types';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({
        success: ok,
        code: ok ? 'OK' : 'HTTP_' + status,
        message: 'server said no',
        data
      })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

function missingBackend() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));
}

function serverError(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

function serve(data: unknown, ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(data, ok, status));
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** URL of the nth request the fetch mock saw. */
function urlOf(mock: ReturnType<typeof serve>, call = 0): string {
  return String(mock.mock.calls[call][0]);
}

const SEED_IDS = [
  'wf-welcome',
  'wf-winback',
  'wf-autoreply',
  'wf-vip-restock',
  'wf-birthday',
  'wf-followup'
];

beforeEach(() => {
  localStorage.clear();
  demoResetWorkflows();
});

afterEach(() => {
  vi.unstubAllGlobals();
  demoResetWorkflows();
  localStorage.clear();
});

describe('workflow api list and detail', () => {
  it('serialises every list filter into the query string', async () => {
    const mock = serve({ workflows: [], hasMore: false, total: 0 });
    await workflowApi.getWorkflows({ query: 'vip', status: 'active', limit: 5, offset: 10 });
    expect(urlOf(mock)).toBe('/api/v1/workflows?query=vip&status=active&limit=5&offset=10');
  });

  it('drops empty filters instead of sending blank parameters', async () => {
    const mock = serve({ workflows: [], hasMore: false, total: 0 });
    await workflowApi.getWorkflows({ query: '', status: undefined });
    expect(urlOf(mock)).toBe('/api/v1/workflows');
  });

  it('returns the backend page untouched when the server answers', async () => {
    const page = { workflows: [{ id: 'wf-9' }], hasMore: true, total: 41 };
    serve(page);
    await expect(workflowApi.getWorkflows()).resolves.toEqual(page);
  });

  it('falls back to the seeded demo list offline and flags demo mode', async () => {
    offline();
    const page = await workflowApi.getWorkflows();
    expect(page.total).toBe(SEED_IDS.length);
    expect(page.workflows.map((item) => item.id).sort()).toEqual([...SEED_IDS].sort());
    expect(page.hasMore).toBe(false);
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
    expect(page).toMatchObject(demoWorkflows());
  });

  it('treats a 404 from the backend the same as no backend at all', async () => {
    missingBackend();
    const page = await workflowApi.getWorkflows({ status: 'draft' });
    expect(page.workflows.every((item) => item.status === 'draft')).toBe(true);
    expect(page.total).toBe(1);
  });

  it('pages the demo list with the same limit and offset semantics', async () => {
    offline();
    const first = await workflowApi.getWorkflows({ limit: 4, offset: 0 });
    const rest = await workflowApi.getWorkflows({ limit: 4, offset: 4 });
    const whole = await workflowApi.getWorkflows();
    expect(first.workflows).toHaveLength(4);
    expect(first.hasMore).toBe(true);
    expect(rest.workflows).toHaveLength(SEED_IDS.length - 4);
    expect(rest.hasMore).toBe(false);
    expect(
      first.workflows.map((item) => item.id).concat(rest.workflows.map((item) => item.id))
    ).toEqual(whole.workflows.map((item) => item.id));
  });

  it('filters the demo list by free text', async () => {
    offline();
    const found = await workflowApi.getWorkflows({ query: 'restock' });
    expect(found.total).toBe(1);
    expect(found.workflows[0].id).toBe('wf-vip-restock');
    expect((await workflowApi.getWorkflows({ query: 'zzz' })).total).toBe(0);
  });

  it('surfaces a hard server failure rather than pretending to be offline', async () => {
    serverError(503);
    await expect(workflowApi.getWorkflows()).rejects.toThrow(ApiError);
    await expect(workflowApi.getWorkflows()).rejects.toMatchObject({ code: 'HTTP_503' });
    expect(localStorage.getItem('ks-demo-mode')).toBeNull();
  });

  it('fetches one workflow by id from the server and from the demo store', async () => {
    const mock = serve({ id: 'wf-welcome' });
    await expect(workflowApi.getWorkflow('wf-welcome')).resolves.toEqual({ id: 'wf-welcome' });
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome');

    offline();
    const demo = await workflowApi.getWorkflow('wf-winback');
    expect(demo).toMatchObject(demoWorkflowById('wf-winback'));
    expect(demo.status).toBe('active');
  });

  it('encodes the workflow id so a slash cannot escape the path', async () => {
    const mock = serve({ id: 'a/b' });
    await workflowApi.getWorkflow('a/b');
    expect(urlOf(mock)).toBe('/api/v1/workflows/a%2Fb');
  });

  it('rejects an unknown workflow id with NOT_FOUND', async () => {
    offline();
    await expect(workflowApi.getWorkflow('wf-nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the seeded counters in sync with the stored run history', async () => {
    offline();
    const workflow = await workflowApi.getWorkflow('wf-welcome');
    const own = readRuns().filter((run) => run.workflowId === 'wf-welcome');
    expect(workflow.lastRunAt).toBe(Math.max(...own.map((run) => run.startedAt)));
    expect(workflow.nodeCount).toBe(workflow.definition.nodes.length);
    expect(readWorkflows().map((item) => item.id)).toContain('wf-welcome');
  });
});

describe('workflow api mutations', () => {
  const BROKEN: WorkflowDefinition = { nodes: [], edges: [] };

  function validInput(patch: Partial<WorkflowInput> = {}): WorkflowInput {
    return {
      name: '  Restock nudge  ',
      description: ' ping the team ',
      definition: demoWorkflowById('wf-welcome').definition,
      status: 'draft',
      ...patch
    };
  }

  it('posts a new workflow and trims the name on the demo path', async () => {
    const mock = serve({ id: 'wf-new' });
    await expect(workflowApi.createWorkflow(validInput())).resolves.toEqual({ id: 'wf-new' });
    expect(urlOf(mock)).toBe('/api/v1/workflows');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

    offline();
    const created = await workflowApi.createWorkflow(validInput());
    expect(created.name).toBe('Restock nudge');
    expect(created.description).toBe('ping the team');
    expect(created.status).toBe('draft');
    expect(created.demo).toBe(true);
    expect(created.id.startsWith('wf-')).toBe(true);
    expect((await workflowApi.getWorkflows()).total).toBe(SEED_IDS.length + 1);
  });

  it('refuses to activate a graph that fails validation', async () => {
    offline();
    await expect(
      workflowApi.createWorkflow(validInput({ definition: BROKEN, status: 'active' }))
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(workflowApi.createWorkflow(validInput({ definition: BROKEN }))).resolves.toBeTruthy();
  });

  it('lets a valid graph go active straight away', async () => {
    offline();
    const created = await workflowApi.createWorkflow(validInput({ status: 'active' }));
    expect(created.status).toBe('active');
    expect(created.nodeCount).toBe(created.definition.nodes.length);
    expect(created.triggerKind).toBe(created.definition.nodes[0].type);
  });

  it('updates through PUT and keeps the created timestamp on the demo path', async () => {
    const mock = serve({ id: 'wf-welcome', name: 'renamed' });
    await workflowApi.updateWorkflow('wf-welcome', { name: 'renamed' });
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'PUT' });

    offline();
    const before = demoWorkflowById('wf-welcome');
    const after = await workflowApi.updateWorkflow('wf-welcome', { name: 'Karibu flow' });
    expect(after.name).toBe('Karibu flow');
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    await expect(workflowApi.updateWorkflow('wf-nope', { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('blocks an update that would activate a broken graph', async () => {
    offline();
    await expect(
      workflowApi.updateWorkflow('wf-welcome', { definition: BROKEN, status: 'active' })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(demoWorkflowById('wf-welcome').status).toBe('active');
  });

  it('deletes a workflow and its runs, and 404s on a second delete', async () => {
    const mock = serve(null);
    await workflowApi.deleteWorkflow('wf-birthday');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-birthday');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });

    offline();
    expect(readRuns().filter((run) => run.workflowId === 'wf-birthday').length).toBeGreaterThan(0);
    await workflowApi.deleteWorkflow('wf-birthday');
    expect(readRuns().filter((run) => run.workflowId === 'wf-birthday')).toEqual([]);
    expect(readWorkflows().some((item) => item.id === 'wf-birthday')).toBe(false);
    await expect(workflowApi.deleteWorkflow('wf-birthday')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('enables and disables through the status endpoints', async () => {
    const mock = serve({ id: 'wf-birthday', status: 'active' });
    await workflowApi.enableWorkflow('wf-birthday');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-birthday/enable');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

    offline();
    expect((await workflowApi.enableWorkflow('wf-birthday')).status).toBe('active');
    expect((await workflowApi.disableWorkflow('wf-birthday')).status).toBe('paused');
  });

  it('duplicates into a fresh draft with the same graph', async () => {
    const mock = serve({ id: 'wf-copy' });
    await workflowApi.duplicateWorkflow('wf-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome/duplicate');

    offline();
    const source = demoWorkflowById('wf-welcome');
    const copy = await workflowApi.duplicateWorkflow('wf-welcome');
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe(source.name + ' (copy)');
    expect(copy.status).toBe('draft');
    expect(copy.definition.nodes.map((node) => node.id)).toEqual(
      source.definition.nodes.map((node) => node.id)
    );
  });

  it('relayouts the canvas through the server or locally', async () => {
    const mock = serve({ id: 'wf-welcome' });
    await workflowApi.layoutWorkflow('wf-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome/layout');

    offline();
    const laid = await workflowApi.layoutWorkflow('wf-welcome');
    expect(laid.definition.nodes[0].position.x).toBe(40);
    expect(new Set(laid.definition.nodes.map((node) => node.position.x)).size).toBeGreaterThan(1);
  });

  it('reads the summary counters without shipping the graph again', async () => {
    const mock = serve({ nodes: 3 });
    await workflowApi.getWorkflowSummary('wf-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome/summary');

    offline();
    const summary = await workflowApi.getWorkflowSummary('wf-welcome');
    expect(summary).toEqual(demoWorkflowSummary('wf-welcome'));
    expect(summary).toEqual(summarizeDefinition(demoWorkflowById('wf-welcome').definition));
    expect(summary.nodes).toBe(summary.triggers + summary.conditions + summary.actions);
  });

  it('validates a definition on the server or with the local engine', async () => {
    const definition = demoWorkflowById('wf-welcome').definition;
    const mock = serve({ valid: true, issues: [] });
    await workflowApi.validateWorkflow(definition);
    expect(urlOf(mock)).toBe('/api/v1/workflows/validate');
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toEqual({ definition });

    offline();
    await expect(workflowApi.validateWorkflow(definition)).resolves.toEqual(
      validateDefinition(definition)
    );
    const broken = await workflowApi.validateWorkflow(BROKEN);
    expect(broken.valid).toBe(false);
    expect(broken.issues.map((item) => item.code)).toContain('EMPTY');
    expect(broken.issues[0].messageKey).toBe('workflow.issue.EMPTY');
  });

  it('aggregates the overview counters for the list page header', async () => {
    const mock = serve({ activeWorkflows: 1 });
    await workflowApi.getWorkflowOverview();
    expect(urlOf(mock)).toBe('/api/v1/workflows/overview');

    offline();
    const overview = await workflowApi.getWorkflowOverview();
    expect(overview).toEqual(demoWorkflowOverview());
    expect(overview.activeWorkflows).toBe(4);
    expect(overview.todayTriggers).toBeGreaterThan(0);
    expect(overview.todaySucceeded + overview.todayFailed).toBeLessThanOrEqual(
      overview.todayTriggers
    );
  });
});

describe('workflow api runs', () => {
  it('builds the per-workflow run URL with its filters', async () => {
    const mock = serve({ runs: [], hasMore: false, total: 0 });
    await workflowApi.getWorkflowRuns('wf-welcome', {
      status: 'failed',
      from: 1,
      to: 2,
      limit: 3,
      offset: 4
    });
    expect(urlOf(mock)).toBe(
      '/api/v1/workflows/wf-welcome/runs?status=failed&from=1&to=2&limit=3&offset=4'
    );
  });

  it('builds the cross-workflow run feed URL', async () => {
    const mock = serve({ runs: [], hasMore: false, total: 0 });
    await workflowApi.getAllWorkflowRuns({ workflowId: 'wf-winback', status: 'running' });
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs?workflowId=wf-winback&status=running');
  });

  it('scopes the demo run feed to one workflow and filters by status', async () => {
    offline();
    const page = await workflowApi.getWorkflowRuns('wf-welcome');
    expect(page.runs.length).toBeGreaterThan(0);
    expect(page.runs.every((run) => run.workflowId === 'wf-welcome')).toBe(true);
    expect(page).toMatchObject(demoWorkflowRuns({ workflowId: 'wf-welcome' }));
    expect(page.runs.map((run) => run.startedAt)).toEqual(
      [...page.runs.map((run) => run.startedAt)].sort((left, right) => right - left)
    );

    const failed = await workflowApi.getWorkflowRuns('wf-welcome', { status: 'failed' });
    expect(failed.runs.every((run) => run.status === 'failed')).toBe(true);
    expect(failed.total).toBeLessThanOrEqual(page.total);
  });

  it('filters runs by the from and to window', async () => {
    offline();
    const all = await workflowApi.getAllWorkflowRuns();
    const newest = all.runs[0].startedAt;
    const slice = await workflowApi.getAllWorkflowRuns({ from: newest - 1, to: newest });
    expect(slice.total).toBeGreaterThan(0);
    expect(
      slice.runs.every((run) => run.startedAt >= newest - 1 && run.startedAt <= newest)
    ).toBe(true);
    expect(slice.total).toBeLessThanOrEqual(all.total);
  });

  it('pages runs and reports hasMore against the same page size', async () => {
    offline();
    expect(workflowApi.RUN_PAGE_SIZE).toBe(20);
    expect(workflowApi.WORKFLOW_PAGE_SIZE).toBe(20);
    const first = await workflowApi.getAllWorkflowRuns({ limit: 5, offset: 0 });
    const second = await workflowApi.getAllWorkflowRuns({ limit: 5, offset: 5 });
    expect(first.runs).toHaveLength(5);
    expect(second.runs).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.runs.map((run) => run.id)).not.toEqual(second.runs.map((run) => run.id));
  });

  it('reads one run detail and rejects an unknown run id', async () => {
    const mock = serve({ id: 'run-1' });
    await expect(workflowApi.getWorkflowRunDetail('run-1')).resolves.toEqual({ id: 'run-1' });
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/run-1');

    offline();
    const known = readRuns()[0];
    await expect(workflowApi.getWorkflowRunDetail(known.id)).resolves.toMatchObject({
      id: known.id
    });
    await expect(workflowApi.getWorkflowRunDetail('run-nope')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('triggers a manual run that lands at the head of the feed', async () => {
    const mock = serve({ id: 'run-manual' });
    await workflowApi.triggerWorkflowRun('wf-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome/runs');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

    offline();
    const before = readRuns().length;
    const run = await workflowApi.triggerWorkflowRun('wf-welcome');
    expect(run.status).toBe('succeeded');
    expect(run.workflowId).toBe('wf-welcome');
    expect(run.workflowName).toBe('New customer welcome');
    expect(run.demo).toBe(true);
    expect(run.nodeRuns.length).toBeGreaterThan(0);
    expect(run.endedAt).not.toBeNull();
    expect(readRuns()).toHaveLength(before + 1);
    expect(readRuns()[0].id).toBe(run.id);
  });

  it('refuses to trigger a run for a graph that cannot execute', async () => {
    offline();
    const draft = await workflowApi.createWorkflow({
      name: 'Broken',
      description: '',
      definition: { nodes: [], edges: [] },
      status: 'draft'
    });
    await expect(workflowApi.triggerWorkflowRun(draft.id)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(workflowApi.triggerWorkflowRun('wf-nope')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('stops a running run and conflicts on a finished one', async () => {
    const mock = serve({ id: 'run-x', status: 'stopped' });
    await workflowApi.stopWorkflowRun('run-x');
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/run-x/stop');

    offline();
    const finished = readRuns().filter((run) => run.status !== 'running')[0];
    expect(finished).toBeTruthy();
    await expect(workflowApi.stopWorkflowRun(finished.id)).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    await expect(workflowApi.stopWorkflowRun('run-nope')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('computes run stats over finished runs only', async () => {
    const mock = serve({ total: 3, successRate: 66.7 });
    await workflowApi.getWorkflowRunStats({ workflowId: 'wf-welcome' });
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/stats?workflowId=wf-welcome');

    offline();
    const stats = await workflowApi.getWorkflowRunStats();
    expect(stats).toEqual(demoRunStats());
    expect(stats.total).toBe(readRuns().length);
    expect(stats.succeeded + stats.failed + stats.stopped + stats.running).toBe(stats.total);
    const finished = stats.succeeded + stats.failed + stats.stopped;
    expect(stats.successRate).toBe(Math.round((stats.succeeded / finished) * 1000) / 10);
    expect(stats.averageDurationMs).toBeGreaterThan(0);

    const scoped = await workflowApi.getWorkflowRunStats({ workflowId: 'wf-welcome' });
    expect(scoped.total).toBeLessThan(stats.total);
  });
});

describe('workflow api templates and catalog', () => {
  it('lists templates from the server or the local library', async () => {
    const mock = serve([{ id: 'wf-tpl-welcome' }]);
    await expect(workflowApi.getWorkflowTemplates()).resolves.toEqual([{ id: 'wf-tpl-welcome' }]);
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates');

    offline();
    const templates = await workflowApi.getWorkflowTemplates();
    expect(templates.map((item) => item.id)).toEqual(WORKFLOW_TEMPLATES.map((item) => item.id));
    expect(templates).toHaveLength(5);
  });

  it('counts a template use so the library can sort by popularity', async () => {
    const mock = serve({ id: 'wf-tpl-welcome', useCount: 49 });
    await workflowApi.useWorkflowTemplate('wf-tpl-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates/wf-tpl-welcome/use');
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

    offline();
    const before = (await workflowApi.getWorkflowTemplates()).find(
      (item) => item.id === 'wf-tpl-birthday'
    );
    const after = await workflowApi.useWorkflowTemplate('wf-tpl-birthday');
    expect(after.useCount).toBe((before?.useCount ?? 0) + 1);
    await expect(workflowApi.useWorkflowTemplate('wf-tpl-nope')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('instantiates a template into a new draft workflow', async () => {
    const mock = serve({ id: 'wf-from-tpl' });
    await workflowApi.createWorkflowFromTemplate('wf-tpl-welcome', 'Karibu');
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates/wf-tpl-welcome/instantiate');
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toEqual({ name: 'Karibu' });

    offline();
    const created = await workflowApi.createWorkflowFromTemplate('wf-tpl-winback', 'Win back VIPs');
    expect(created.status).toBe('draft');
    expect(created.name).toBe('Win back VIPs');
    expect(created.definition.nodes.length).toBeGreaterThan(2);
    expect(readWorkflows().some((item) => item.id === created.id)).toBe(true);
  });

  it('rejects a blank template name and an unknown template id', async () => {
    offline();
    await expect(
      workflowApi.createWorkflowFromTemplate('wf-tpl-welcome', '   ')
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      workflowApi.createWorkflowFromTemplate('wf-tpl-nope', 'x')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('gives every template a graph that passes validation', async () => {
    offline();
    const templates = await workflowApi.getWorkflowTemplates();
    for (const template of templates) {
      const created = await workflowApi.createWorkflowFromTemplate(template.id, 'check ' + template.id);
      const validation = await workflowApi.validateWorkflow(created.definition);
      expect(validation.issues, template.id).toEqual([]);
      expect(validation.valid, template.id).toBe(true);
    }
  });

  it('serves the node catalog whole and per kind', async () => {
    const mock = serve([]);
    await workflowApi.getNodeTypes();
    expect(urlOf(mock)).toBe('/api/v1/workflow/nodes');
    await workflowApi.getNodeTypes('condition');
    expect(urlOf(mock, 1)).toBe('/api/v1/workflow/nodes?kind=condition');

    offline();
    await expect(workflowApi.getNodeTypes()).resolves.toEqual(demoNodeTypes());
    expect(await workflowApi.getNodeTypes()).toEqual(NODE_TYPES);
    expect(
      (await workflowApi.getNodeTypes('trigger')).every((item) => item.kind === 'trigger')
    ).toBe(true);
  });

  it('exposes the trigger, condition and action catalogs on their own endpoints', async () => {
    const mock = serve([]);
    await workflowApi.getTriggers();
    await workflowApi.getConditions();
    await workflowApi.getActions();
    expect(urlOf(mock, 0)).toBe('/api/v1/workflow/triggers');
    expect(urlOf(mock, 1)).toBe('/api/v1/workflow/conditions');
    expect(urlOf(mock, 2)).toBe('/api/v1/workflow/actions');

    offline();
    expect(await workflowApi.getTriggers()).toEqual(nodesByKind('trigger'));
    expect(await workflowApi.getConditions()).toEqual(nodesByKind('condition'));
    expect(await workflowApi.getActions()).toEqual(nodesByKind('action'));
    expect(
      nodesByKind('trigger').length + nodesByKind('condition').length + nodesByKind('action').length
    ).toBe(NODE_TYPES.length);
  });

  it('keeps the demo catalog usable after a hard failure elsewhere', async () => {
    serverError(500);
    await expect(workflowApi.getWorkflowTemplates()).rejects.toThrow(ApiError);
    offline();
    await expect(workflowApi.getWorkflowTemplates()).resolves.toHaveLength(5);
  });
});
