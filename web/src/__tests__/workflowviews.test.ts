/**
 * Sprint 12 workflow views.
 *
 * Wiring tests for the six pages of the automation module. Each view is mounted
 * against a real router and a stubbed network edge, so what is asserted is the
 * contract between view, composable, store and api: which endpoint a page asks
 * for, what it paints from the answer, which toast an action produces and where
 * a click navigates. Two backends are used on purpose. A route table answers
 * with known payloads for deterministic assertions, and a rejecting fetch drives
 * every page into the demo fallback, which is the mode a reviewer sees before
 * the workflow engine exists.
 *
 * The pages that can render the graph are mounted at 800px so the canvas takes
 * its list variant. The graph variant lazily imports Vue Flow, which needs a
 * layout engine jsdom does not provide, and the list renderer is the surface a
 * phone gets, so it is the one worth pinning here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import { h, type Component } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showConfirmDialog, showToast } from 'vant';
import ExecutionPath from '../components/workflow/ExecutionPath.vue';
import NodePanel from '../components/workflow/NodePanel.vue';
import NodePropertyPanel from '../components/workflow/NodePropertyPanel.vue';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas.vue';
import BuilderView from '../views/dashboard/workflows/Builder.vue';
import DetailView from '../views/dashboard/workflows/Detail.vue';
import WorkflowHub from '../views/dashboard/workflows/index.vue';
import RunDetailView from '../views/dashboard/workflows/RunDetail.vue';
import RunsView from '../views/dashboard/workflows/Runs.vue';
import TemplatesView from '../views/dashboard/workflows/Templates.vue';
import { createEdge, createNode, summarizeDefinition } from '../lib/workflowGraph';
import { instantiateTemplate, templateById } from '../lib/workflowTemplates';
import { useWorkflowStore } from '../stores/workflow';
import type {
  NodeRun,
  NodeRunState,
  PagedWorkflowRuns,
  PagedWorkflows,
  Workflow,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowTemplate
} from '../types';

/* PART1-MARKER */

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return {
    ...actual,
    showToast: vi.fn(),
    showConfirmDialog: vi.fn(() => Promise.resolve())
  };
});

type Route = [string, unknown];

const WORKFLOWS = '/api/v1/workflows';
const RUNS = '/api/v1/workflow-runs';
const TEMPLATES = '/api/v1/workflow-templates';
const DEMO_HIDDEN_KEY = 'ks-workflow-demo-hidden';
const NOW = new Date(2026, 8, 14, 9, 0).getTime();
const HOUR = 3_600_000;
const DAY = 86_400_000;

const OVERVIEW = { activeWorkflows: 3, todayTriggers: 48, todaySucceeded: 41, todayFailed: 7 };
const SUMMARY = { nodes: 2, edges: 1, triggers: 1, conditions: 0, actions: 1, depth: 2 };
const STATS = {
  total: 12,
  succeeded: 9,
  failed: 2,
  stopped: 1,
  running: 0,
  successRate: 0.75,
  averageDurationMs: 65_000
};

/* ---------------------------------------------------------------- fixtures */

/** trigger -> action, every required setting filled so the graph validates. */
function definitionFixture(): WorkflowDefinition {
  const trigger = createNode('message_received', { x: 0, y: 0 }, 't1');
  const action = createNode('add_tag', { x: 320, y: 0 }, 'a1');
  action.config.tag = 'vip';
  action.name = 'Tag the VIP';
  return { nodes: [trigger, action], edges: [createEdge('t1', 'a1')] };
}

function workflowFixture(patch: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1',
    name: 'Welcome flow',
    description: 'Greets a new customer',
    status: 'active',
    definition: definitionFixture(),
    triggerKind: 'message_received',
    nodeCount: 2,
    todayRuns: 6,
    successRuns: 9,
    failedRuns: 1,
    lastRunAt: NOW - 2 * HOUR,
    createdAt: NOW - DAY,
    updatedAt: NOW,
    ...patch
  };
}

function nodeRunFixture(nodeId: string, state: NodeRunState, patch: Partial<NodeRun> = {}): NodeRun {
  const done = state === 'succeeded' || state === 'failed';
  return {
    nodeId,
    nodeName: nodeId === 'a1' ? 'Tag the VIP' : nodeId.toUpperCase(),
    nodeType: nodeId === 'a1' ? 'add_tag' : 'message_received',
    state,
    startedAt: state === 'pending' ? null : NOW,
    endedAt: done ? NOW + 742 : null,
    durationMs: done ? 742 : 0,
    attempts: 1,
    input: nodeId === 'a1' ? { tag: 'vip' } : {},
    output: {},
    ...patch
  };
}

function runFixture(patch: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 'run-1',
    workflowId: 'wf-1',
    workflowName: 'Welcome flow',
    status: 'succeeded',
    triggerReason: 'Message received',
    startedAt: NOW,
    endedAt: NOW + 900,
    durationMs: 900,
    nodeRuns: [nodeRunFixture('t1', 'succeeded'), nodeRunFixture('a1', 'succeeded')],
    ...patch
  };
}

function templateFixture(patch: Partial<WorkflowTemplate> = {}): WorkflowTemplate {
  return {
    id: 'wf-tpl-1',
    nameKey: 'workflow.template.welcome.name',
    descriptionKey: 'workflow.template.welcome.desc',
    scenarioKey: 'workflow.template.scenario.onboarding',
    complexity: 'simple',
    useCount: 48,
    definition: definitionFixture(),
    ...patch
  };
}

function pagedWorkflows(items: Workflow[], hasMore = false): PagedWorkflows {
  return { workflows: items, total: items.length, hasMore };
}

function pagedRuns(items: WorkflowRun[], hasMore = false): PagedWorkflowRuns {
  return { runs: items, total: items.length, hasMore };
}

/* ------------------------------------------------------------------ network */

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, code: 'OK', message: '', data })
  } as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({
      success: false,
      code: 'HTTP_' + status,
      message: 'boom',
      data: null
    })
  } as Response;
}

/**
 * Answers by "METHOD url-fragment"; the first match wins, so callers list the
 * most specific route first. Anything unmatched answers 404, which the api layer
 * reads as a missing backend and degrades to the demo fixtures.
 */
function backend(routes: Route[]): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((url: unknown, init?: { method?: string }) => {
    const key = (init?.method ?? 'GET').toUpperCase() + ' ' + String(url);
    const hit = routes.find(([needle]) => key.includes(needle));
    return Promise.resolve(hit ? jsonResponse(hit[1]) : errorResponse(404));
  });
}

function offlineFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new Error('offline'));
}

function urls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}

function called(mock: ReturnType<typeof vi.fn>, needle: string): boolean {
  return mock.mock.calls.some((call) => {
    const init = (call[1] ?? {}) as { method?: string };
    const key = (init.method ?? 'GET').toUpperCase() + ' ' + String(call[0]);
    return key.includes(needle);
  });
}

function bodyOf(mock: ReturnType<typeof vi.fn>, needle: string): Record<string, unknown> {
  const call = mock.mock.calls.find((item) => String(item[0]).includes(needle));
  const init = (call?.[1] ?? {}) as { body?: unknown };
  return JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
}

function lastToast(): string {
  const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  const last = calls[calls.length - 1];
  return last ? String(last[0]) : '';
}

function toasts(): string[] {
  const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.map((call) => String(call[0]));
}

/* -------------------------------------------------------------------- mount */

const stub = { render: () => h('div') };
const liveWrappers: VueWrapper[] = [];

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/dashboard/workflows', component: WorkflowHub },
      { path: '/dashboard/workflows/builder', component: BuilderView },
      { path: '/dashboard/workflows/runs', component: RunsView },
      { path: '/dashboard/workflows/runs/:runId', component: RunDetailView },
      { path: '/dashboard/workflows/templates', component: TemplatesView },
      { path: '/dashboard/workflows/:id', component: DetailView }
    ]
  });
}

/** Narrow viewport, so the canvas picks the list variant instead of Vue Flow. */
function setWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
}

async function mountView(
  component: Component,
  path: string,
  fetchMock: ReturnType<typeof vi.fn> = offlineFetch(),
  seedStorage: Record<string, string> = {}
) {
  localStorage.clear();
  for (const key of Object.keys(seedStorage)) localStorage.setItem(key, seedStorage[key]);
  vi.stubGlobal('fetch', fetchMock);
  const pinia: Pinia = createPinia();
  const router = buildRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, { global: { plugins: [pinia, router, Vant] } });
  liveWrappers.push(wrapper);
  await flushPromises();
  return { wrapper, router, pinia, store: useWorkflowStore(pinia) };
}

/** Picks a button by its translated label and fails loudly when it is missing. */
function buttonByLabel(root: VueWrapper | DOMWrapper<Element>, label: string) {
  const scope = root as unknown as VueWrapper;
  const found = scope.findAll('button').filter((item) => item.text().trim() === label);
  expect(found.length, 'expected one button labelled ' + label).toBe(1);
  return found[0];
}

function hubRoutes(items: Workflow[], extra: Route[] = [], hasMore = false): Route[] {
  return [
    ['GET ' + WORKFLOWS + '/overview', OVERVIEW],
    ...extra,
    ['GET ' + WORKFLOWS + '?', pagedWorkflows(items, hasMore)]
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  setWidth(800);
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  setWidth(1024);
});

/* ---------------------------------------------------------------------- hub */

describe('Workflow hub', () => {
  it('renders the KPI row, the workflow grid and the page meta', async () => {
    const fetchMock = backend(
      hubRoutes([workflowFixture(), workflowFixture({ id: 'wf-2', name: 'Win-back', status: 'draft' })])
    );
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    expect(wrapper.find('.wf__title').text()).toBe('Automation workflows');
    expect(document.title).toBe('Automation - KiliSocial');
    expect(wrapper.findAll('.wf__kpi')).toHaveLength(4);
    expect(wrapper.findAll('.wf__kpi-label').map((node) => node.text())).toEqual([
      'Active workflows',
      'Triggered today',
      'Succeeded today',
      'Failed today'
    ]);
    expect(wrapper.findAll('.wf__kpi-value').map((node) => node.text())).toEqual([
      '3',
      '48',
      '41',
      '7'
    ]);
    expect(wrapper.findAll('[data-workflow-id]').map((node) => node.attributes('data-workflow-id'))).toEqual([
      'wf-1',
      'wf-2'
    ]);
    expect(wrapper.find('.wf__count').text()).toBe('2 workflows');
    expect(wrapper.find('.wf__demo').exists()).toBe(false);
    expect(called(fetchMock, 'GET ' + WORKFLOWS + '/overview')).toBe(true);
  });

  it('labels the sample data and remembers when it is dismissed', async () => {
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows');

    expect(wrapper.find('.wf__demo').text()).toContain('Sample data shown below.');
    expect(wrapper.findAll('[data-workflow-id]').length).toBeGreaterThan(0);

    await wrapper.find('.wf__demo button').trigger('click');

    expect(wrapper.find('.wf__demo').exists()).toBe(false);
    expect(localStorage.getItem(DEMO_HIDDEN_KEY)).toBe('1');
  });

  it('keeps the sample notice hidden on the next visit', async () => {
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', offlineFetch(), {
      [DEMO_HIDDEN_KEY]: '1'
    });
    expect(wrapper.find('.wf__demo').exists()).toBe(false);
  });

  it('switches the empty state copy once a filter is applied', async () => {
    const fetchMock = backend(hubRoutes([]));
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    expect(wrapper.find('.wf__empty-title').text()).toBe('No workflows yet');

    await buttonByLabel(wrapper, 'Active').trigger('click');
    await flushPromises();

    expect(wrapper.find('.wf__empty-title').text()).toBe('Nothing matches these filters');
    expect(urls(fetchMock).some((url) => url.includes('status=active'))).toBe(true);
  });

  it('sends the search term as a query parameter and clears it again', async () => {
    const fetchMock = backend(hubRoutes([]));
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    await wrapper.find('#wf-search').setValue('welcome');
    await wrapper.find('.wf__search').trigger('submit');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('query=welcome'))).toBe(true);
    expect(buttonByLabel(wrapper, 'Clear').exists()).toBe(true);

    await buttonByLabel(wrapper, 'Clear').trigger('click');
    await flushPromises();

    const last = urls(fetchMock)[urls(fetchMock).length - 1];
    expect(last).not.toContain('query=welcome');
  });

  it('loads the next page when the list says there is more', async () => {
    const fetchMock = backend(hubRoutes([workflowFixture()], [], true));
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    expect(wrapper.find('.wf__more').exists()).toBe(true);
    await buttonByLabel(wrapper, 'Load more').trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('offset=1'))).toBe(true);
  });

  it('navigates home, to the builder, to the run history and to the templates', async () => {
    const { wrapper, router } = await mountView(
      WorkflowHub,
      '/dashboard/workflows',
      backend(hubRoutes([workflowFixture()]))
    );

    expect(wrapper.find('.wf__link').attributes('href')).toBe('/dashboard/workflows/templates');

    await buttonByLabel(wrapper, 'New workflow').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/builder');

    await router.push('/dashboard/workflows');
    await flushPromises();
    await buttonByLabel(wrapper, 'Run history').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/runs');

    await router.push('/dashboard/workflows');
    await flushPromises();
    await wrapper.find('.wf__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('routes the card actions to the detail, builder and scoped run history', async () => {
    const { wrapper, router } = await mountView(
      WorkflowHub,
      '/dashboard/workflows',
      backend(hubRoutes([workflowFixture()]))
    );
    const card = wrapper.find('[data-workflow-id="wf-1"]');

    await card.findAll('button').filter((item) => item.text().trim() === 'Details')[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/wf-1');

    await router.push('/dashboard/workflows');
    await flushPromises();
    const again = wrapper.find('[data-workflow-id="wf-1"]');
    await again.findAll('button').filter((item) => item.text().trim() === 'Edit')[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/builder?id=wf-1');

    await router.push('/dashboard/workflows');
    await flushPromises();
    const third = wrapper.find('[data-workflow-id="wf-1"]');
    await third.findAll('button').filter((item) => item.text().trim() === 'Runs')[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/runs?workflowId=wf-1');
  });

  it('pauses, duplicates and deletes through the store and reports each outcome', async () => {
    const fetchMock = backend(
      hubRoutes([workflowFixture()], [
        ['POST ' + WORKFLOWS + '/wf-1/disable', workflowFixture({ status: 'paused' })],
        ['POST ' + WORKFLOWS + '/wf-1/duplicate', workflowFixture({ id: 'wf-9' })],
        ['DELETE ' + WORKFLOWS + '/wf-1', null]
      ])
    );
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    await buttonByLabel(wrapper, 'Pause').trigger('click');
    await flushPromises();
    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-1/disable')).toBe(true);
    expect(lastToast()).toBe('Workflow paused');

    await buttonByLabel(wrapper, 'Duplicate').trigger('click');
    await flushPromises();
    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-1/duplicate')).toBe(true);
    expect(lastToast()).toBe('Workflow duplicated');

    // Duplicating appended wf-9, so scope the lookup to the original card.
    await buttonByLabel(wrapper.find('[data-workflow-id="wf-1"]'), 'Delete').trigger('click');
    await flushPromises();
    expect(showConfirmDialog).toHaveBeenCalledTimes(1);
    expect(called(fetchMock, 'DELETE ' + WORKFLOWS + '/wf-1')).toBe(true);
    expect(lastToast()).toBe('Workflow deleted');
  });

  it('activates a draft from the empty state shortcut and from a card', async () => {
    const fetchMock = backend(
      hubRoutes([workflowFixture({ id: 'wf-3', status: 'draft' })], [
        ['POST ' + WORKFLOWS + '/wf-3/enable', workflowFixture({ id: 'wf-3', status: 'active' })]
      ])
    );
    const { wrapper } = await mountView(WorkflowHub, '/dashboard/workflows', fetchMock);

    await buttonByLabel(wrapper, 'Activate').trigger('click');
    await flushPromises();
    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-3/enable')).toBe(true);
    expect(lastToast()).toBe('Workflow activated');
  });
});

/* --------------------------------------------------------------------- runs */

function runRoutes(items: WorkflowRun[], extra: Route[] = []): Route[] {
  return [
    ['GET ' + RUNS + '/stats', STATS],
    ...extra,
    ['GET ' + RUNS + '?', pagedRuns(items)]
  ];
}

describe('Run history', () => {
  it('renders the summary strip and one row per run', async () => {
    const fetchMock = backend(
      runRoutes([runFixture(), runFixture({ id: 'run-2', status: 'failed', durationMs: 1200 })])
    );
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);

    expect(wrapper.find('.wfr__title').text()).toBe('Run history');
    expect(document.title).toBe('Run history - KiliSocial');
    expect(wrapper.find('.wfr__count').text()).toBe('2 runs');
    expect(wrapper.findAll('.wfr__stat strong').map((node) => node.text())).toEqual([
      '12',
      '75%',
      '1m 5s',
      '0'
    ]);
    const rows = wrapper.findAll('.wfr__table tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].attributes('data-status')).toBe('succeeded');
    expect(rows[1].attributes('data-status')).toBe('failed');
    expect(rows[0].find('.wfr__trigger').text()).toBe('Message received');
    expect(wrapper.find('.wfr__demo').exists()).toBe(false);
    expect(called(fetchMock, 'GET ' + RUNS + '/stats')).toBe(true);
  });

  it('only offers stop for a run that is still going', async () => {
    const fetchMock = backend(
      runRoutes([runFixture({ id: 'run-9', status: 'running', endedAt: null, durationMs: 0 })], [
        ['POST ' + RUNS + '/run-9/stop', runFixture({ id: 'run-9', status: 'stopped' })]
      ])
    );
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);
    const row = wrapper.find('.wfr__table tbody tr');
    const buttons = row.findAll('.wfr__btn--sm');

    expect(buttons[1].attributes('disabled')).toBeUndefined();
    await buttons[1].trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + RUNS + '/run-9/stop')).toBe(true);
    expect(lastToast()).toBe('Run stopped');
  });

  it('refuses to stop a finished run and never calls the endpoint', async () => {
    const fetchMock = backend(runRoutes([runFixture()]));
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);
    const buttons = wrapper.find('.wfr__table tbody tr').findAll('.wfr__btn--sm');

    expect(buttons[1].attributes('disabled')).toBeDefined();
    await buttons[1].trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + RUNS + '/run-1/stop')).toBe(false);
    expect(toasts()).toEqual([]);
  });

  it('starts a new run from a history row', async () => {
    const fetchMock = backend(
      runRoutes([runFixture()], [
        ['POST ' + WORKFLOWS + '/wf-1/runs', runFixture({ id: 'run-7' })]
      ])
    );
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);

    await buttonByLabel(wrapper, 'Run again').trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-1/runs')).toBe(true);
    expect(lastToast()).toBe('New run started');
  });

  it('opens a run and its workflow from the row', async () => {
    const { wrapper, router } = await mountView(
      RunsView,
      '/dashboard/workflows/runs',
      backend(runRoutes([runFixture()]))
    );

    await buttonByLabel(wrapper, 'Open run').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/runs/run-1');

    await router.push('/dashboard/workflows/runs');
    await flushPromises();
    await wrapper.find('.wfr__link').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/wf-1');
  });

  it('narrows the feed to one workflow and lifts the scope again', async () => {
    const fetchMock = backend([
      ['GET ' + RUNS + '/stats', STATS],
      ['GET ' + WORKFLOWS + '/wf-1/runs', pagedRuns([runFixture()])],
      ['GET ' + RUNS + '?', pagedRuns([runFixture(), runFixture({ id: 'run-2' })])]
    ]);
    const { wrapper } = await mountView(
      RunsView,
      '/dashboard/workflows/runs?workflowId=wf-1',
      fetchMock
    );

    expect(wrapper.find('.wfr__scope').exists()).toBe(true);
    expect(wrapper.find('.wfr__scope').text()).toContain('Filtered to one workflow');
    expect(called(fetchMock, 'GET ' + WORKFLOWS + '/wf-1/runs')).toBe(true);

    await buttonByLabel(wrapper, 'Show all workflows').trigger('click');
    await flushPromises();

    expect(wrapper.find('.wfr__scope').exists()).toBe(false);
    expect(called(fetchMock, 'GET ' + RUNS + '?')).toBe(true);
  });

  it('filters by status from the tab strip', async () => {
    const fetchMock = backend(runRoutes([runFixture({ id: 'run-3', status: 'failed' })]));
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);

    await buttonByLabel(wrapper, 'Failed').trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('status=failed'))).toBe(true);
    expect(called(fetchMock, 'GET ' + RUNS + '/stats')).toBe(true);
  });

  it('turns the local date inputs into an epoch range', async () => {
    const fetchMock = backend(runRoutes([]));
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);
    const inputs = wrapper.findAll('.wfr__input');

    await inputs[0].setValue('2026-09-01');
    await inputs[1].setValue('2026-09-02');
    await wrapper.find('.wfr__filters').trigger('submit');
    await flushPromises();

    const from = new Date(2026, 8, 1).getTime();
    const to = new Date(2026, 8, 2).getTime() + DAY - 1;
    const last = urls(fetchMock)[urls(fetchMock).length - 1];
    expect(last).toContain('from=' + from);
    expect(last).toContain('to=' + to);

    await buttonByLabel(wrapper, 'Clear').trigger('click');
    await flushPromises();
    const cleared = urls(fetchMock)[urls(fetchMock).length - 1];
    expect(cleared).not.toContain('from=');
  });

  it('shows the run empty state and the sample notice when offline', async () => {
    const fetchMock = backend(runRoutes([]));
    const { wrapper } = await mountView(RunsView, '/dashboard/workflows/runs', fetchMock);
    expect(wrapper.find('.wfr__empty-title').text()).toBe('No runs yet');
    expect(wrapper.find('.wfr__table-wrap').exists()).toBe(false);

    const offline = await mountView(RunsView, '/dashboard/workflows/runs');
    expect(offline.wrapper.find('.wfr__demo').text()).toContain('Sample runs.');
    expect(offline.wrapper.findAll('.wfr__table tbody tr').length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- templates */

/**
 * The preview dialog resolves a preset through lib/workflowTemplates rather
 * than through the fetched rows, so the expected shape summary is derived the
 * same way instead of being hand counted.
 */
const welcomeTemplate = templateById('wf-tpl-welcome');
const WELCOME_SUMMARY = welcomeTemplate
  ? summarizeDefinition(instantiateTemplate(welcomeTemplate))
  : null;

/** Three of the five shipped presets: enough to exercise every filter. */
const TEMPLATE_ROWS: WorkflowTemplate[] = [
  templateFixture({
    id: 'wf-tpl-welcome',
    nameKey: 'workflow.template.welcome.name',
    descriptionKey: 'workflow.template.welcome.desc',
    scenarioKey: 'workflow.template.scenario.onboarding',
    complexity: 'simple',
    useCount: 48
  }),
  templateFixture({
    id: 'wf-tpl-birthday',
    nameKey: 'workflow.template.birthday.name',
    descriptionKey: 'workflow.template.birthday.desc',
    scenarioKey: 'workflow.template.scenario.lifecycle',
    complexity: 'simple',
    useCount: 22
  }),
  templateFixture({
    id: 'wf-tpl-autoreply',
    nameKey: 'workflow.template.autoreply.name',
    descriptionKey: 'workflow.template.autoreply.desc',
    scenarioKey: 'workflow.template.scenario.support',
    complexity: 'complex',
    useCount: 39
  })
];

function templateRoutes(extra: Route[] = []): Route[] {
  return [['GET ' + TEMPLATES, TEMPLATE_ROWS], ...extra];
}

function cardNames(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.tc__name').map((node) => node.text());
}

describe('Workflow templates', () => {
  it('renders the library with the complexity tabs and the scenario filter', async () => {
    const fetchMock = backend(templateRoutes());
    const { wrapper } = await mountView(TemplatesView, '/dashboard/workflows/templates', fetchMock);

    expect(wrapper.find('.wft__title').text()).toBe('Workflow templates');
    expect(document.title).toBe('Workflow templates - KiliSocial');
    expect(called(fetchMock, 'GET ' + TEMPLATES)).toBe(true);
    expect(wrapper.findAll('.wft__tab')).toHaveLength(4);
    /* The first tab counts the fetched rows, the rest count the shipped library. */
    expect(wrapper.findAll('.wft__tab-count').map((node) => node.text())).toEqual(['3', '2', '2', '1']);
    expect(cardNames(wrapper)).toEqual(['New customer welcome', 'Birthday greeting', 'Automatic reply']);
    expect(wrapper.findAll('.wft__select option').map((node) => node.attributes('value'))).toEqual([
      'all',
      'onboarding',
      'retention',
      'lifecycle',
      'marketing',
      'support'
    ]);
    expect(wrapper.find('.wft__empty').exists()).toBe(false);
  });

  it('narrows in memory, so filtering never refetches', async () => {
    const fetchMock = backend(templateRoutes());
    const { wrapper } = await mountView(TemplatesView, '/dashboard/workflows/templates', fetchMock);

    await wrapper.findAll('.wft__tab')[3].trigger('click');
    expect(cardNames(wrapper)).toEqual(['Automatic reply']);
    expect(wrapper.findAll('.wft__tab')[3].attributes('aria-selected')).toBe('true');

    await wrapper.findAll('.wft__tab')[0].trigger('click');
    await wrapper.find('.wft__select').setValue('lifecycle');
    expect(cardNames(wrapper)).toEqual(['Birthday greeting']);

    await wrapper.find('.wft__select').setValue('marketing');
    expect(wrapper.find('.wft__empty').text()).toBe('No template matches these filters');
    expect(urls(fetchMock)).toHaveLength(1);
  });

  it('sorts by the most used without dropping the narrowing', async () => {
    const fetchMock = backend(templateRoutes());
    const { wrapper } = await mountView(TemplatesView, '/dashboard/workflows/templates', fetchMock);
    const popular = buttonByLabel(wrapper, 'Most used');

    expect(popular.attributes('aria-pressed')).toBe('false');
    await popular.trigger('click');
    expect(popular.attributes('aria-pressed')).toBe('true');
    expect(cardNames(wrapper)).toEqual(['New customer welcome', 'Automatic reply', 'Birthday greeting']);

    await popular.trigger('click');
    expect(cardNames(wrapper)).toEqual(['New customer welcome', 'Birthday greeting', 'Automatic reply']);
  });

  it('previews a preset, blocks a blank name and creates the draft', async () => {
    const fetchMock = backend(
      templateRoutes([
        ['POST ' + TEMPLATES + '/wf-tpl-welcome/instantiate', workflowFixture({ id: 'wf-new' })]
      ])
    );
    const { wrapper, router } = await mountView(TemplatesView, '/dashboard/workflows/templates', fetchMock);

    await wrapper.findAll('.tc__btn')[0].trigger('click');

    expect(wrapper.find('.wft__dialog-title').text()).toBe('New customer welcome');
    expect(wrapper.find('.wft__dialog-sub').text()).toBe('Template preview');
    expect(wrapper.findAll('.wft__summary-item')).toHaveLength(6);
    const expected = WELCOME_SUMMARY
      ? [
          WELCOME_SUMMARY.nodes,
          WELCOME_SUMMARY.triggers,
          WELCOME_SUMMARY.conditions,
          WELCOME_SUMMARY.actions,
          WELCOME_SUMMARY.edges,
          WELCOME_SUMMARY.depth
        ].map(String)
      : [];
    expect(expected).toHaveLength(6);
    expect(wrapper.findAll('.wft__summary-item dd').map((node) => node.text())).toEqual(expected);
    expect(wrapper.find('.wft__canvas').exists()).toBe(true);
    expect((wrapper.find('.wft__input').element as HTMLInputElement).value).toBe('New customer welcome');

    const create = buttonByLabel(wrapper, 'Create draft');
    await wrapper.find('.wft__input').setValue('   ');
    expect(create.attributes('disabled')).toBeDefined();

    await wrapper.find('.wft__input').setValue('Welcome copy');
    await create.trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + TEMPLATES + '/wf-tpl-welcome/instantiate')).toBe(true);
    expect(bodyOf(fetchMock, '/instantiate')).toEqual({ name: 'Welcome copy' });
    expect(lastToast()).toBe('Draft created from the template');
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/builder?id=wf-new');
    expect(wrapper.find('.wft__overlay').exists()).toBe(false);
  });

  it('drops a preset onto the builder canvas without persisting it', async () => {
    const fetchMock = backend(templateRoutes());
    const { wrapper, router, store } = await mountView(
      TemplatesView,
      '/dashboard/workflows/templates',
      fetchMock
    );

    await wrapper.findAll('.tc__btn.is-primary')[0].trigger('click');
    await flushPromises();

    expect(lastToast()).toBe('Template loaded onto the canvas');
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/builder');
    expect(store.definition.nodes.length).toBeGreaterThan(0);
    expect(called(fetchMock, 'POST')).toBe(false);
  });

  it('serves the shipped library when the backend is missing', async () => {
    const { wrapper } = await mountView(TemplatesView, '/dashboard/workflows/templates');

    expect(wrapper.findAll('.tc')).toHaveLength(5);
    expect(cardNames(wrapper)).toContain('New customer welcome');
    expect(cardNames(wrapper)).toContain('Automatic reply');
    expect(wrapper.find('.wft__empty').exists()).toBe(false);
  });
});

/* ------------------------------------------------------------------- detail */

/** Summary and runs sit before the bare id, because the route table matches on substring. */
function detailRoutes(
  workflow: Workflow,
  runs: WorkflowRun[] = [runFixture()],
  extra: Route[] = []
): Route[] {
  return [
    ['GET ' + WORKFLOWS + '/wf-1/summary', SUMMARY],
    ['GET ' + WORKFLOWS + '/wf-1/runs', pagedRuns(runs)],
    ...extra,
    ['GET ' + WORKFLOWS + '/wf-1', workflow]
  ];
}

describe('Workflow detail', () => {
  it('paints the lifecycle facts, the shape summary and the recent runs', async () => {
    const fetchMock = backend(detailRoutes(workflowFixture()));
    const { wrapper } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);
    const facts = wrapper.findAll('.wfd__fact dd');

    expect(wrapper.find('.wfd__title').text()).toBe('Welcome flow');
    expect(document.title).toBe('Workflow detail - KiliSocial');
    expect(wrapper.find('.wfd__badge').attributes('data-status')).toBe('active');
    expect(wrapper.find('.wfd__badge').text()).toBe('Active');
    expect(wrapper.find('.wfd__subtitle').text()).toContain('Trigger: Message received');
    expect(facts).toHaveLength(8);
    expect(facts[0].text()).toBe('Greets a new customer');
    expect(facts[1].text()).toBe('Active');
    expect(facts[5].text()).toBe('6');
    expect(facts[6].text()).toBe('9');
    expect(facts[7].text()).toBe('1');
    expect(wrapper.findAll('.wfd__stat strong').map((node) => node.text())).toEqual([
      '1',
      '2',
      '0',
      '1',
      '1',
      '2'
    ]);
    expect(wrapper.find('.wfd__graph').exists()).toBe(true);
    expect(wrapper.findAll('.wfd__table tbody tr')).toHaveLength(1);
    expect(wrapper.find('.wfd__trigger').text()).toBe('Message received');
    expect(wrapper.find('.wfd__pill').attributes('data-status')).toBe('succeeded');
    expect(called(fetchMock, 'GET ' + WORKFLOWS + '/wf-1/summary')).toBe(true);
    expect(urls(fetchMock).some((url) => url.includes('/wf-1/runs'))).toBe(true);
  });

  it('validates the saved graph locally and never posts to the engine', async () => {
    const fetchMock = backend(detailRoutes(workflowFixture()));
    const { wrapper } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    await buttonByLabel(wrapper, 'Validate').trigger('click');
    await flushPromises();

    expect(lastToast()).toBe('Workflow is valid');
    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/validate')).toBe(false);
  });

  it('counts the problems in an unfinished graph', async () => {
    const broken = definitionFixture();
    broken.nodes[1].config.tag = '';
    const fetchMock = backend(detailRoutes(workflowFixture({ definition: broken })));
    const { wrapper } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    await buttonByLabel(wrapper, 'Validate').trigger('click');
    await flushPromises();

    expect(lastToast()).toBe('1 issues found');
  });

  it('pauses, duplicates and deletes, then routes back to the list', async () => {
    const fetchMock = backend(
      detailRoutes(workflowFixture(), [runFixture()], [
        ['POST ' + WORKFLOWS + '/wf-1/disable', workflowFixture({ status: 'paused' })],
        ['POST ' + WORKFLOWS + '/wf-1/duplicate', workflowFixture({ id: 'wf-2' })],
        ['DELETE ' + WORKFLOWS + '/wf-1', null]
      ])
    );
    const { wrapper, router } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    await buttonByLabel(wrapper, 'Pause').trigger('click');
    await flushPromises();
    expect(lastToast()).toBe('Workflow paused');
    expect(wrapper.find('.wfd__badge').attributes('data-status')).toBe('paused');

    await buttonByLabel(wrapper, 'Duplicate').trigger('click');
    await flushPromises();
    expect(lastToast()).toBe('Workflow duplicated');

    await buttonByLabel(wrapper, 'Delete').trigger('click');
    await flushPromises();
    expect(showConfirmDialog).toHaveBeenCalledTimes(1);
    expect(called(fetchMock, 'DELETE ' + WORKFLOWS + '/wf-1')).toBe(true);
    expect(lastToast()).toBe('Workflow deleted');
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows');
  });

  it('activates a paused workflow and opens the builder for it', async () => {
    const fetchMock = backend(
      detailRoutes(workflowFixture({ status: 'paused' }), [runFixture()], [
        ['POST ' + WORKFLOWS + '/wf-1/enable', workflowFixture({ status: 'active' })]
      ])
    );
    const { wrapper, router } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    expect(wrapper.findAll('button').filter((node) => node.text().trim() === 'Pause')).toHaveLength(0);
    await buttonByLabel(wrapper, 'Activate').trigger('click');
    await flushPromises();
    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-1/enable')).toBe(true);
    expect(lastToast()).toBe('Workflow activated');

    await buttonByLabel(wrapper, 'Edit').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/builder?id=wf-1');
  });

  it('opens a single run and the run history scoped to this workflow', async () => {
    const fetchMock = backend(detailRoutes(workflowFixture()));
    const { wrapper, router } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    await wrapper.find('.wfd__btn--sm').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/runs/run-1');

    await router.push('/dashboard/workflows/wf-1');
    await flushPromises();
    const runs = wrapper.findAll('button').filter((node) => node.text().trim() === 'Runs');
    await runs[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/runs?workflowId=wf-1');
  });

  it('falls back to the run empty copy when nothing has executed', async () => {
    const fetchMock = backend(detailRoutes(workflowFixture(), []));
    const { wrapper } = await mountView(DetailView, '/dashboard/workflows/wf-1', fetchMock);

    expect(wrapper.find('.wfd__table').exists()).toBe(false);
    expect(wrapper.find('.wfd__runs .wfd__hint').text()).toBe('No runs yet');
  });

  it('says when the workflow does not exist and offers the way back', async () => {
    const { wrapper, router } = await mountView(DetailView, '/dashboard/workflows/unknown');

    expect(wrapper.find('.wfd__empty-title').text()).toBe('Workflow not found');
    expect(wrapper.find('.wfd__title').text()).toBe('Workflow');
    expect(wrapper.find('.wfd__facts').exists()).toBe(false);

    await wrapper.find('.wfd__empty .wfd__btn').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows');
  });
});

/* ------------------------------------------------------------------ builder */

function inputValues(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.wfb__input').map((node) => (node.element as HTMLInputElement).value);
}

function issueTexts(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.wfb__issue').map((node) => node.text());
}

function builderRoutes(extra: Route[] = []): Route[] {
  return [['GET ' + WORKFLOWS + '/wf-1', workflowFixture()], ...extra];
}

describe('Workflow builder', () => {
  it('opens a blank canvas, names the page and reports the empty graph', async () => {
    const { wrapper } = await mountView(BuilderView, '/dashboard/workflows/builder', backend([]));

    expect(wrapper.find('.wfb__title').text()).toBe('New workflow');
    expect(document.title).toBe('Workflow builder - KiliSocial');
    expect(wrapper.find('.wfb__subtitle').text()).toContain('0 nodes / 0 links');
    expect(wrapper.findAll('.wfb__tab').map((node) => node.text())).toEqual([
      'Nodes',
      'Canvas',
      'Settings'
    ]);
    expect(issueTexts(wrapper)).toEqual(['The canvas is empty']);
    expect(wrapper.find('.wfb__issues-ok').exists()).toBe(false);
    expect(wrapper.find('.wfb__incomplete').exists()).toBe(false);
    expect(wrapper.find('.wfb__unsaved').exists()).toBe(false);
    expect(inputValues(wrapper)).toEqual(['', '']);
    expect(wrapper.findComponent(NodePanel).exists()).toBe(true);
    expect(wrapper.findComponent(WorkflowCanvas).exists()).toBe(true);
    expect(wrapper.findComponent(NodePropertyPanel).exists()).toBe(true);
  });

  it('refuses to save before the workflow has a name and a node', async () => {
    const fetchMock = backend([['POST ' + WORKFLOWS, workflowFixture({ id: 'wf-new' })]]);
    const { wrapper } = await mountView(BuilderView, '/dashboard/workflows/builder', fetchMock);

    await buttonByLabel(wrapper, 'Save draft').trigger('click');
    await flushPromises();
    expect(lastToast()).toBe('Name the workflow before saving');

    await wrapper.findAll('.wfb__input')[0].setValue('Blank canvas');
    await buttonByLabel(wrapper, 'Save and activate').trigger('click');
    await flushPromises();
    expect(lastToast()).toBe('Fill in every required node setting first');

    await buttonByLabel(wrapper, 'Save draft').trigger('click');
    await flushPromises();
    expect(called(fetchMock, 'POST ' + WORKFLOWS)).toBe(false);
    expect(toasts()).not.toContain('Workflow saved');
  });

  it('adds a trigger from the palette, blocks publishing, then saves the draft', async () => {
    const fetchMock = backend([
      ['POST ' + WORKFLOWS, workflowFixture({ id: 'wf-new', status: 'draft' })]
    ]);
    const { wrapper, router } = await mountView(
      BuilderView,
      '/dashboard/workflows/builder',
      fetchMock
    );

    await wrapper.find('.nc[data-node-type="message_received"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.wfb__subtitle').text()).toContain('1 nodes / 0 links');
    expect(wrapper.find('.wfb__unsaved').exists()).toBe(true);
    expect(issueTexts(wrapper)).toEqual(['Add at least one action node']);
    /* On a phone a drop jumps straight to the settings pane. */
    expect(wrapper.find('.wfb__pane--left').attributes('data-tab')).toBe('property');

    await wrapper.findAll('.wfb__input')[0].setValue('Blank canvas');
    await buttonByLabel(wrapper, 'Save and activate').trigger('click');
    await flushPromises();
    expect(lastToast()).toBe('Fix the validation issues before activating');
    expect(called(fetchMock, 'POST ' + WORKFLOWS)).toBe(false);

    await buttonByLabel(wrapper, 'Save draft').trigger('click');
    await flushPromises();
    expect(bodyOf(fetchMock, WORKFLOWS)).toMatchObject({
      name: 'Blank canvas',
      status: 'draft'
    });
    expect(lastToast()).toBe('Workflow saved');
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/wf-new');
  });

  it('fills a required setting through the property panel', async () => {
    const { wrapper, store } = await mountView(
      BuilderView,
      '/dashboard/workflows/builder',
      backend([])
    );

    await wrapper.find('.nc[data-node-type="add_tag"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.wfb__incomplete').text()).toBe(
      'Fill in every required node setting first'
    );
    expect(wrapper.find('.wfb__missing').exists()).toBe(true);
    expect(issueTexts(wrapper)).toContain('Add exactly one trigger node');

    await wrapper.find('.pp__field[data-field="tag"] .pp__input').setValue('vip');
    await flushPromises();

    expect(wrapper.find('.wfb__incomplete').exists()).toBe(false);
    expect(wrapper.find('.wfb__missing').exists()).toBe(false);
    expect(store.definition.nodes[0].config.tag).toBe('vip');
  });

  it('loads an existing workflow onto the canvas', async () => {
    const fetchMock = backend(builderRoutes());
    const { wrapper } = await mountView(
      BuilderView,
      '/dashboard/workflows/builder?id=wf-1',
      fetchMock
    );

    expect(wrapper.find('.wfb__title').text()).toBe('Edit workflow');
    expect(inputValues(wrapper)).toEqual(['Welcome flow', 'Greets a new customer']);
    expect(wrapper.find('.wfb__subtitle').text()).toContain('2 nodes / 1 links');
    expect(wrapper.find('.wfb__issues-ok').text()).toBe('No issues');
    expect(called(fetchMock, 'GET ' + WORKFLOWS + '/wf-1')).toBe(true);
  });

  it('says when the workflow to edit cannot be loaded', async () => {
    const { wrapper } = await mountView(BuilderView, '/dashboard/workflows/builder?id=nope');

    expect(wrapper.find('.wfb__title').text()).toBe('Edit workflow');
    expect(wrapper.find('.wfb__subtitle').text()).toContain('0 nodes / 0 links');
    expect(toasts()).toContain('Workflow not found');
  });

  it('clears the canvas only after a confirmation', async () => {
    const { wrapper } = await mountView(
      BuilderView,
      '/dashboard/workflows/builder?id=wf-1',
      backend(builderRoutes())
    );

    await buttonByLabel(wrapper, 'Clear canvas').trigger('click');
    await flushPromises();

    expect(showConfirmDialog).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.wfb__subtitle').text()).toContain('0 nodes / 0 links');
    expect(issueTexts(wrapper)).toEqual(['The canvas is empty']);
  });

  it('lets a server verdict take over the issue panel', async () => {
    const fetchMock = backend([
      [
        'POST ' + WORKFLOWS + '/validate',
        { valid: false, issues: [{ code: 'NO_ACTION', messageKey: 'workflow.issue.NO_ACTION' }] }
      ]
    ]);
    const { wrapper } = await mountView(BuilderView, '/dashboard/workflows/builder', fetchMock);

    expect(issueTexts(wrapper)).toEqual(['The canvas is empty']);
    await buttonByLabel(wrapper, 'Validate').trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/validate')).toBe(true);
    expect(lastToast()).toBe('1 issues found');
    expect(issueTexts(wrapper)).toEqual(['Add at least one action node']);
  });

  it('switches panes through the tabs on a narrow screen', async () => {
    const { wrapper } = await mountView(BuilderView, '/dashboard/workflows/builder', backend([]));
    const tabs = wrapper.findAll('.wfb__tab');

    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(wrapper.find('.wfb__pane--canvas').attributes('data-tab')).toBe('canvas');
    expect(wrapper.find('.wfb__hint').text()).toBe(
      'On a small screen the canvas switches to a step list you can still edit.'
    );

    await tabs[2].trigger('click');
    expect(tabs[2].attributes('aria-selected')).toBe('true');
    expect(wrapper.find('.wfb__pane--left').attributes('data-tab')).toBe('property');
    expect(wrapper.find('.wfb__pane--right').attributes('data-tab')).toBe('property');

    await tabs[0].trigger('click');
    expect(wrapper.find('.wfb__pane--canvas').attributes('data-tab')).toBe('palette');
  });
});

/* --------------------------------------------------------------- run detail */

function runDetailRoutes(run: WorkflowRun, extra: Route[] = []): Route[] {
  return [
    ['GET ' + RUNS + '/' + run.id, run],
    ['GET ' + WORKFLOWS + '/wf-1/summary', SUMMARY],
    ...extra,
    ['GET ' + WORKFLOWS + '/wf-1', workflowFixture()]
  ];
}

function liveRunFixture(): WorkflowRun {
  return runFixture({
    id: 'run-9',
    status: 'running',
    endedAt: null,
    durationMs: 0,
    nodeRuns: [
      nodeRunFixture('t1', 'succeeded'),
      nodeRunFixture('a1', 'running', { endedAt: null, durationMs: 0 })
    ]
  });
}

function factValues(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.wfrd__meta .wfrd__fact dd').map((node) => node.text());
}

function paintedCounts(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.wfrd__count strong').map((node) => node.text());
}

describe('Run detail', () => {
  it('replays a finished run with its facts, progress and execution path', async () => {
    const fetchMock = backend(runDetailRoutes(runFixture()));
    const { wrapper } = await mountView(RunDetailView, '/dashboard/workflows/runs/run-1', fetchMock);

    expect(wrapper.find('.wfrd__id').text()).toBe('run-1');
    expect(document.title).toBe('Run detail - KiliSocial');
    expect(wrapper.find('.wfrd__pill').attributes('data-status')).toBe('succeeded');
    expect(wrapper.find('.wfrd__demo').exists()).toBe(false);
    expect(wrapper.find('.wfrd__missing').exists()).toBe(false);
    expect(wrapper.findAll('.wfrd__meta .wfrd__fact')).toHaveLength(5);
    expect(wrapper.find('.wfrd__trigger').text()).toBe('Message received');
    expect(factValues(wrapper)[4]).toBe('900 ms');
    expect(wrapper.find('.wfrd__progress-head strong').text()).toBe('100%');
    expect(paintedCounts(wrapper)).toEqual(['0', '0', '2', '0', '0']);
    expect(wrapper.find('.wfrd__live').exists()).toBe(false);
    expect(wrapper.find('.wfrd__graph').exists()).toBe(true);
    expect(wrapper.findAll('.ep__step')).toHaveLength(2);
    expect(wrapper.findComponent(ExecutionPath).exists()).toBe(true);
    expect(called(fetchMock, 'GET ' + RUNS + '/run-1')).toBe(true);
  });

  it('keeps a live run on the two second probe and says so', async () => {
    const fetchMock = backend(runDetailRoutes(liveRunFixture()));
    const { wrapper } = await mountView(RunDetailView, '/dashboard/workflows/runs/run-9', fetchMock);

    expect(wrapper.find('.wfrd__pill').attributes('data-status')).toBe('running');
    expect(wrapper.find('.wfrd__live').text()).toContain('Live');
    expect(wrapper.find('.wfrd__hint').text()).toBe(
      'Refreshing every 2 seconds while this run is active.'
    );
    expect(factValues(wrapper)[3]).toBe('Still running');
    expect(wrapper.find('.wfrd__progress-head strong').text()).toBe('50%');
    expect(paintedCounts(wrapper)).toEqual(['0', '1', '1', '0', '0']);
    expect(buttonByLabel(wrapper, 'Stop run').attributes('disabled')).toBeUndefined();
  });

  it('stops a live run and repaints the outcome', async () => {
    const fetchMock = backend(
      runDetailRoutes(liveRunFixture(), [
        [
          'POST ' + RUNS + '/run-9/stop',
          runFixture({ id: 'run-9', status: 'stopped', endedAt: NOW + 500, durationMs: 500 })
        ]
      ])
    );
    const { wrapper } = await mountView(RunDetailView, '/dashboard/workflows/runs/run-9', fetchMock);

    await buttonByLabel(wrapper, 'Stop run').trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + RUNS + '/run-9/stop')).toBe(true);
    expect(lastToast()).toBe('Run stopped');
    expect(wrapper.find('.wfrd__pill').attributes('data-status')).toBe('stopped');
    expect(wrapper.find('.wfrd__live').exists()).toBe(false);
  });

  it('never offers stop for a run that already finished', async () => {
    const fetchMock = backend(runDetailRoutes(runFixture()));
    const { wrapper } = await mountView(RunDetailView, '/dashboard/workflows/runs/run-1', fetchMock);
    const stop = buttonByLabel(wrapper, 'Stop run');

    expect(stop.attributes('disabled')).toBeDefined();
    await stop.trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + RUNS + '/run-1/stop')).toBe(false);
    expect(toasts()).toEqual([]);
  });

  it('starts a new run and follows it', async () => {
    const fetchMock = backend(
      runDetailRoutes(runFixture(), [
        ['POST ' + WORKFLOWS + '/wf-1/runs', runFixture({ id: 'run-7' })]
      ])
    );
    const { wrapper, router } = await mountView(
      RunDetailView,
      '/dashboard/workflows/runs/run-1',
      fetchMock
    );

    await buttonByLabel(wrapper, 'Run again').trigger('click');
    await flushPromises();

    expect(called(fetchMock, 'POST ' + WORKFLOWS + '/wf-1/runs')).toBe(true);
    expect(toasts()).toContain('New run started');
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/runs/run-7');
  });

  it('opens the node inspector from the execution path and closes it again', async () => {
    const { wrapper } = await mountView(
      RunDetailView,
      '/dashboard/workflows/runs/run-1',
      backend(runDetailRoutes(runFixture()))
    );

    expect(wrapper.find('.wfrd__inspector').exists()).toBe(false);
    const steps = wrapper.findAll('.ep__step');
    expect(steps[1].find('.ep__label').text()).toBe('Tag the VIP');

    await steps[1].find('.ep__chip').trigger('click');
    await flushPromises();

    expect(wrapper.find('.wfrd__inspector .wfrd__section-title').text()).toBe('Tag the VIP');
    expect(wrapper.find('.wfrd__inspector-sub').text()).toContain('Succeeded');
    expect(wrapper.findAll('.wfrd__payload')).toHaveLength(2);
    expect(wrapper.findAll('.wfrd__payload pre')).toHaveLength(1);
    expect(wrapper.find('.wfrd__payload').text()).toContain('vip');

    await wrapper.find('.wfrd__inspector-head .wfrd__btn').trigger('click');
    await flushPromises();
    expect(wrapper.find('.wfrd__inspector').exists()).toBe(false);
  });

  it('says when the run is gone and disables every action', async () => {
    const { wrapper, router } = await mountView(RunDetailView, '/dashboard/workflows/runs/missing');

    expect(wrapper.find('.wfrd__missing').text()).toBe('Run not found');
    expect(wrapper.find('.wfrd__meta').exists()).toBe(false);
    expect(wrapper.find('.wfrd__graph').exists()).toBe(false);
    expect(buttonByLabel(wrapper, 'Run again').attributes('disabled')).toBeDefined();
    expect(buttonByLabel(wrapper, 'Open workflow').attributes('disabled')).toBeDefined();

    await wrapper.find('.wfrd__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/runs');
  });

  it('labels sample data when the row is a demo run', async () => {
    const fetchMock = backend(runDetailRoutes(runFixture({ demo: true })));
    const { wrapper } = await mountView(RunDetailView, '/dashboard/workflows/runs/run-1', fetchMock);

    expect(wrapper.find('.wfrd__demo').text()).toBe(
      'Sample runs. Real executions arrive with the workflow engine.'
    );
    expect(wrapper.find('.wfrd__meta').exists()).toBe(true);
  });

  it('walks back to the workflow and to the scoped run history', async () => {
    const fetchMock = backend(runDetailRoutes(runFixture()));
    const { wrapper, router } = await mountView(
      RunDetailView,
      '/dashboard/workflows/runs/run-1',
      fetchMock
    );

    await buttonByLabel(wrapper, 'Open workflow').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/workflows/wf-1');

    await router.push('/dashboard/workflows/runs/run-1');
    await flushPromises();
    await wrapper.find('.wfrd__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/dashboard/workflows/runs?workflowId=wf-1');
  });
});
