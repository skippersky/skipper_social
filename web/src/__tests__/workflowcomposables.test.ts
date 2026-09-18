/**
 * Sprint 12 composable tests for the automation workflow module.
 *
 * Composables are the seam the views bind to, so these tests assert the intent
 * each one emits (which request, which store mutation, which computed the
 * template reads) rather than the DOM. The monitor poller is exercised with fake
 * timers because its whole contract is timing: a 2s nominal probe that doubles
 * on every failed probe, caps at 30s, resets on success and dies on unmount.
 * Nothing here touches a real backend; offline() proves the demo fallback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { WORKFLOW_STATUS_FILTERS, useWorkflow } from '../composables/useWorkflow';
import {
  CONNECT_PROBLEM_KEYS,
  resolveBranch,
  useWorkflowBuilder
} from '../composables/useWorkflowBuilder';
import {
  RUN_STATUS_FILTERS,
  nextPollInterval,
  useWorkflowMonitor
} from '../composables/useWorkflowMonitor';
import {
  TEMPLATE_COMPLEXITY_FILTERS,
  TEMPLATE_SCENARIO_FILTERS,
  scenarioSlug,
  useWorkflowTemplates
} from '../composables/useWorkflowTemplates';
import {
  WORKFLOW_LIST_PAGE_SIZE,
  WORKFLOW_RUN_PAGE_SIZE,
  useWorkflowStore
} from '../stores/workflow';
import {
  demoResetWorkflows,
  demoWorkflowById,
  demoWorkflowTemplates
} from '../api/demoWorkflow';
import {
  ORIGIN,
  createEdge,
  createNode,
  emptyDefinition,
  summarizeDefinition
} from '../lib/workflowGraph';
import { formatDuration } from '../lib/workflowRun';
import { WORKFLOW_TEMPLATES, templatesByComplexity } from '../lib/workflowTemplates';
import { RUN_POLL_INTERVAL_MS, RUN_POLL_MAX_INTERVAL_MS } from '../types';
import type {
  NodeRun,
  NodeRunState,
  Workflow,
  WorkflowDefinition,
  WorkflowRun
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

function callsOf(mock: ReturnType<typeof serve>): number {
  return mock.mock.calls.length;
}

/** useWorkflowMonitor registers an unmount hook, so it needs a component. */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let captured: T | null = null;
  const app = createApp({
    setup() {
      captured = composable();
      return () => h('div');
    }
  });
  app.mount(document.createElement('div'));
  return { result: captured as T, unmount: () => app.unmount() };
}

/* --------------------------------------------------------------- factories */

const NOW = new Date(2026, 8, 14, 10, 30).getTime();

function graph(): WorkflowDefinition {
  const action = createNode('send_message', { x: 300, y: 40 }, 'a1');
  action.config.template = 'Karibu';
  return {
    nodes: [createNode('message_received', ORIGIN, 't1'), action],
    edges: [createEdge('t1', 'a1')]
  };
}

function branching(): WorkflowDefinition {
  const condition = createNode('has_tag', { x: 300, y: 40 }, 'c1');
  condition.config.tag = 'vip';
  const yes = createNode('add_tag', { x: 560, y: 40 }, 'a1');
  yes.config.tag = 'hot';
  const no = createNode('send_message', { x: 560, y: 180 }, 'a2');
  no.config.template = 'Later';
  return {
    nodes: [createNode('message_received', ORIGIN, 't1'), condition, yes, no],
    edges: [createEdge('t1', 'c1'), createEdge('c1', 'a1', 'true'), createEdge('c1', 'a2', 'false')]
  };
}

function wf(id: string, patch: Partial<Workflow> = {}): Workflow {
  return {
    id,
    name: 'Workflow ' + id,
    description: '',
    status: 'active',
    definition: graph(),
    triggerKind: 'message_received',
    nodeCount: 2,
    todayRuns: 2,
    successRuns: 2,
    failedRuns: 0,
    lastRunAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  };
}

function nodeRun(nodeId: string, state: NodeRunState): NodeRun {
  return {
    nodeId,
    nodeName: nodeId,
    nodeType: 'send_message',
    state,
    startedAt: NOW,
    endedAt: state === 'succeeded' ? NOW + 300 : null,
    durationMs: state === 'succeeded' ? 300 : 0,
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
    endedAt: NOW + 600,
    durationMs: 600,
    nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'succeeded')],
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  demoResetWorkflows();
  localStorage.clear();
});

/** initCanvas takes a Workflow row, so a bare definition must be wrapped. */
function onCanvas(
  builder: ReturnType<typeof useWorkflowBuilder>,
  definition: WorkflowDefinition
): WorkflowDefinition {
  return builder.initCanvas(wf('canvas', { definition }));
}

/* ------------------------------------------------------------- useWorkflow */

describe('useWorkflow list composable', () => {
  it('publishes the status filter list the toolbar renders', () => {
    expect(WORKFLOW_STATUS_FILTERS).toEqual(['all', 'active', 'paused', 'draft']);
    expect(RUN_STATUS_FILTERS).toEqual(['all', 'running', 'succeeded', 'failed', 'stopped']);
    expect(TEMPLATE_COMPLEXITY_FILTERS).toEqual(['all', 'simple', 'medium', 'complex']);
    expect(TEMPLATE_SCENARIO_FILTERS.length).toBeGreaterThan(0);
  });

  it('builds list params from the search text and the status filter', () => {
    const { result } = withSetup(() => useWorkflow());
    expect(result.listParams()).toEqual({ limit: WORKFLOW_LIST_PAGE_SIZE, offset: 0 });
    expect(result.listParams(40)).toEqual({ limit: WORKFLOW_LIST_PAGE_SIZE, offset: 40 });
    result.query.value = '  vip  ';
    expect(result.listParams()).toEqual({
      limit: WORKFLOW_LIST_PAGE_SIZE,
      offset: 0,
      query: 'vip'
    });
    result.statusFilter.value = 'paused';
    expect(result.listParams()).toEqual({
      limit: WORKFLOW_LIST_PAGE_SIZE,
      offset: 0,
      query: 'vip',
      status: 'paused'
    });
    result.query.value = '   ';
    expect(result.listParams().query).toBeUndefined();
  });

  it('loads the overview and the first page through the store', async () => {
    const { result } = withSetup(() => useWorkflow());
    const overview = { activeWorkflows: 2, todayTriggers: 8, todaySucceeded: 7, todayFailed: 1 };
    const first = serve(overview);
    await expect(result.loadOverview()).resolves.toEqual(overview);
    expect(urlOf(first)).toBe('/api/v1/workflows/overview');
    expect(result.overview.value).toEqual(overview);

    const second = serve(paged([wf('a')], 1));
    await expect(result.loadWorkflows()).resolves.toHaveLength(1);
    expect(urlOf(second)).toBe('/api/v1/workflows?limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=0');
    expect(result.workflows.value.map((item) => item.id)).toEqual(['a']);
    expect(result.total.value).toBe(1);
    expect(result.refresh).toBe(result.loadWorkflows);
  });

  it('reloads with the new query on search and the new status on filter', async () => {
    const { result } = withSetup(() => useWorkflow());
    const search = serve(paged([]));
    await result.search('vip');
    expect(urlOf(search)).toBe(
      '/api/v1/workflows?query=vip&limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=0'
    );
    expect(result.query.value).toBe('vip');

    const filter = serve(paged([]));
    await result.filterStatus('draft');
    expect(urlOf(filter)).toBe(
      '/api/v1/workflows?query=vip&status=draft&limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=0'
    );
    expect(result.statusFilter.value).toBe('draft');
  });

  it('pages from the number of rows already loaded', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflow());
    store.workflows = [wf('a'), wf('b'), wf('c')];
    store.hasMore = true;
    const mock = serve(paged([wf('d')], 4, false));
    await result.loadMore();
    expect(urlOf(mock)).toBe(
      '/api/v1/workflows?limit=' + WORKFLOW_LIST_PAGE_SIZE + '&offset=3'
    );
    expect(store.workflows).toHaveLength(4);
  });

  it('opens a workflow and then its summary, and skips the summary on failure', async () => {
    const { result } = withSetup(() => useWorkflow());
    const summary = { nodes: 2, edges: 1, triggers: 1, conditions: 0, actions: 1, depth: 2 };
    const mock = serveSequence(wf('wf-1'), summary);
    await expect(result.open('wf-1')).resolves.toMatchObject({ id: 'wf-1' });
    expect(urlOf(mock, 0)).toBe('/api/v1/workflows/wf-1');
    expect(urlOf(mock, 1)).toBe('/api/v1/workflows/wf-1/summary');
    expect(result.detail.value?.id).toBe('wf-1');
    expect(result.summary.value).toEqual(summary);

    /* A dead backend still resolves because the api layer falls back to demo rows. */
    offline();
    await expect(result.open('wf-welcome')).resolves.toMatchObject({ id: 'wf-welcome' });
    expect(result.summary.value).toEqual(
      summarizeDefinition(demoWorkflowById('wf-welcome').definition)
    );
    expect(result.error.value).toBeNull();

    /* When the detail call fails the summary request must never be spent. */
    const failing = serve(null, false, 500);
    await expect(result.open('wf-1')).resolves.toBeNull();
    const requested = failing.mock.calls.map((call) => String(call[0]));
    expect(requested.every((url) => url === '/api/v1/workflows/wf-1')).toBe(true);
    expect(requested.some((url) => url.endsWith('/summary'))).toBe(false);
    expect(result.detail.value).toBeNull();
    expect(result.error.value).toBe('api.500');
  });

  it('delegates every lifecycle action to the store', async () => {
    const { result } = withSetup(() => useWorkflow());
    const created = wf('new', { status: 'draft' });
    let mock = serve(created);
    await expect(result.createWorkflow({ name: 'New', definition: graph() })).resolves.toEqual(created);
    expect(urlOf(mock)).toBe('/api/v1/workflows');

    mock = serve(wf('new', { name: 'Renamed' }));
    await expect(result.updateWorkflow('new', { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed'
    });
    expect(urlOf(mock)).toBe('/api/v1/workflows/new');

    mock = serve(wf('new', { status: 'active' }));
    await result.enableWorkflow('new');
    expect(urlOf(mock)).toBe('/api/v1/workflows/new/enable');

    mock = serve(wf('new', { status: 'paused' }));
    await result.disableWorkflow('new');
    expect(urlOf(mock)).toBe('/api/v1/workflows/new/disable');

    mock = serve(wf('new-copy'));
    await result.duplicateWorkflow('new');
    expect(urlOf(mock)).toBe('/api/v1/workflows/new/duplicate');

    mock = serve(wf('new', { definition: graph() }));
    await result.autoLayout('new');
    expect(urlOf(mock)).toBe('/api/v1/workflows/new/layout');

    mock = serve(null);
    await expect(result.deleteWorkflow('new')).resolves.toBe(true);
    expect(urlOf(mock)).toBe('/api/v1/workflows/new');
  });

  it('flips a row to the opposite live status on toggle', async () => {
    const { result } = withSetup(() => useWorkflow());
    let mock = serve(wf('w', { status: 'paused' }));
    await result.toggleStatus(wf('w', { status: 'active' }));
    expect(urlOf(mock)).toBe('/api/v1/workflows/w/disable');

    mock = serve(wf('w', { status: 'active' }));
    await result.toggleStatus(wf('w', { status: 'paused' }));
    expect(urlOf(mock)).toBe('/api/v1/workflows/w/enable');

    mock = serve(wf('w', { status: 'active' }));
    await result.toggleStatus(wf('w', { status: 'draft' }));
    expect(urlOf(mock)).toBe('/api/v1/workflows/w/enable');
  });

  it('loads a graph onto the canvas and clears the dirty flag', () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflow());
    store.markDirty();
    const loaded = result.editDefinition(graph());
    expect(loaded.nodes).toHaveLength(2);
    expect(store.dirty).toBe(false);
    expect(result.editDefinition(null)).toEqual({ nodes: [], edges: [] });
  });

  it('mirrors the store status splits and the demo flag', () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflow());
    store.workflows = [
      wf('a', { status: 'active' }),
      wf('b', { status: 'paused' }),
      wf('c', { status: 'draft', demo: true })
    ];
    expect(result.activeWorkflows.value.map((item) => item.id)).toEqual(['a']);
    expect(result.pausedWorkflows.value.map((item) => item.id)).toEqual(['b']);
    expect(result.draftWorkflows.value.map((item) => item.id)).toEqual(['c']);
    expect(result.hasDemoData.value).toBe(true);
    expect(result.loading.value).toBe(false);
    expect(result.saving.value).toBe(false);
  });

  it('keeps working offline by falling back to the seeded demo rows', async () => {
    offline();
    const { result } = withSetup(() => useWorkflow());
    const rows = await result.loadWorkflows();
    expect(rows.length).toBeGreaterThan(0);
    expect(result.hasDemoData.value).toBe(true);
    expect(result.error.value).toBeNull();
  });
});

/* -------------------------------------------------------- useWorkflowBuilder */

describe('useWorkflowBuilder canvas composable', () => {
  it('maps every connect refusal onto a toast key', () => {
    expect(CONNECT_PROBLEM_KEYS).toEqual({
      'missing-node': 'workflow.connect.missingNode',
      'self-loop': 'workflow.connect.selfLoop',
      duplicate: 'workflow.connect.duplicate',
      'branch-full': 'workflow.connect.branchFull'
    });
  });

  it('resolves the free branch of a condition and refuses a third one', () => {
    expect(resolveBranch(graph(), 'a1')).toBeUndefined();
    expect(resolveBranch(graph(), 'ghost')).toBeUndefined();
    const def = branching();
    expect(resolveBranch(def, 'c1', 'false')).toBe('false');
    expect(resolveBranch({ nodes: def.nodes, edges: [] }, 'c1')).toBe('true');
    const trueOnly = {
      nodes: def.nodes,
      edges: def.edges.filter((edge) => edge.branch !== 'false')
    };
    expect(resolveBranch(trueOnly, 'c1')).toBe('false');
    expect(resolveBranch(def, 'c1')).toBeNull();
  });

  it('loads a workflow definition onto the canvas or starts blank', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    expect(result.initCanvas(wf('wf-1')).nodes).toHaveLength(2);
    expect(result.nodeCount.value).toBe(2);
    expect(result.triggerKind.value).toBe('message_received');
    expect(result.triggerNode.value?.id).toBe('t1');
    result.clearCanvas();
    expect(result.definition.value).toEqual(emptyDefinition());
    expect(result.initCanvas(null)).toEqual(emptyDefinition());
  });

  it('adds nodes through the palette and through a canvas drop', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    result.initCanvas(null);
    const added = result.addNode('send_message');
    expect(added.kind).toBe('action');
    expect(result.selectedNodeId.value).toBe(added.id);
    expect(result.dirty.value).toBe(true);

    const dropped = result.addNodeAt('add_tag', { x: 120, y: 80 });
    expect(dropped.position).toEqual({ x: 120, y: 80 });
    expect(result.missingFor(dropped)).toEqual(['tag']);
    expect(result.nodeCount.value).toBe(2);
    expect(result.incompleteNodeIds.value).toContain(dropped.id);
    expect(result.canSave.value).toBe(false);
  });

  it('edits node metadata and config through the property panel helpers', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    result.selectNode('a1');
    expect(result.selectedNode.value?.id).toBe('a1');
    result.renameNode('a1', 'Welcome SMS');
    expect(result.definition.value.nodes[1].name).toBe('Welcome SMS');
    result.updateNodeConfig('a1', { template: 'Habari', useAi: true });
    expect(result.definition.value.nodes[1].config.template).toBe('Habari');
    result.updateNode('a1', { errorStrategy: 'retry', retries: 3 });
    expect(result.definition.value.nodes[1].errorStrategy).toBe('retry');
    expect(result.definition.value.nodes[1].retries).toBe(3);
    result.removeNode('a1');
    expect(result.nodeCount.value).toBe(1);
    expect(result.selectedNode.value).toBeNull();
  });

  it('describes the field schema and the missing keys for a node', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    expect(result.fieldsForNode(null)).toEqual([]);
    expect(result.missingFor(null)).toEqual([]);
    const blank = createNode('send_message', ORIGIN, 'a1');
    expect(result.fieldsForNode(blank).map((field) => field.key)).toEqual([
      'channel',
      'template',
      'useAi'
    ]);
    expect(result.missingFor(blank)).toEqual(['template']);
    blank.config.template = 'Hi';
    expect(result.missingFor(blank)).toEqual([]);
  });

  it('moves a single node and a multi-select drag batch', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    result.moveNode('a1', { x: 700, y: 90 });
    expect(result.definition.value.nodes[1].position).toEqual({ x: 700, y: 90 });
    result.moveNodes({ t1: { x: 5, y: 5 }, a1: { x: 6, y: 6 } });
    expect(result.definition.value.nodes[0].position).toEqual({ x: 5, y: 5 });
    expect(result.definition.value.nodes[1].position).toEqual({ x: 6, y: 6 });
  });

  it('accepts a legal connection and returns the new edge id', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, branching());
    const extra = result.addNode('add_tag');
    const outcome = result.connectNodes('a1', extra.id);
    expect(outcome.ok).toBe(true);
    expect(outcome.problem).toBeNull();
    expect(outcome.edgeId).toBeTruthy();
    expect(result.edgeCount.value).toBe(4);
  });

  it('refuses a missing node, a self loop and a duplicate edge', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, branching());
    expect(result.connectNodes('t1', 'ghost')).toEqual({
      ok: false,
      problem: 'missing-node',
      edgeId: null
    });
    expect(result.connectNodes('t1', 't1')).toEqual({
      ok: false,
      problem: 'self-loop',
      edgeId: null
    });
    expect(result.connectNodes('t1', 'c1')).toEqual({
      ok: false,
      problem: 'duplicate',
      edgeId: null
    });
    expect(result.edgeCount.value).toBe(3);
  });

  it('auto labels condition branches and refuses a third one', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, {
      nodes: [
        createNode('message_received', ORIGIN, 't1'),
        createNode('has_tag', { x: 300, y: 40 }, 'c1'),
        createNode('add_tag', { x: 560, y: 40 }, 'a1'),
        createNode('add_tag', { x: 560, y: 200 }, 'a2'),
        createNode('add_tag', { x: 560, y: 360 }, 'a3')
      ],
      edges: [createEdge('t1', 'c1')]
    });
    expect(result.connectNodes('c1', 'a1').ok).toBe(true);
    expect(result.definition.value.edges[1].branch).toBe('true');
    expect(result.connectNodes('c1', 'a2').ok).toBe(true);
    expect(result.definition.value.edges[2].branch).toBe('false');
    expect(result.connectNodes('c1', 'a3')).toEqual({
      ok: false,
      problem: 'branch-full',
      edgeId: null
    });
    expect(result.connectNodes('c1', 'a1', 'true')).toEqual({
      ok: false,
      problem: 'duplicate',
      edgeId: null
    });
    expect(result.edgeCount.value).toBe(3);
  });

  it('disconnects an edge by id', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, branching());
    result.disconnectNodes(result.definition.value.edges[2].id);
    expect(result.edgeCount.value).toBe(2);
    expect(result.dirty.value).toBe(true);
  });

  it('rearranges the canvas and previews a layout without touching the store', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    result.moveNode('a1', { x: 900, y: 900 });
    const laid = result.autoArrange();
    expect(laid.nodes[1].position.x).toBe(ORIGIN.x + 260);
    const messy: WorkflowDefinition = {
      nodes: [createNode('message_received', { x: 900, y: 900 }, 't1')],
      edges: []
    };
    const preview = result.previewLayout(messy);
    expect(preview.nodes[0].position).toEqual(ORIGIN);
    expect(messy.nodes[0].position).toEqual({ x: 900, y: 900 });
  });

  it('validates locally first so the canvas highlights instantly', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    expect(result.validateLocal().valid).toBe(true);
    expect(result.isValid.value).toBe(true);
    expect(result.issues.value).toEqual([]);

    onCanvas(result, { nodes: [createNode('send_message', ORIGIN, 'a1')], edges: [] });
    const broken = result.validateLocal();
    expect(broken.valid).toBe(false);
    expect(broken.issues.map((item) => item.code)).toContain('NO_TRIGGER');
    expect(result.validationLocal.value).toEqual(broken);
    expect(broken.issues.some((item) => item.nodeId === 'a1')).toBe(true);

    /* The store pass is what paints nodes, and it survives a dead backend. */
    hardFail(500);
    await expect(result.validateFlow()).resolves.toEqual(broken);
    expect(result.isValid.value).toBe(false);
    expect(result.issueNodeIds.value).toContain('a1');
    expect(result.canSave.value).toBe(false);
  });

  it('groups issues per node and merges in the missing config badges', () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    store.validation = {
      valid: false,
      issues: [
        { code: 'CYCLE', messageKey: 'workflow.issue.CYCLE', nodeId: 'a1' },
        { code: 'EMPTY', messageKey: 'workflow.issue.EMPTY' }
      ]
    };
    expect(result.nodeIssues.value.a1).toHaveLength(1);
    expect(result.nodeIssues.value.t1).toBeUndefined();
    expect(result.issues.value).toHaveLength(2);
    store.patchConfig('a1', { template: '' });
    expect(result.incompleteNodeIds.value).toEqual(['a1']);
    expect(result.problemNodeIds.value).toEqual(['a1']);
    expect(result.canSave.value).toBe(false);
  });

  it('summarises the graph for the builder header', () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, branching());
    expect(result.graphSummary.value).toEqual({
      nodes: 4,
      edges: 3,
      triggers: 1,
      conditions: 1,
      actions: 2,
      depth: 3
    });
  });

  it('runs the local rules and then asks the server', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    const mock = serve({ valid: true, issues: [] });
    await expect(result.validateFlow()).resolves.toEqual({ valid: true, issues: [] });
    expect(urlOf(mock)).toBe('/api/v1/workflows/validate');
    expect(result.validation.value.valid).toBe(true);
    expect(result.validationLocal.value.valid).toBe(true);
  });

  it('still highlights the canvas when the server validation call fails', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, { nodes: [createNode('send_message', ORIGIN, 'a1')], edges: [] });
    hardFail(500);
    const outcome = await result.validateFlow();
    expect(outcome.valid).toBe(false);
    expect(result.validationLocal.value).toEqual(outcome);
  });

  it('refuses to publish an invalid graph as active', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, { nodes: [createNode('send_message', ORIGIN, 'a1')], edges: [] });
    const mock = serve(wf('new'));
    await expect(result.save({ name: 'Broken', status: 'active' })).resolves.toBeNull();
    expect(callsOf(mock)).toBe(0);
  });

  it('saves an invalid graph as a draft so work is never lost', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, { nodes: [createNode('send_message', ORIGIN, 'a1')], edges: [] });
    const mock = serve(wf('new', { status: 'draft' }));
    await expect(result.save({ name: 'Wip' })).resolves.toMatchObject({ id: 'new' });
    expect(urlOf(mock)).toBe('/api/v1/workflows');
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.status).toBe('draft');
    expect(body.description).toBe('');
    expect(body.definition.nodes).toHaveLength(1);
  });

  it('updates in place when the canvas was opened from an existing workflow', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    result.initCanvas(wf('wf-1'));
    const mock = serve(wf('wf-1', { name: 'Saved' }));
    await expect(
      result.save({ id: 'wf-1', name: 'Saved', description: 'd', status: 'active' })
    ).resolves.toMatchObject({ name: 'Saved' });
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-1');
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ name: 'Saved', description: 'd', status: 'active' });
  });

  it('reports a failed save as null and surfaces the store saving flag', async () => {
    const { result } = withSetup(() => useWorkflowBuilder());
    onCanvas(result, graph());
    hardFail(500);
    await expect(result.save({ name: 'x', status: 'active' })).resolves.toBeNull();
    expect(result.saving.value).toBe(false);
  });
});

/* ------------------------------------------------------- useWorkflowMonitor */

describe('useWorkflowMonitor run composable', () => {
  it('doubles the probe interval on every failure and caps it at 30s', () => {
    expect(nextPollInterval(0)).toBe(RUN_POLL_INTERVAL_MS);
    expect(nextPollInterval(-1)).toBe(RUN_POLL_INTERVAL_MS);
    expect(nextPollInterval(1)).toBe(4000);
    expect(nextPollInterval(2)).toBe(8000);
    expect(nextPollInterval(3)).toBe(16000);
    expect(nextPollInterval(4)).toBe(RUN_POLL_MAX_INTERVAL_MS);
    expect(nextPollInterval(9)).toBe(RUN_POLL_MAX_INTERVAL_MS);
  });

  it('builds run params from the scope, the status filter and the date range', () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    expect(result.runParams()).toEqual({ limit: WORKFLOW_RUN_PAGE_SIZE, offset: 0 });
    expect(result.runParams(20)).toEqual({ limit: WORKFLOW_RUN_PAGE_SIZE, offset: 20 });
    result.setWorkflowScope('wf-1');
    result.statusFilter.value = 'failed';
    result.setDateRange(100, 200);
    expect(result.runParams(40)).toEqual({
      limit: WORKFLOW_RUN_PAGE_SIZE,
      offset: 40,
      workflowId: 'wf-1',
      status: 'failed',
      from: 100,
      to: 200
    });
    result.setWorkflowScope(null);
    result.setDateRange(null, null);
    expect(result.runParams()).toEqual({
      limit: WORKFLOW_RUN_PAGE_SIZE,
      offset: 0,
      status: 'failed'
    });
  });

  it('reads the cross workflow feed when no scope is selected', async () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    const mock = serve(pagedRuns([run('r1')], 1));
    await expect(result.loadRuns()).resolves.toHaveLength(1);
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs?limit=' + WORKFLOW_RUN_PAGE_SIZE + '&offset=0');
    expect(result.runs.value.map((item) => item.id)).toEqual(['r1']);
    expect(result.runsTotal.value).toBe(1);
    expect(result.refresh).toBe(result.loadRuns);
  });

  it('reads the per workflow feed and keeps the status filter in the query', async () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    result.setWorkflowScope('wf-1');
    const mock = serve(pagedRuns([]));
    await result.filterStatus('running');
    expect(urlOf(mock)).toBe(
      '/api/v1/workflows/wf-1/runs?status=running&limit=' + WORKFLOW_RUN_PAGE_SIZE + '&offset=0'
    );
    expect(result.statusFilter.value).toBe('running');
  });

  it('pages from the number of runs already loaded', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    store.runs = [run('r1'), run('r2')];
    store.runsHasMore = true;
    const mock = serve(pagedRuns([run('r3')], 3, false));
    await result.loadMoreRuns();
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs?limit=' + WORKFLOW_RUN_PAGE_SIZE + '&offset=2');
    expect(store.runs).toHaveLength(3);
    expect(result.runsHasMore.value).toBe(false);
  });

  it('never pages when the current page said there is nothing left', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    store.runs = [run('r1')];
    store.runsHasMore = false;
    const mock = serve(pagedRuns([]));
    await result.loadMoreRuns();
    expect(callsOf(mock)).toBe(0);
  });

  it('drops the paging keys when it asks for stats', async () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    const payload = {
      total: 4,
      succeeded: 3,
      failed: 1,
      stopped: 0,
      running: 0,
      successRate: 75,
      averageDurationMs: 900
    };
    const mock = serve(payload);
    await expect(result.loadStats()).resolves.toEqual(payload);
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/stats');
    expect(result.runStats.value).toEqual(payload);

    result.setWorkflowScope('wf-1');
    result.statusFilter.value = 'failed';
    const scoped = serve(payload);
    await result.loadStats();
    expect(urlOf(scoped)).toBe('/api/v1/workflow-runs/stats?workflowId=wf-1&status=failed');
  });

  it('opens, stops and reruns through the run endpoints', async () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    let mock = serve(run('r1'));
    await expect(result.openRun('r1')).resolves.toMatchObject({ id: 'r1' });
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/r1');
    expect(result.currentRun.value?.id).toBe('r1');

    mock = serve(run('r1', { status: 'stopped' }));
    await result.stopRun('r1');
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/r1/stop');
    expect(result.currentRun.value?.status).toBe('stopped');

    mock = serve(run('r2', { status: 'running' }));
    await result.rerun('wf-welcome');
    expect(urlOf(mock)).toBe('/api/v1/workflows/wf-welcome/runs');
  });

  it('formats a duration through the shared helper in any locale', () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    expect(result.durationOf(742)).toBe('742 ms');
    expect(result.durationOf(742, 'zh')).toBe('742 毫秒');
    expect(result.durationOf(65000, 'fr')).toBe('1 min 5 s');
    expect(result.durationOf(1500)).toBe(formatDuration(1500));
  });

  it('derives progress, node counts and the live subset from the open run', () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    expect(result.progress.value).toBe(0);
    expect(result.stateCounts.value).toBeNull();
    store.currentRun = run('r1', {
      status: 'running',
      nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'running'), nodeRun('a2', 'pending')]
    });
    store.runs = [store.currentRun, run('r2', { status: 'succeeded' })];
    expect(result.progress.value).toBeCloseTo(1 / 3);
    expect(result.stateCounts.value).toEqual({
      pending: 1,
      running: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0
    });
    expect(result.runningRuns.value.map((item) => item.id)).toEqual(['r1']);
  });

  it('probes on the nominal cadence and backs off after a failed probe', async () => {
    vi.useFakeTimers();
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    store.runs = [run('r1')];
    const mock = serve(pagedRuns([]));

    result.startPolling();
    expect(callsOf(mock)).toBe(0);

    await vi.advanceTimersByTimeAsync(RUN_POLL_INTERVAL_MS);
    expect(callsOf(mock)).toBe(1);
    expect(result.failures.value).toBe(1);

    /* One failure doubles the wait, so nothing is due two seconds later. */
    await vi.advanceTimersByTimeAsync(RUN_POLL_INTERVAL_MS);
    expect(callsOf(mock)).toBe(1);
    expect(result.failures.value).toBe(1);

    await vi.advanceTimersByTimeAsync(RUN_POLL_INTERVAL_MS);
    expect(callsOf(mock)).toBe(2);
    /* An empty feed that was already empty is an answer, not a failure. */
    expect(result.failures.value).toBe(0);

    await vi.advanceTimersByTimeAsync(RUN_POLL_INTERVAL_MS);
    expect(callsOf(mock)).toBe(3);
    expect(result.polling.value).toBe(true);

    result.stopPolling();
    await vi.advanceTimersByTimeAsync(RUN_POLL_MAX_INTERVAL_MS);
    expect(callsOf(mock)).toBe(3);
    expect(result.failures.value).toBe(0);
  });

  it('polls the open run while it is live and parks once it finishes', async () => {
    vi.useFakeTimers();
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    store.currentRun = run('r1', { status: 'running' });
    const mock = serve(run('r1', { status: 'succeeded' }));

    result.syncPollingWithRuns();
    expect(result.polling.value).toBe(true);

    await vi.advanceTimersByTimeAsync(RUN_POLL_INTERVAL_MS);
    expect(urlOf(mock)).toBe('/api/v1/workflow-runs/r1');
    expect(result.currentRun.value?.status).toBe('succeeded');
    expect(result.failures.value).toBe(0);
    expect(result.progress.value).toBe(1);

    /* A finished run has nothing left to change, so the loop parks itself. */
    result.syncPollingWithRuns();
    expect(result.polling.value).toBe(false);
    await vi.advanceTimersByTimeAsync(RUN_POLL_MAX_INTERVAL_MS);
    expect(callsOf(mock)).toBe(1);
  });

  it('cancels the probe loop when the host unmounts', async () => {
    vi.useFakeTimers();
    const host = withSetup(() => useWorkflowMonitor());
    const mock = serve(pagedRuns([run('r1')]));
    host.result.startPolling();
    host.unmount();
    expect(host.result.polling.value).toBe(false);
    await vi.advanceTimersByTimeAsync(RUN_POLL_MAX_INTERVAL_MS * 2);
    expect(callsOf(mock)).toBe(0);
  });

  it('falls back to the demo feed and flags its provenance offline', async () => {
    const { result } = withSetup(() => useWorkflowMonitor());
    offline();
    const rows = await result.loadRuns();
    expect(rows.length).toBeGreaterThan(0);
    expect(result.hasDemoData.value).toBe(true);
    expect(result.error.value).toBeNull();
    expect(result.loading.value).toBe(false);
  });

  it('keeps the rows it already had when a refresh fails hard', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowMonitor());
    store.runs = [run('r1'), run('r2')];
    store.runsTotal = 2;
    const failing = serve(null, false, 500);
    await expect(result.loadRuns()).resolves.toHaveLength(2);
    expect(result.runs.value.map((item) => item.id)).toEqual(['r1', 'r2']);
    expect(result.error.value).toBe('api.500');
    expect(result.loading.value).toBe(false);
    /* apiGet retries a 5xx once before the store gives up. */
    expect(callsOf(failing)).toBe(2);
  });
});
/* ---------------------------------------------------- useWorkflowTemplates */

describe('useWorkflowTemplates library composable', () => {
  it('publishes the scenario filter keys and strips their shared prefix', () => {
    expect(TEMPLATE_SCENARIO_FILTERS).toEqual([
      'workflow.template.scenario.onboarding',
      'workflow.template.scenario.retention',
      'workflow.template.scenario.lifecycle',
      'workflow.template.scenario.marketing',
      'workflow.template.scenario.support'
    ]);
    expect(scenarioSlug(TEMPLATE_SCENARIO_FILTERS[3])).toBe('marketing');
    expect(scenarioSlug('marketing')).toBe('marketing');
  });

  it('reads the template library from the server', async () => {
    const { result } = withSetup(() => useWorkflowTemplates());
    const mock = serve(WORKFLOW_TEMPLATES);
    await expect(result.loadTemplates()).resolves.toHaveLength(WORKFLOW_TEMPLATES.length);
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates');
    expect(result.templates.value.map((item) => item.id)).toEqual(
      WORKFLOW_TEMPLATES.map((item) => item.id)
    );
    expect(result.refresh).toBe(result.loadTemplates);
    expect(result.error.value).toBeNull();
  });

  it('serves the local library when the backend is missing', async () => {
    const { result } = withSetup(() => useWorkflowTemplates());
    offline();
    const loaded = await result.loadTemplates();
    expect(loaded.map((item) => item.id)).toEqual(demoWorkflowTemplates().map((item) => item.id));
    expect(loaded.length).toBe(WORKFLOW_TEMPLATES.length);
    expect(result.loading.value).toBe(false);
    expect(result.error.value).toBeNull();
  });

  it('narrows by complexity and by scenario without a second request', async () => {
    const { result } = withSetup(() => useWorkflowTemplates());
    const mock = serve(WORKFLOW_TEMPLATES);
    await result.loadTemplates();

    const simple = result.filterComplexity('simple');
    expect(simple.map((item) => item.id)).toEqual(
      templatesByComplexity('simple').map((item) => item.id)
    );
    expect(result.complexityFilter.value).toBe('simple');

    /* The two filters intersect, so simple AND retention is an empty shelf. */
    expect(result.filterScenario('retention')).toHaveLength(0);
    expect(result.filterComplexity('all')).toHaveLength(1);
    expect(result.scenarioFilter.value).toBe('retention');
    expect(result.byComplexity('complex').map((item) => item.id)).toEqual(['wf-tpl-autoreply']);

    result.filterScenario('all');
    expect(result.visibleTemplates.value).toHaveLength(WORKFLOW_TEMPLATES.length);
    expect(callsOf(mock)).toBe(1);
  });

  it('sorts the popular shelf by use count without reordering the library', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowTemplates());
    serve(WORKFLOW_TEMPLATES);
    await result.loadTemplates();

    const counts = result.popularTemplates.value.map((item) => item.useCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(result.popularTemplates.value[0].id).toBe('wf-tpl-welcome');
    expect(store.templates.map((item) => item.id)).toEqual(
      WORKFLOW_TEMPLATES.map((item) => item.id)
    );
  });

  it('previews a preset with fresh ids and a cached summary', async () => {
    const { result } = withSetup(() => useWorkflowTemplates());
    serve(WORKFLOW_TEMPLATES);
    await result.loadTemplates();

    result.openPreview('wf-tpl-welcome');
    expect(result.previewId.value).toBe('wf-tpl-welcome');
    expect(result.previewTemplate.value?.nameKey).toBe('workflow.template.welcome.name');
    const definition = result.previewDefinition.value as WorkflowDefinition;
    expect(definition.nodes).toHaveLength(3);
    const preset = WORKFLOW_TEMPLATES.find((item) => item.id === 'wf-tpl-welcome');
    expect(definition.nodes.map((item) => item.id)).not.toEqual(
      (preset?.definition.nodes ?? []).map((item) => item.id)
    );
    expect(definition.edges[0].id).toMatch(/^edge-1-/);

    /* The computed is cached, so a preview never re-instantiates per read. */
    expect(result.previewDefinition.value).toBe(definition);
    expect(result.previewSummary.value).toEqual(summarizeDefinition(definition));
    expect(result.previewSummary.value).toMatchObject({
      nodes: 3,
      edges: 2,
      triggers: 1,
      conditions: 0,
      actions: 2,
      depth: 3
    });

    result.openPreview('wf-tpl-does-not-exist');
    expect(result.previewTemplate.value).toBeNull();
    expect(result.previewDefinition.value).toBeNull();
    expect(result.previewSummary.value).toBeNull();
    result.closePreview();
    expect(result.previewId.value).toBeNull();
  });

  it('copies a preset onto the canvas and refuses an unknown id', () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowTemplates());

    const canvas = result.previewOnCanvas('wf-tpl-autoreply');
    expect(canvas).not.toBeNull();
    expect(store.definition.nodes).toHaveLength(4);
    expect(store.definition.edges).toHaveLength(3);
    expect(store.nodeCount).toBe(4);
    expect(store.triggerKind).toBe('message_received');
    /* Loading a preset is a clean canvas load, not a pending edit. */
    expect(store.dirty).toBe(false);

    expect(result.previewOnCanvas('wf-tpl-does-not-exist')).toBeNull();
    expect(store.definition.nodes).toHaveLength(4);
  });

  it('instantiates a preset into a draft and counts the use locally', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowTemplates());
    serve(WORKFLOW_TEMPLATES);
    await result.loadTemplates();
    const before = store.templates.find((item) => item.id === 'wf-tpl-birthday')?.useCount ?? 0;

    const mock = serve(wf('wf-new', { name: 'Birthday shout' }));
    await expect(result.useTemplate('wf-tpl-birthday', 'Birthday shout')).resolves.toMatchObject({
      id: 'wf-new'
    });
    expect(urlOf(mock)).toBe('/api/v1/workflow-templates/wf-tpl-birthday/instantiate');
    expect(JSON.parse(String(mock.mock.calls[0][1].body))).toEqual({ name: 'Birthday shout' });
    expect(store.templates.find((item) => item.id === 'wf-tpl-birthday')?.useCount).toBe(before + 1);
    expect(store.workflows[0].id).toBe('wf-new');
    expect(result.saving.value).toBe(false);
    expect(result.error.value).toBeNull();
  });

  it('leaves the use count alone when instantiate fails hard', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowTemplates());
    serve(WORKFLOW_TEMPLATES);
    await result.loadTemplates();
    const before = store.templates.find((item) => item.id === 'wf-tpl-welcome')?.useCount ?? 0;

    const failing = serve(null, false, 500);
    await expect(result.useTemplate('wf-tpl-welcome', 'Nope')).resolves.toBeNull();
    expect(store.templates.find((item) => item.id === 'wf-tpl-welcome')?.useCount).toBe(before);
    expect(result.error.value).toBe('api.500');
    expect(result.saving.value).toBe(false);
    expect(store.workflows).toHaveLength(0);
    /* A POST is never retried, so the shelf is not charged twice. */
    expect(callsOf(failing)).toBe(1);
  });

  it('instantiates offline into a local draft and still counts the use', async () => {
    const store = useWorkflowStore();
    const { result } = withSetup(() => useWorkflowTemplates());
    offline();
    await result.loadTemplates();
    const before = store.templates.find((item) => item.id === 'wf-tpl-winback')?.useCount ?? 0;
    const created = await result.useTemplate('wf-tpl-winback', 'Offline copy');
    expect(created?.name).toBe('Offline copy');
    expect(created?.status).toBe('draft');
    expect(store.templates.find((item) => item.id === 'wf-tpl-winback')?.useCount).toBe(before + 1);
    expect(result.error.value).toBeNull();
    await expect(result.useTemplate('wf-tpl-does-not-exist', 'Nope')).resolves.toBeNull();
    expect(result.error.value).toBe('api.404');
  });
});
