/**
 * Sprint 12 store tests for the automation workflow module.
 *
 * The store is the only layer allowed to import api/workflow, so each test pins
 * three things at once: the request the action issues, the state it writes back,
 * and the offline contract. A missing backend (network error or 404) falls
 * through to the demo engine and the page keeps working; a hard 5xx surfaces as
 * an i18n error key and must leave the previously loaded data untouched.
 * Canvas edits are asserted through the same getters the builder binds to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  useWorkflowStore,
  WORKFLOW_LIST_PAGE_SIZE,
  WORKFLOW_RUN_PAGE_SIZE
} from '../stores/workflow';
import {
  demoNodeTypes,
  demoResetWorkflows,
  demoRunStats,
  demoWorkflowOverview,
  demoWorkflowRuns,
  demoWorkflowTemplates,
  demoWorkflows
} from '../api/demoWorkflow';
import { ORIGIN, createEdge, createNode, emptyDefinition } from '../lib/workflowGraph';
import { computeRunStats } from '../lib/workflowRun';
import type {
  NodeRun,
  NodeRunState,
  Workflow,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStats
} from '../types';

/* ------------------------------------------------------------------- stubs */

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

function serve(data: unknown, ok = true, status = 200) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(data, ok, status));
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** One response per call; the last one repeats so polling stays answerable. */
function serveSequence(...datas: unknown[]) {
  let index = 0;
  const mock = vi.fn().mockImplementation(() => {
    const data = datas[Math.min(index, datas.length - 1)];
    index += 1;
    return Promise.resolve(jsonResponse(data));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

function hardFail(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

function urlOf(mock: ReturnType<typeof serve>, call = 0): string {
  return String(mock.mock.calls[call][0]);
}

function methodOf(mock: ReturnType<typeof serve>, call = 0): string {
  const init = mock.mock.calls[call][1] as RequestInit | undefined;
  return String(init?.method ?? 'GET');
}

/* --------------------------------------------------------------- factories */

const NOW = new Date(2026, 8, 12, 9, 0).getTime();

/** A valid two node graph so validate() has something to accept. */
function graph(): WorkflowDefinition {
  const action = createNode('send_message', { x: 300, y: 40 }, 'a1');
  action.config.template = 'Karibu';
  return {
    nodes: [createNode('message_received', ORIGIN, 't1'), action],
    edges: [createEdge('t1', 'a1')]
  };
}

function wf(id: string, patch: Partial<Workflow> = {}): Workflow {
  return {
    id,
    name: 'Workflow ' + id,
    description: '',
    status: 'active',
    definition: emptyDefinition(),
    triggerKind: 'message_received',
    nodeCount: 2,
    todayRuns: 3,
    successRuns: 2,
    failedRuns: 1,
    lastRunAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  };
}

function nodeRun(nodeId: string, state: NodeRunState): NodeRun {
  return {
    nodeId,
    nodeName: nodeId.toUpperCase(),
    nodeType: 'send_message',
    state,
    startedAt: state === 'pending' ? null : NOW,
    endedAt: state === 'succeeded' || state === 'failed' ? NOW + 400 : null,
    durationMs: state === 'succeeded' || state === 'failed' ? 400 : 0,
    attempts: 1,
    input: {},
    output: {}
  };
}

function run(id: string, patch: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id,
    workflowId: 'wf-welcome',
    workflowName: 'Workflow wf-welcome',
    status: 'succeeded',
    triggerReason: 'workflow.triggerReason.message_received',
    startedAt: NOW,
    endedAt: NOW + 900,
    durationMs: 900,
    nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'succeeded')],
    ...patch
  };
}

function stats(patch: Partial<WorkflowRunStats> = {}): WorkflowRunStats {
  return {
    total: 4,
    succeeded: 3,
    failed: 1,
    stopped: 0,
    running: 0,
    successRate: 75,
    averageDurationMs: 900,
    ...patch
  };
}

function paged(workflows: Workflow[], total = workflows.length, hasMore = false) {
  return { workflows, total, hasMore };
}

function pagedRuns(runs: WorkflowRun[], total = runs.length, hasMore = false) {
  return { runs, total, hasMore };
}

beforeEach(() => {
  localStorage.clear();
  demoResetWorkflows();
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllGlobals();
  demoResetWorkflows();
  localStorage.clear();
});

/* ------------------------------------------------------------------ overview */

describe('workflow store overview and list', () => {
  it('stores the overview from the server and clears the previous error', async () => {
    const store = useWorkflowStore();
    store.error = 'api.network';
    const overview = { activeWorkflows: 5, todayTriggers: 40, todaySucceeded: 36, todayFailed: 4 };
    const mock = serve(overview);
    await expect(store.fetchOverview()).resolves.toEqual(overview);
    expect(urlOf(mock)).toBe('/api/v1/workflows/overview');
    expect(store.overview).toEqual(overview);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('falls back to the demo overview when the backend is missing', async () => {
    offline();
    const store = useWorkflowStore();
    await store.fetchOverview();
    expect(store.overview).toEqual(demoWorkflowOverview());
    expect(store.overview.activeWorkflows).toBeGreaterThan(0);
    expect(store.error).toBeNull();
  });

  it('resets the overview to zeros and keeps an i18n key on a hard failure', async () => {
    const store = useWorkflowStore();
    store.overview = { activeWorkflows: 9, todayTriggers: 9, todaySucceeded: 9, todayFailed: 9 };
    hardFail(503);
    await expect(store.fetchOverview()).resolves.toEqual({
      activeWorkflows: 0,
      todayTriggers: 0,
      todaySucceeded: 0,
      todayFailed: 0
    });
    expect(store.error).toBe('api.500');
    expect(store.loading).toBe(false);
    store.resetError();
    expect(store.error).toBeNull();
  });

  it('asks for one page of workflows with the shared page size', async () => {
    const store = useWorkflowStore();
    const mock = serve(paged([wf('a'), wf('b')], 41, true));
    const rows = await store.fetchWorkflows();
    expect(urlOf(mock)).toBe('/api/v1/workflows?limit=' + WORKFLOW_LIST_PAGE_SIZE);
    expect(rows.map((item) => item.id)).toEqual(['a', 'b']);
    expect(store.workflows).toEqual(rows);
    expect(store.total).toBe(41);
    expect(store.hasMore).toBe(true);
  });

  it('replaces the list on a fresh page and appends without duplicates on an offset', async () => {
    const store = useWorkflowStore();
    const mock = serveSequence(paged([wf('a'), wf('b')], 4, true), paged([wf('b'), wf('c')], 4, false));
    await store.fetchWorkflows();
    await store.fetchWorkflows({ offset: 2 });
    expect(urlOf(mock, 1)).toBe('/api/v1/workflows?limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=2');
    expect(store.workflows.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(store.hasMore).toBe(false);
  });

  it('passes filters through to the query string', async () => {
    const store = useWorkflowStore();
    const mock = serve(paged([]));
    await store.fetchWorkflows({ query: 'vip', status: 'paused' });
    expect(urlOf(mock)).toBe(
      '/api/v1/workflows?query=vip&status=paused&limit=' + WORKFLOW_LIST_PAGE_SIZE
    );
  });

  it('keeps the rows already on screen when a refresh fails', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('a')]));
    await store.fetchWorkflows();
    hardFail(500);
    const rows = await store.fetchWorkflows();
    expect(rows.map((item) => item.id)).toEqual(['a']);
    expect(store.error).toBe('api.500');
    expect(store.loading).toBe(false);
  });

  it('serves the seeded demo list when the backend is offline', async () => {
    offline();
    const store = useWorkflowStore();
    const rows = await store.fetchWorkflows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((item) => item.id)).toEqual(demoWorkflows().workflows.map((item) => item.id));
    expect(store.hasDemoData).toBe(true);
  });

  it('loads the next page only while there is more and nothing is in flight', async () => {
    const store = useWorkflowStore();
    const first = Array.from({ length: WORKFLOW_LIST_PAGE_SIZE }, (_, index) => wf('w' + index));
    const second = [wf('tail')];
    const mock = serveSequence(paged(first, 21, true), paged(second, 21, false));
    await store.fetchWorkflows();
    await store.loadMoreWorkflows();
    expect(urlOf(mock, 1)).toBe(
      '/api/v1/workflows?limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=' + WORKFLOW_LIST_PAGE_SIZE
    );
    expect(store.workflows).toHaveLength(WORKFLOW_LIST_PAGE_SIZE + 1);
    const calls = mock.mock.calls.length;
    await store.loadMoreWorkflows();
    expect(mock.mock.calls.length).toBe(calls);
  });

  it('refuses to page while a request is already running', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('a')], 5, true));
    await store.fetchWorkflows();
    store.loading = true;
    const mock = serve(paged([wf('b')]));
    await store.loadMoreWorkflows();
    expect(mock.mock.calls.length).toBe(0);
    store.loading = false;
  });
});

/* ------------------------------------------------------------------- detail */

describe('workflow store detail and mutations', () => {
  it('loads one workflow and merges it back into the list', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1', { name: 'stale' })]));
    await store.fetchWorkflows();
    const fresh = wf('wf-1', { name: 'fresh' });
    const mock = serve(fresh);
    await expect(store.fetchWorkflow('wf-1')).resolves.toEqual(fresh);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1');
    expect(store.current?.name).toBe('fresh');
    expect(store.workflows[0].name).toBe('fresh');
  });

  it('encodes the id so a slash cannot escape the path', async () => {
    const store = useWorkflowStore();
    const mock = serve(wf('a/b'));
    await store.fetchWorkflow('a/b');
    expect(urlOf(mock)).toBe('/api/v1/workflows/a%2Fb');
  });

  it('clears the current workflow and reports an i18n key when the fetch fails', async () => {
    const store = useWorkflowStore();
    store.current = wf('gone');
    hardFail(404);
    await expect(store.fetchWorkflow('gone')).resolves.toBeNull();
    expect(store.current).toBeNull();
    expect(store.error).toBe('api.404');
  });

  it('reads the definition summary for the detail header', async () => {
    const store = useWorkflowStore();
    const summary = { nodes: 4, edges: 3, triggers: 1, conditions: 1, actions: 2, depth: 3 };
    const mock = serve(summary);
    await expect(store.fetchSummary('wf-1')).resolves.toEqual(summary);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1/summary');
    expect(store.summary).toEqual(summary);
    hardFail(500);
    await expect(store.fetchSummary('wf-1')).resolves.toBeNull();
    expect(store.summary).toBeNull();
    expect(store.error).toBe('api.500');
  });

  it('prepends a created workflow and bumps the counter', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('old')], 1));
    await store.fetchWorkflows();
    const created = wf('new', { status: 'draft' });
    const mock = serve(created);
    await expect(store.createWorkflow({ name: 'New', definition: graph() })).resolves.toEqual(created);
    expect(urlOf(mock)).toBe('/api/v1/workflows');
    expect(methodOf(mock)).toBe('POST');
    expect(store.workflows.map((item) => item.id)).toEqual(['new', 'old']);
    expect(store.total).toBe(2);
    expect(store.current?.id).toBe('new');
    expect(store.saving).toBe(false);
  });

  it('returns null and keeps the list when create fails', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('old')], 1));
    await store.fetchWorkflows();
    hardFail(500);
    await expect(store.createWorkflow({ name: 'x', definition: graph() })).resolves.toBeNull();
    expect(store.workflows).toHaveLength(1);
    expect(store.total).toBe(1);
    expect(store.error).toBe('api.500');
  });

  it('applies an updated workflow in place and clears the dirty flag', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1'), wf('wf-2')]));
    await store.fetchWorkflows();
    store.dirty = true;
    store.current = wf('wf-1');
    const updated = wf('wf-1', { name: 'renamed' });
    const mock = serve(updated);
    await expect(store.updateWorkflow('wf-1', { name: 'renamed' })).resolves.toEqual(updated);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1');
    expect(methodOf(mock)).toBe('PUT');
    expect(store.workflows.map((item) => item.name)).toEqual(['renamed', 'Workflow wf-2']);
    expect(store.current?.name).toBe('renamed');
    expect(store.dirty).toBe(false);
  });

  it('returns null and leaves the dirty flag alone when update fails', async () => {
    const store = useWorkflowStore();
    store.dirty = true;
    hardFail(500);
    await expect(store.updateWorkflow('wf-1', { name: 'x' })).resolves.toBeNull();
    expect(store.dirty).toBe(true);
    expect(store.error).toBe('api.500');
  });

  it('drops a deleted workflow, decrements the counter and clears current', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1'), wf('wf-2')], 2));
    await store.fetchWorkflows();
    store.current = wf('wf-1');
    const mock = serve(null);
    await expect(store.deleteWorkflow('wf-1')).resolves.toBe(true);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1');
    expect(methodOf(mock)).toBe('DELETE');
    expect(store.workflows.map((item) => item.id)).toEqual(['wf-2']);
    expect(store.total).toBe(1);
    expect(store.current).toBeNull();
  });

  it('never lets the counter go negative and reports a failed delete', async () => {
    const store = useWorkflowStore();
    store.total = 0;
    store.removeWorkflow('ghost');
    expect(store.total).toBe(0);
    hardFail(500);
    await expect(store.deleteWorkflow('wf-1')).resolves.toBe(false);
    expect(store.error).toBe('api.500');
  });

  it('routes each status through its own endpoint', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1', { status: 'draft' })]));
    await store.fetchWorkflows();

    const enable = serve(wf('wf-1', { status: 'active' }));
    await store.setStatus('wf-1', 'active');
    expect(urlOf(enable)).toBe('/api/v1/workflows/wf-1/enable');
    expect(methodOf(enable)).toBe('POST');
    expect(store.workflows[0].status).toBe('active');

    const disable = serve(wf('wf-1', { status: 'paused' }));
    await store.setStatus('wf-1', 'paused');
    expect(urlOf(disable)).toBe('/api/v1/workflows/wf-1/disable');
    expect(store.workflows[0].status).toBe('paused');

    const draft = serve(wf('wf-1', { status: 'draft' }));
    await store.setStatus('wf-1', 'draft');
    expect(urlOf(draft)).toBe('/api/v1/workflows/wf-1');
    expect(methodOf(draft)).toBe('PUT');
    expect(store.workflows[0].status).toBe('draft');
  });

  it('returns null when a status change fails', async () => {
    const store = useWorkflowStore();
    hardFail(500);
    await expect(store.setStatus('wf-1', 'active')).resolves.toBeNull();
    expect(store.error).toBe('api.500');
    expect(store.saving).toBe(false);
  });

  it('prepends a duplicate and bumps the counter', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1')], 1));
    await store.fetchWorkflows();
    const copy = wf('wf-1-copy', { name: 'Workflow wf-1 (copy)', status: 'draft' });
    const mock = serve(copy);
    await expect(store.duplicateWorkflow('wf-1')).resolves.toEqual(copy);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1/duplicate');
    expect(store.workflows.map((item) => item.id)).toEqual(['wf-1-copy', 'wf-1']);
    expect(store.total).toBe(2);
    hardFail(500);
    await expect(store.duplicateWorkflow('wf-1')).resolves.toBeNull();
  });

  it('applies a server side layout pass', async () => {
    const store = useWorkflowStore();
    serve(paged([wf('wf-1')]));
    await store.fetchWorkflows();
    const laid = wf('wf-1', { definition: graph() });
    const mock = serve(laid);
    await expect(store.layoutWorkflow('wf-1')).resolves.toEqual(laid);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1/layout');
    expect(store.workflows[0].definition.nodes).toHaveLength(2);
    hardFail(500);
    await expect(store.layoutWorkflow('wf-1')).resolves.toBeNull();
  });

  it('stores the server validation result and flags the offending nodes', async () => {
    const store = useWorkflowStore();
    const result = {
      valid: false,
      issues: [{ code: 'MISSING_CONFIG' as const, messageKey: 'workflow.issue.MISSING_CONFIG', nodeId: 'a1' }]
    };
    const mock = serve(result);
    await expect(store.validate(graph())).resolves.toEqual(result);
    expect(urlOf(mock)).toBe('/api/v1/workflows/validate');
    expect(methodOf(mock)).toBe('POST');
    expect(store.validation.valid).toBe(false);
    expect(store.issueNodeIds).toEqual(['a1']);
  });

  it('re-validates locally so a failed call still highlights the canvas', async () => {
    const store = useWorkflowStore();
    hardFail(500);
    const broken: WorkflowDefinition = {
      nodes: [createNode('send_message', ORIGIN, 'a1')],
      edges: []
    };
    const result = await store.validate(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain('NO_TRIGGER');
    expect(store.validation).toEqual(result);
    expect(store.error).toBe('api.500');
  });

  it('validates the working definition when called with no argument', async () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    const mock = serve({ valid: true, issues: [] });
    await store.validate();
    expect(JSON.parse(String(mock.mock.calls[0][1]?.body)).definition.nodes).toHaveLength(2);
    expect(store.validation.valid).toBe(true);
  });
});

/* --------------------------------------------------------------------- runs */

describe('workflow store runs', () => {
  it('reads the cross workflow feed when no id is scoped', async () => {
    const store = useWorkflowStore();
    const mock = serve(pagedRuns([run('r1'), run('r2')], 30, true));
    const rows = await store.fetchRuns();
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs?limit=' + WORKFLOW_RUN_PAGE_SIZE);
    expect(rows.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(store.runsTotal).toBe(30);
    expect(store.runsHasMore).toBe(true);
  });

  it('reads the per workflow feed and forwards the status filter', async () => {
    const store = useWorkflowStore();
    const mock = serve(pagedRuns([]));
    await store.fetchRuns({ workflowId: 'wf-1', status: 'failed' });
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1/runs?status=failed&limit=' + WORKFLOW_RUN_PAGE_SIZE);
  });

  it('appends a run page without duplicating ids', async () => {
    const store = useWorkflowStore();
    const mock = serveSequence(pagedRuns([run('r1'), run('r2')], 3, true), pagedRuns([run('r2'), run('r3')], 3, false));
    await store.fetchRuns();
    await store.fetchRuns({ offset: 2 });
    expect(urlOf(mock, 1)).toBe('/api/v1/workflow-runs?limit=' + WORKFLOW_RUN_PAGE_SIZE + '&offset=2');
    expect(store.runs.map((item) => item.id)).toEqual(['r1', 'r2', 'r3']);
    expect(store.runsHasMore).toBe(false);
  });

  it('keeps the runs already on screen when a refresh fails', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1')]));
    await store.fetchRuns();
    hardFail(500);
    const rows = await store.fetchRuns();
    expect(rows.map((item) => item.id)).toEqual(['r1']);
    expect(store.error).toBe('api.500');
    expect(store.loading).toBe(false);
  });

  it('serves the seeded demo runs when the backend is offline', async () => {
    offline();
    const store = useWorkflowStore();
    const rows = await store.fetchRuns();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((item) => item.id)).toEqual(demoWorkflowRuns().runs.map((item) => item.id));
    expect(store.runsAreDemo).toBe(true);
    expect(store.error).toBeNull();
  });

  it('pages runs only while there is more and nothing is in flight', async () => {
    const store = useWorkflowStore();
    const first = Array.from({ length: WORKFLOW_RUN_PAGE_SIZE }, (_, index) => run('r' + index));
    const mock = serveSequence(pagedRuns(first, 21, true), pagedRuns([run('tail')], 21, false));
    await store.fetchRuns();
    await store.loadMoreRuns();
    expect(urlOf(mock, 1)).toBe(
      '/api/v1/workflow-runs?limit=' + WORKFLOW_RUN_PAGE_SIZE + '&offset=' + WORKFLOW_RUN_PAGE_SIZE
    );
    expect(store.runs).toHaveLength(WORKFLOW_RUN_PAGE_SIZE + 1);
    await store.loadMoreRuns();
    expect(mock.mock.calls.length).toBe(2);
    store.loading = true;
    store.runsHasMore = true;
    await store.loadMoreRuns();
    expect(mock.mock.calls.length).toBe(2);
  });

  it('merges a fetched run into the list and keeps it as the current one', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1', { status: 'running' })]));
    await store.fetchRuns();
    const done = run('r1', { status: 'succeeded' });
    const mock = serve(done);
    await expect(store.fetchRun('r1')).resolves.toEqual(done);
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/r1');
    expect(store.currentRun?.status).toBe('succeeded');
    expect(store.runs[0].status).toBe('succeeded');
    expect(store.currentNodeStateCounts?.succeeded).toBe(2);
  });

  it('clears the current run and reports an i18n key when the fetch fails', async () => {
    const store = useWorkflowStore();
    store.currentRun = run('r1');
    hardFail(500);
    await expect(store.fetchRun('r1')).resolves.toBeNull();
    expect(store.currentRun).toBeNull();
    expect(store.error).toBe('api.500');
    expect(store.loading).toBe(false);
  });

  it('polls a run silently and never flips the page level loading flag', async () => {
    const store = useWorkflowStore();
    store.currentRun = run('r1', { status: 'running' });
    const tick = serve(run('r1', { status: 'succeeded' }));
    await expect(store.pollRun('r1')).resolves.toMatchObject({ status: 'succeeded' });
    expect(urlOf(tick)).toBe('/api/v1/workflow-runs/r1');
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('swallows a dropped poll so the monitor keeps ticking', async () => {
    const store = useWorkflowStore();
    const previous = run('r1', { status: 'running' });
    store.currentRun = previous;
    hardFail(500);
    await expect(store.pollRun('r1')).resolves.toEqual(previous);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('polls the run list without touching loading or error', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1')]));
    await store.fetchRuns();
    const tick = serve(pagedRuns([run('r1', { status: 'failed' })], 1));
    const rows = await store.pollRuns({ workflowId: 'wf-1' });
    expect(urlOf(tick)).toBe('/api/v1/workflows/wf-1/runs?limit=' + WORKFLOW_RUN_PAGE_SIZE);
    expect(rows[0].status).toBe('failed');
    expect(store.loading).toBe(false);
    hardFail(500);
    await expect(store.pollRuns()).resolves.toEqual(rows);
    expect(store.error).toBeNull();
  });

  it('stops a run and merges the stopped state back', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1', { status: 'running' })]));
    await store.fetchRuns();
    const stopped = run('r1', { status: 'stopped', endedAt: NOW + 1200, durationMs: 1200 });
    const mock = serve(stopped);
    await expect(store.stopRun('r1')).resolves.toEqual(stopped);
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/r1/stop');
    expect(methodOf(mock)).toBe('POST');
    expect(store.runs[0].status).toBe('stopped');
    expect(store.currentRun?.status).toBe('stopped');
    expect(store.saving).toBe(false);
  });

  it('reports a failed stop with an i18n key', async () => {
    const store = useWorkflowStore();
    hardFail(500);
    await expect(store.stopRun('r1')).resolves.toBeNull();
    expect(store.error).toBe('api.500');
  });

  it('prepends a manually triggered run and bumps the counter', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1')], 1));
    await store.fetchRuns();
    const fresh = run('r2', { status: 'running', endedAt: null, durationMs: 0 });
    const mock = serve(fresh);
    await expect(store.triggerRun('wf-1')).resolves.toEqual(fresh);
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1/runs');
    expect(methodOf(mock)).toBe('POST');
    expect(store.runs.map((item) => item.id)).toEqual(['r2', 'r1']);
    expect(store.runsTotal).toBe(2);
    expect(store.currentRun?.id).toBe('r2');
    expect(store.hasRunningRuns).toBe(true);
  });

  it('returns null when a manual trigger fails', async () => {
    const store = useWorkflowStore();
    hardFail(500);
    await expect(store.triggerRun('wf-1')).resolves.toBeNull();
    expect(store.error).toBe('api.500');
    expect(store.saving).toBe(false);
  });

  it('stores the run stats from the server', async () => {
    const store = useWorkflowStore();
    const mock = serve(stats());
    await expect(store.fetchRunStats({ workflowId: 'wf-1' })).resolves.toEqual(stats());
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/stats?workflowId=wf-1');
    expect(store.runStats.successRate).toBe(75);
  });

  it('recomputes the stats from the loaded runs when the call fails', async () => {
    const store = useWorkflowStore();
    serve(pagedRuns([run('r1', { status: 'succeeded' }), run('r2', { status: 'failed' })]));
    await store.fetchRuns();
    hardFail(500);
    const result = await store.fetchRunStats();
    expect(result).toEqual(computeRunStats(store.runs));
    expect(result.total).toBe(2);
    expect(result.successRate).toBe(50);
    expect(store.runStats).toEqual(result);
    expect(store.error).toBe('api.500');
  });

  it('falls back to the demo stats when the backend is missing', async () => {
    offline();
    const store = useWorkflowStore();
    await store.fetchRunStats();
    expect(store.runStats).toEqual(demoRunStats());
    expect(store.error).toBeNull();
  });
});

/* ------------------------------------------------------- templates/catalog */

describe('workflow store templates and node catalogue', () => {
  it('loads the template library', async () => {
    const store = useWorkflowStore();
    const list = [
      {
        id: 'tpl-1',
        nameKey: 'workflow.template.welcome.name',
        descriptionKey: 'workflow.template.welcome.desc',
        scenarioKey: 'workflow.template.scenario.onboarding',
        complexity: 'simple' as const,
        useCount: 2,
        definition: graph()
      }
    ];
    const mock = serve(list);
    await expect(store.fetchTemplates()).resolves.toEqual(list);
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates');
    expect(store.templates).toHaveLength(1);
    expect(store.loading).toBe(false);
  });

  it('keeps the templates already loaded when a refresh fails', async () => {
    const store = useWorkflowStore();
    offline();
    await store.fetchTemplates();
    const seeded = store.templates.length;
    expect(seeded).toBe(demoWorkflowTemplates().length);
    hardFail(500);
    await store.fetchTemplates();
    expect(store.templates).toHaveLength(seeded);
    expect(store.error).toBe('api.500');
  });

  it('instantiates a template into a draft and bumps its use count', async () => {
    const store = useWorkflowStore();
    offline();
    await store.fetchTemplates();
    const before = store.templates[0].useCount;
    const created = wf('wf-new', { status: 'draft' });
    const mock = serve(created);
    await expect(store.createFromTemplate(store.templates[0].id, 'From template')).resolves.toEqual(
      created
    );
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates/' + store.templates[0].id + '/instantiate');
    expect(methodOf(mock)).toBe('POST');
    expect(JSON.parse(String(mock.mock.calls[0][1]?.body))).toEqual({ name: 'From template' });
    expect(store.workflows[0].id).toBe('wf-new');
    expect(store.total).toBe(1);
    expect(store.current?.id).toBe('wf-new');
    expect(store.templates[0].useCount).toBe(before + 1);
  });

  it('does not touch use counts for an unknown template and reports failures', async () => {
    const store = useWorkflowStore();
    offline();
    await store.fetchTemplates();
    const before = store.templates.map((item) => item.useCount);
    const mock = serve(wf('wf-new'));
    await store.createFromTemplate('tpl-nope', 'x');
    expect(store.templates.map((item) => item.useCount)).toEqual(before);
    expect(mock.mock.calls.length).toBe(1);
    hardFail(500);
    await expect(store.createFromTemplate('tpl-1', 'x')).resolves.toBeNull();
    expect(store.error).toBe('api.500');
    expect(store.saving).toBe(false);
  });

  it('loads the node catalogue for the builder palette', async () => {
    const store = useWorkflowStore();
    const mock = serve(demoNodeTypes());
    const defs = await store.fetchNodeTypes();
    expect(urlOf(mock)).toBe('/api/v1/workflow/nodes');
    expect(defs.length).toBe(demoNodeTypes().length);
    expect(store.nodeTypes).toEqual(defs);
  });

  it('keeps the catalogue it already had when the request fails', async () => {
    const store = useWorkflowStore();
    offline();
    await store.fetchNodeTypes();
    const seeded = store.nodeTypes.length;
    expect(seeded).toBeGreaterThan(0);
    hardFail(500);
    await store.fetchNodeTypes();
    expect(store.nodeTypes).toHaveLength(seeded);
    expect(store.error).toBe('api.500');
  });
});

/* ------------------------------------------------------------------- canvas */

describe('workflow store canvas graph edits', () => {
  it('normalises a loaded graph and clears selection, dirty and validation', async () => {
    const store = useWorkflowStore();
    store.dirty = true;
    store.selectedNodeId = 'a1';
    store.validation = { valid: false, issues: [{ code: 'CYCLE', messageKey: 'workflow.issue.CYCLE' }] };
    const loaded = store.setDefinition(graph());
    expect(loaded.nodes.map((node) => node.id)).toEqual(['t1', 'a1']);
    expect(store.dirty).toBe(false);
    expect(store.selectedNodeId).toBeNull();
    expect(store.validation).toEqual({ valid: true, issues: [] });
    expect(store.nodeCount).toBe(2);
    expect(store.edgeCount).toBe(1);
    expect(store.triggerKind).toBe('message_received');
  });

  it('clears the canvas when given nothing', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.clearDefinition();
    expect(store.definition).toEqual({ nodes: [], edges: [] });
    expect(store.triggerKind).toBeNull();
    expect(store.nodeCount).toBe(0);
  });

  it('adds a node with its field defaults and selects it', () => {
    const store = useWorkflowStore();
    const node = store.addNode('send_message', { x: 10, y: 20 });
    expect(node.config.channel).toBe('whatsapp');
    expect(node.kind).toBe('action');
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(store.selectedNodeId).toBe(node.id);
    expect(store.selectedNode?.id).toBe(node.id);
    expect(store.dirty).toBe(true);
  });

  it('adds a prebuilt node so a template drop keeps its id', () => {
    const store = useWorkflowStore();
    const node = createNode('add_tag', ORIGIN, 'kept');
    node.config.tag = 'vip';
    store.addExistingNode(node);
    expect(store.definition.nodes[0].id).toBe('kept');
    expect(store.selectedNodeId).toBe('kept');
    expect(store.dirty).toBe(true);
  });

  it('removes a node and drops the selection with it', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.selectNode('a1');
    store.removeNode('a1');
    expect(store.nodeCount).toBe(1);
    expect(store.edgeCount).toBe(0);
    expect(store.selectedNodeId).toBeNull();
    expect(store.selectedNode).toBeNull();
  });

  it('keeps the selection when a different node is removed', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.selectNode('a1');
    store.removeNode('t1');
    expect(store.selectedNodeId).toBe('a1');
  });

  it('patches node metadata without letting the id be overwritten', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    const patched = store.patchNode('a1', { id: 'hacked', name: 'Renamed', retries: 2 });
    expect(patched.nodes[1].id).toBe('a1');
    expect(patched.nodes[1].name).toBe('Renamed');
    expect(store.dirty).toBe(true);
  });

  it('merges a config patch into the existing config', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.patchConfig('a1', { template: 'Habari', useAi: true });
    const node = store.definition.nodes[1];
    expect(node.config.template).toBe('Habari');
    expect(node.config.useAi).toBe(true);
    expect(node.config.channel).toBe('whatsapp');
  });

  it('ignores a patch for an unknown node', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    const before = store.definition;
    store.patchNode('ghost', { name: 'x' });
    expect(store.definition.nodes).toEqual(before.nodes);
    store.patchConfig('ghost', { template: 'x' });
    expect(store.definition.nodes[1].config.template).toBe('Karibu');
  });

  it('moves one node and many nodes at once', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.moveNode('a1', { x: 500, y: 60 });
    expect(store.definition.nodes[1].position).toEqual({ x: 500, y: 60 });
    store.moveNodes({ t1: { x: 10, y: 10 }, a1: { x: 20, y: 20 } });
    expect(store.definition.nodes[0].position).toEqual({ x: 10, y: 10 });
    expect(store.definition.nodes[1].position).toEqual({ x: 20, y: 20 });
    expect(store.dirty).toBe(true);
  });

  it('connects and disconnects nodes, carrying the branch label', () => {
    const store = useWorkflowStore();
    const condition = createNode('has_tag', { x: 300, y: 40 }, 'c1');
    condition.config.tag = 'vip';
    store.setDefinition({
      nodes: [createNode('message_received', ORIGIN, 't1'), condition],
      edges: []
    });
    store.connect('t1', 'c1');
    expect(store.edgeCount).toBe(1);
    store.connect('c1', 't1', 'true');
    const branchEdge = store.definition.edges[1];
    expect(branchEdge.branch).toBe('true');
    expect(branchEdge.id).toContain('-true');
    store.disconnect(branchEdge.id);
    expect(store.edgeCount).toBe(1);
    expect(store.dirty).toBe(true);
  });

  it('runs an auto layout over the working graph', () => {
    const store = useWorkflowStore();
    store.setDefinition(graph());
    store.moveNode('a1', { x: 999, y: 999 });
    const laid = store.layoutWorking();
    expect(laid.nodes[0].position).toEqual(ORIGIN);
    expect(laid.nodes[1].position.x).toBe(ORIGIN.x + 260);
    expect(store.dirty).toBe(true);
  });

  it('tracks the dirty flag explicitly for the unsaved changes guard', () => {
    const store = useWorkflowStore();
    expect(store.dirty).toBe(false);
    store.markDirty();
    expect(store.dirty).toBe(true);
    store.markClean();
    expect(store.dirty).toBe(false);
    store.selectNode('nope');
    expect(store.selectedNode).toBeNull();
  });
});

/* ----------------------------------------------------------- getters/reset */

describe('workflow store getters and reset', () => {
  it('splits the list by status', () => {
    const store = useWorkflowStore();
    store.workflows = [
      wf('a', { status: 'active' }),
      wf('b', { status: 'paused' }),
      wf('c', { status: 'draft' }),
      wf('d', { status: 'active' })
    ];
    expect(store.activeWorkflows.map((item) => item.id)).toEqual(['a', 'd']);
    expect(store.pausedWorkflows.map((item) => item.id)).toEqual(['b']);
    expect(store.draftWorkflows.map((item) => item.id)).toEqual(['c']);
  });

  it('reports demo provenance for both lists', () => {
    const store = useWorkflowStore();
    expect(store.hasDemoData).toBe(false);
    expect(store.runsAreDemo).toBe(false);
    store.workflows = [wf('a', { demo: true })];
    store.runs = [run('r1', { demo: true })];
    expect(store.hasDemoData).toBe(true);
    expect(store.runsAreDemo).toBe(true);
  });

  it('reports whether any run is still going', () => {
    const store = useWorkflowStore();
    store.runs = [run('r1', { status: 'succeeded' })];
    expect(store.hasRunningRuns).toBe(false);
    store.runs = [run('r1', { status: 'succeeded' }), run('r2', { status: 'running' })];
    expect(store.hasRunningRuns).toBe(true);
  });

  it('counts node states only when a run is open', () => {
    const store = useWorkflowStore();
    expect(store.currentNodeStateCounts).toBeNull();
    store.currentRun = run('r1', {
      nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'failed'), nodeRun('a2', 'skipped')]
    });
    expect(store.currentNodeStateCounts).toEqual({
      pending: 0,
      running: 0,
      succeeded: 1,
      failed: 1,
      skipped: 1
    });
  });

  it('applies and removes a workflow row directly', () => {
    const store = useWorkflowStore();
    store.workflows = [wf('a'), wf('b')];
    store.total = 2;
    store.applyWorkflow(wf('c'));
    expect(store.workflows).toHaveLength(2);
    store.applyWorkflow(wf('a', { name: 'changed' }));
    expect(store.workflows[0].name).toBe('changed');
    store.current = wf('a');
    store.applyWorkflow(wf('a', { name: 'again' }));
    expect(store.current?.name).toBe('again');
    store.removeWorkflow('a');
    expect(store.workflows.map((item) => item.id)).toEqual(['b']);
    expect(store.total).toBe(1);
    expect(store.current).toBeNull();
  });

  it('restores every field to its initial value on reset', async () => {
    const store = useWorkflowStore();
    offline();
    await store.fetchWorkflows();
    await store.fetchRuns();
    store.addNode('send_message');
    store.error = 'api.500';
    expect(store.workflows.length).toBeGreaterThan(0);
    store.$reset();
    expect(store.workflows).toEqual([]);
    expect(store.runs).toEqual([]);
    expect(store.total).toBe(0);
    expect(store.hasMore).toBe(false);
    expect(store.runsTotal).toBe(0);
    expect(store.runsHasMore).toBe(false);
    expect(store.current).toBeNull();
    expect(store.currentRun).toBeNull();
    expect(store.summary).toBeNull();
    expect(store.templates).toEqual([]);
    expect(store.nodeTypes).toEqual([]);
    expect(store.definition).toEqual({ nodes: [], edges: [] });
    expect(store.selectedNodeId).toBeNull();
    expect(store.dirty).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.saving).toBe(false);
    expect(store.error).toBeNull();
    expect(store.validation).toEqual({ valid: true, issues: [] });
    expect(store.overview).toEqual({
      activeWorkflows: 0,
      todayTriggers: 0,
      todaySucceeded: 0,
      todayFailed: 0
    });
    expect(store.runStats).toEqual(computeRunStats([]));
  });

  it('surfaces a 401 as the session key', async () => {
    const store = useWorkflowStore();
    hardFail(401);
    await store.fetchWorkflows();
    expect(store.error).toBe('api.401');
  });
});
