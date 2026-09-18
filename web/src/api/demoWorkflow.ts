/**
 * Offline demo backend for the automation workflow module (Sprint 12).
 *
 * api/workflow.ts falls back to these functions whenever the real endpoint is
 * missing, so the builder, the monitor and the template library all stay usable
 * without a server. Graphs come from lib/workflowTemplates and run records from
 * lib/workflowRun, which means the demo replays the same validation and the
 * same deterministic synthesis the tests assert on: nothing here invents its
 * own idea of a workflow.
 *
 * Counters on a workflow row are always derived from the stored runs rather
 * than incremented by hand, so a stopped or deleted run cannot leave the list
 * page disagreeing with the runs page.
 */
import { ApiError } from './http';
import {
  autoLayout,
  nodesOfKind,
  normalizeDefinition,
  summarizeDefinition,
  triggerKindOf,
  validateDefinition
} from '../lib/workflowGraph';
import type { DefinitionSummary } from '../lib/workflowGraph';
import { NODE_TYPES, nodesByKind } from '../lib/workflowNodes';
import { WORKFLOW_TEMPLATES, instantiateTemplate } from '../lib/workflowTemplates';
import { computeRunStats, hashSeed, synthesizeRun, synthesizeRunHistory } from '../lib/workflowRun';
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
  WorkflowStatus,
  WorkflowTemplate,
  WorkflowValidation
} from '../types';

const MODE_KEY = 'ks-demo-mode';
const WORKFLOW_KEY = 'ks-workflow-list';
const RUN_KEY = 'ks-workflow-runs';
const SEQ_KEY = 'ks-workflow-seq';
const TEMPLATE_USE_KEY = 'ks-workflow-template-uses';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Runs kept per seeded workflow; enough for a believable stats strip. */
const SEED_RUNS_ACTIVE = 8;
const SEED_RUNS_IDLE = 3;

function enterDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

function nextSeq(prefix: string): string {
  const current = readJson<number>(SEQ_KEY) ?? 0;
  const next = current + 1;
  writeJson(SEQ_KEY, next);
  return prefix + '-' + next.toString(36) + '-' + hashSeed(String(next)).toString(36).slice(0, 6);
}

export function startOfToday(now = Date.now()): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/* ------------------------------------------------------------------- seeds */

const VIP_RESTOCK: WorkflowDefinition = {
  nodes: [
    {
      id: 'vip-trigger',
      kind: 'trigger',
      type: 'message_received',
      name: '',
      position: { x: 40, y: 40 },
      config: { channel: 'whatsapp', keyword: 'bei', inboundOnly: true },
      errorStrategy: 'stop',
      retries: 0
    },
    {
      id: 'vip-condition',
      kind: 'condition',
      type: 'expression',
      name: '',
      position: { x: 300, y: 40 },
      config: { expression: 'customer.totalSpent > 500000' },
      errorStrategy: 'continue',
      retries: 0
    },
    {
      id: 'vip-restock-call',
      kind: 'action',
      type: 'http_request',
      name: '',
      position: { x: 560, y: 40 },
      config: { method: 'POST', url: 'https://example.invalid/restock-alert', timeoutMs: 8000 },
      errorStrategy: 'retry',
      retries: 2
    },
    {
      id: 'vip-restock-note',
      kind: 'action',
      type: 'send_notification',
      name: '',
      position: { x: 560, y: 180 },
      config: { title: 'Restock interest logged', level: 'info' },
      errorStrategy: 'stop',
      retries: 0
    }
  ],
  edges: [
    { id: 'vip-e1', source: 'vip-trigger', target: 'vip-condition' },
    { id: 'vip-e2', source: 'vip-condition', target: 'vip-restock-call', branch: 'true' },
    { id: 'vip-e3', source: 'vip-condition', target: 'vip-restock-note', branch: 'false' }
  ]
};

interface WorkflowSeed {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  ageDays: number;
}

const WORKFLOW_SEEDS: WorkflowSeed[] = [
  {
    id: 'wf-welcome',
    name: 'New customer welcome',
    description: 'Tags a freshly created customer and sends a Swahili welcome note on WhatsApp.',
    status: 'active',
    definition: WORKFLOW_TEMPLATES[0].definition,
    ageDays: 12
  },
  {
    id: 'wf-winback',
    name: 'Dormant customer win back',
    description: 'After 45 quiet days, VIPs get a discount code and everyone else a reminder.',
    status: 'active',
    definition: WORKFLOW_TEMPLATES[1].definition,
    ageDays: 9
  },
  {
    id: 'wf-autoreply',
    name: 'Out of hours auto reply',
    description: 'Replies instantly inside business hours and sets expectations outside them.',
    status: 'active',
    definition: WORKFLOW_TEMPLATES[4].definition,
    ageDays: 6
  },
  {
    id: 'wf-vip-restock',
    name: 'VIP restock alert',
    description: 'When a high value customer asks about price, alert the restock endpoint.',
    status: 'active',
    definition: VIP_RESTOCK,
    ageDays: 4
  },
  {
    id: 'wf-birthday',
    name: 'Birthday greeting',
    description: 'Waits until mid morning on the birthday, then sends a personalised greeting.',
    status: 'paused',
    definition: WORKFLOW_TEMPLATES[2].definition,
    ageDays: 21
  },
  {
    id: 'wf-followup',
    name: 'Campaign responder follow up',
    description: 'Moves a responder into hot leads two days after a click and notifies the team.',
    status: 'draft',
    definition: WORKFLOW_TEMPLATES[3].definition,
    ageDays: 2
  }
];

function seedWorkflows(now: number): Workflow[] {
  return WORKFLOW_SEEDS.map((seed) => {
    const createdAt = now - seed.ageDays * DAY_MS;
    return {
      id: seed.id,
      name: seed.name,
      description: seed.description,
      status: seed.status,
      definition: normalizeDefinition(seed.definition),
      triggerKind: triggerKindOf(seed.definition),
      nodeCount: seed.definition.nodes.length,
      todayRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      lastRunAt: null,
      createdAt,
      updatedAt: createdAt + 3 * 60 * 60 * 1000,
      demo: true
    };
  });
}

function seedRuns(workflows: Workflow[], now: number): WorkflowRun[] {
  const runs: WorkflowRun[] = [];
  for (const workflow of workflows) {
    const count = workflow.status === 'active' ? SEED_RUNS_ACTIVE : SEED_RUNS_IDLE;
    runs.push(...synthesizeRunHistory(workflow, count, { now }));
  }
  return runs;
}

/** Recomputes the denormalised counters from the stored run list. */
export function syncCounters(workflow: Workflow, runs: readonly WorkflowRun[], now = Date.now()): Workflow {
  const todayStart = startOfToday(now);
  const own = runs.filter((run) => run.workflowId === workflow.id);
  const today = own.filter((run) => run.startedAt >= todayStart);
  const lastRunAt = own.length > 0 ? Math.max(...own.map((run) => run.startedAt)) : null;
  return {
    ...workflow,
    todayRuns: today.length,
    successRuns: today.filter((run) => run.status === 'succeeded').length,
    failedRuns: today.filter((run) => run.status === 'failed').length,
    lastRunAt
  };
}

export function readWorkflows(now = Date.now()): Workflow[] {
  const stored = readJson<Workflow[]>(WORKFLOW_KEY);
  if (stored && stored.length > 0) {
    const runs = readJson<WorkflowRun[]>(RUN_KEY) ?? [];
    return stored.map((item) => syncCounters({ ...item, definition: normalizeDefinition(item.definition) }, runs, now));
  }
  const seeded = seedWorkflows(now);
  writeJson(WORKFLOW_KEY, seeded);
  const runs = seedRuns(seeded, now);
  writeJson(RUN_KEY, runs);
  return seeded.map((item) => syncCounters(item, runs, now));
}

function writeWorkflows(list: readonly Workflow[]): void {
  writeJson(
    WORKFLOW_KEY,
    list.map((item) => ({ ...item }))
  );
}

export function readRuns(now = Date.now()): WorkflowRun[] {
  const stored = readJson<WorkflowRun[]>(RUN_KEY);
  if (stored && stored.length > 0) return stored;
  const workflows = readWorkflows(now);
  const runs = seedRuns(workflows, now);
  writeJson(RUN_KEY, runs);
  return runs;
}

function writeRuns(list: readonly WorkflowRun[]): void {
  writeJson(
    RUN_KEY,
    list.map((item) => ({ ...item }))
  );
}

function sortWorkflows(list: readonly Workflow[]): Workflow[] {
  return [...list].sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name));
}

function sortRuns(list: readonly WorkflowRun[]): WorkflowRun[] {
  return [...list].sort((left, right) => right.startedAt - left.startedAt);
}

function matchesQuery(workflow: Workflow, query: string): boolean {
  if (!query) return true;
  const haystack = (workflow.name + ' ' + workflow.description).toLowerCase();
  return haystack.includes(query);
}

/* ------------------------------------------------------------- workflows */

export function demoWorkflows(params?: WorkflowListParams, now = Date.now()): PagedWorkflows {
  enterDemoMode();
  const query = (params?.query ?? '').trim().toLowerCase();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  const matches = sortWorkflows(readWorkflows(now)).filter((item) => {
    if (params?.status && params.status !== 'all' && item.status !== params.status) return false;
    return matchesQuery(item, query);
  });
  const slice = matches.slice(offset, offset + limit);
  return {
    workflows: slice.map((item) => ({ ...item })),
    hasMore: offset + slice.length < matches.length,
    total: matches.length
  };
}

export function demoWorkflowById(id: string, now = Date.now()): Workflow {
  enterDemoMode();
  const found = readWorkflows(now).find((item) => item.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'workflow not found');
  return { ...found };
}

/** The engine refuses to listen to a broken graph, and so does the demo. */
function assertValid(definition: WorkflowDefinition): void {
  const validation = validateDefinition(definition);
  if (validation.valid) return;
  throw new ApiError(
    'VALIDATION_FAILED',
    validation.issues.map((item) => item.code).join(',')
  );
}

type WorkflowBase = Omit<
  Workflow,
  'triggerKind' | 'nodeCount' | 'todayRuns' | 'successRuns' | 'failedRuns' | 'lastRunAt'
>;

function decorate(base: WorkflowBase, now: number): Workflow {
  const definition = normalizeDefinition(base.definition);
  return syncCounters(
    {
      ...base,
      definition,
      triggerKind: triggerKindOf(definition),
      nodeCount: definition.nodes.length,
      todayRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      lastRunAt: null
    },
    readJson<WorkflowRun[]>(RUN_KEY) ?? [],
    now
  );
}

export function demoCreateWorkflow(input: WorkflowInput, now = Date.now()): Workflow {
  enterDemoMode();
  const status = input.status ?? 'draft';
  if (status === 'active') assertValid(input.definition);
  const record = decorate(
    {
      id: nextSeq('wf'),
      name: input.name.trim(),
      description: (input.description ?? '').trim(),
      status,
      definition: input.definition,
      createdAt: now,
      updatedAt: now,
      demo: true
    },
    now
  );
  const list = readWorkflows(now);
  list.unshift(record);
  writeWorkflows(list);
  return { ...record };
}

export function demoUpdateWorkflow(
  id: string,
  patch: Partial<WorkflowInput>,
  now = Date.now()
): Workflow {
  enterDemoMode();
  const list = readWorkflows(now);
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) throw new ApiError('NOT_FOUND', 'workflow not found');
  const current = list[index];
  const status = patch.status ?? current.status;
  const definition = patch.definition ? normalizeDefinition(patch.definition) : current.definition;
  if (status === 'active') assertValid(definition);
  const next = decorate(
    {
      id: current.id,
      name: patch.name !== undefined ? patch.name.trim() : current.name,
      description: patch.description !== undefined ? patch.description.trim() : current.description,
      status,
      definition,
      createdAt: current.createdAt,
      updatedAt: now,
      demo: current.demo
    },
    now
  );
  list[index] = next;
  writeWorkflows(list);
  return { ...next };
}

export function demoDeleteWorkflow(id: string, now = Date.now()): void {
  enterDemoMode();
  const list = readWorkflows(now);
  if (!list.some((item) => item.id === id)) throw new ApiError('NOT_FOUND', 'workflow not found');
  writeWorkflows(list.filter((item) => item.id !== id));
  writeRuns(readRuns(now).filter((run) => run.workflowId !== id));
}

export function demoSetWorkflowStatus(id: string, status: WorkflowStatus, now = Date.now()): Workflow {
  return demoUpdateWorkflow(id, { status }, now);
}

export function demoDuplicateWorkflow(id: string, now = Date.now()): Workflow {
  const source = demoWorkflowById(id, now);
  return demoCreateWorkflow(
    {
      name: source.name + ' (copy)',
      description: source.description,
      definition: normalizeDefinition(source.definition),
      status: 'draft'
    },
    now
  );
}

/** Tidies the canvas into layered columns and persists the new positions. */
export function demoLayoutWorkflow(id: string, now = Date.now()): Workflow {
  const source = demoWorkflowById(id, now);
  return demoUpdateWorkflow(id, { definition: autoLayout(source.definition) }, now);
}

export function demoValidateWorkflow(definition: WorkflowDefinition): WorkflowValidation {
  enterDemoMode();
  return validateDefinition(normalizeDefinition(definition));
}

export function demoWorkflowSummary(id: string, now = Date.now()): DefinitionSummary {
  return summarizeDefinition(demoWorkflowById(id, now).definition);
}

/* ------------------------------------------------------------------- runs */

function filterRuns(
  params: WorkflowRunListParams | undefined,
  runs: readonly WorkflowRun[]
): WorkflowRun[] {
  return runs.filter((run) => {
    if (params?.workflowId && run.workflowId !== params.workflowId) return false;
    if (params?.status && params.status !== 'all' && run.status !== params.status) return false;
    if (params?.from !== undefined && run.startedAt < params.from) return false;
    if (params?.to !== undefined && run.startedAt > params.to) return false;
    return true;
  });
}

export function demoWorkflowRuns(params?: WorkflowRunListParams, now = Date.now()): PagedWorkflowRuns {
  enterDemoMode();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;
  const matches = sortRuns(filterRuns(params, readRuns(now)));
  const slice = matches.slice(offset, offset + limit);
  return {
    runs: slice.map((item) => ({ ...item })),
    hasMore: offset + slice.length < matches.length,
    total: matches.length
  };
}

export function demoRunById(id: string, now = Date.now()): WorkflowRun {
  enterDemoMode();
  readWorkflows(now);
  const found = readRuns(now).find((run) => run.id === id);
  if (!found) throw new ApiError('NOT_FOUND', 'run not found');
  return { ...found };
}

/** Manual test run from the detail page; behaves like one real trigger. */
export function demoTriggerRun(workflowId: string, now = Date.now()): WorkflowRun {
  enterDemoMode();
  const workflow = demoWorkflowById(workflowId, now);
  assertValid(workflow.definition);
  const run = synthesizeRun(workflow, 'succeeded', { now, seed: workflowId + ':' + String(now) });
  const runs = readRuns(now);
  runs.unshift(run);
  writeRuns(runs);
  const list = readWorkflows(now);
  const index = list.findIndex((item) => item.id === workflowId);
  if (index >= 0) {
    list[index] = { ...list[index], updatedAt: now };
    writeWorkflows(list);
  }
  return { ...run };
}

const STOPPED_ERROR_KEY = 'workflow.run.error.stopped';

export function demoStopRun(id: string, now = Date.now()): WorkflowRun {
  enterDemoMode();
  const runs = readRuns(now);
  const index = runs.findIndex((run) => run.id === id);
  if (index < 0) throw new ApiError('NOT_FOUND', 'run not found');
  const current = runs[index];
  if (current.status !== 'running') throw new ApiError('CONFLICT', 'run is not running');
  const nodeRuns = current.nodeRuns.map((item) =>
    item.state === 'running'
      ? { ...item, state: 'failed' as const, endedAt: now, error: STOPPED_ERROR_KEY }
      : item
  );
  const stopped: WorkflowRun = {
    ...current,
    status: 'stopped',
    endedAt: now,
    durationMs: Math.max(0, now - current.startedAt),
    nodeRuns
  };
  runs[index] = stopped;
  writeRuns(runs);
  return { ...stopped };
}

export function demoRunStats(params?: WorkflowRunListParams, now = Date.now()): WorkflowRunStats {
  enterDemoMode();
  return computeRunStats(filterRuns(params, readRuns(now)));
}

export function demoWorkflowOverview(now = Date.now()): WorkflowOverview {
  enterDemoMode();
  const workflows = readWorkflows(now);
  const todayStart = startOfToday(now);
  const today = readRuns(now).filter((run) => run.startedAt >= todayStart);
  return {
    activeWorkflows: workflows.filter((item) => item.status === 'active').length,
    todayTriggers: today.length,
    todaySucceeded: today.filter((run) => run.status === 'succeeded').length,
    todayFailed: today.filter((run) => run.status === 'failed').length
  };
}

/* -------------------------------------------------------------- templates */

function readUseCounts(): Record<string, number> {
  return readJson<Record<string, number>>(TEMPLATE_USE_KEY) ?? {};
}

export function demoWorkflowTemplates(): WorkflowTemplate[] {
  enterDemoMode();
  const uses = readUseCounts();
  return WORKFLOW_TEMPLATES.map((template) => ({
    ...template,
    useCount: template.useCount + (uses[template.id] ?? 0)
  }));
}

export function demoUseWorkflowTemplate(id: string): WorkflowTemplate {
  enterDemoMode();
  if (!WORKFLOW_TEMPLATES.some((template) => template.id === id)) {
    throw new ApiError('NOT_FOUND', 'template not found');
  }
  const uses = readUseCounts();
  uses[id] = (uses[id] ?? 0) + 1;
  writeJson(TEMPLATE_USE_KEY, uses);
  return demoWorkflowTemplates().find((template) => template.id === id) as WorkflowTemplate;
}

/**
 * Copies a preset into a new draft. The caller passes an already translated
 * name, which keeps i18n out of the demo backend.
 */
export function demoCreateFromTemplate(templateId: string, name: string, now = Date.now()): Workflow {
  const template = WORKFLOW_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new ApiError('NOT_FOUND', 'template not found');
  const trimmed = name.trim();
  if (!trimmed) throw new ApiError('VALIDATION_FAILED', 'name is required');
  const created = demoCreateWorkflow(
    {
      name: trimmed,
      description: '',
      definition: instantiateTemplate(template),
      status: 'draft'
    },
    now
  );
  demoUseWorkflowTemplate(templateId);
  return created;
}

/* ---------------------------------------------------------------- catalog */

/** The palette endpoint: node types grouped by the kind the panel asks for. */
export function demoNodeTypes(kind?: WorkflowNodeKind): NodeTypeDef[] {
  enterDemoMode();
  return kind ? nodesByKind(kind) : NODE_TYPES;
}

/** Exposed for tests that build a graph without going through the catalogue. */
export function demoNodeKindCounts(
  definition: WorkflowDefinition
): Record<WorkflowNodeKind, number> {
  return {
    trigger: nodesOfKind(definition, 'trigger').length,
    condition: nodesOfKind(definition, 'condition').length,
    action: nodesOfKind(definition, 'action').length
  };
}

/** Test/demo helper: forgets every workflow record but keeps other modules. */
export function demoResetWorkflows(): void {
  writeJson(WORKFLOW_KEY, []);
  writeJson(RUN_KEY, []);
  writeJson(SEQ_KEY, 0);
  writeJson(TEMPLATE_USE_KEY, {});
}
