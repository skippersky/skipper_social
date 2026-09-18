/**
 * Sprint 12 pure-library tests: graph engine, node catalogue, run synthesis and
 * the template library. None of these modules touch Vue, storage or the clock in
 * a way the tests cannot pin, so everything here asserts exact values.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ORIGIN,
  X_GAP,
  Y_GAP,
  autoLayout,
  canConnect,
  cloneDefinition,
  codesOf,
  createEdge,
  createNode,
  deserializeDefinition,
  descKeyFor,
  emptyDefinition,
  executionOrder,
  findCycle,
  findEdge,
  hasCycle,
  incoming,
  isIsolated,
  issue,
  issueEdgeIds,
  issueNodeIds,
  issuesForNode,
  kindOfType,
  labelKeyFor,
  nextEdgeId,
  nextNodeId,
  nodeById,
  nodesOfKind,
  normalizeDefinition,
  outgoing,
  reachableFrom,
  resetNodeIdSequence,
  serializeDefinition,
  summarizeDefinition,
  triggerKindOf,
  triggerOf,
  validateDefinition,
  withConfigPatch,
  withEdge,
  withNode,
  withNodePatch,
  withPositions,
  withoutEdge,
  withoutNode
} from '../lib/workflowGraph';
import {
  DEMO_ERROR_KEYS,
  buildNodeRuns,
  computeRunStats,
  emptyRunStats,
  formatDuration,
  hashSeed,
  nodeStateCounts,
  progressOf,
  seeded,
  synthesizeRun,
  synthesizeRunHistory
} from '../lib/workflowRun';
import {
  CHANNEL_OPTIONS,
  DEFAULT_TIMEZONE,
  ERROR_STRATEGY_OPTIONS,
  HTTP_METHOD_OPTIONS,
  NODE_TYPES,
  WAIT_UNIT_OPTIONS,
  allConfigKeys,
  defaultConfigFor,
  fieldsFor,
  isActionType,
  isConditionType,
  isTriggerType,
  missingRequiredKeys,
  nodeTypeDef,
  nodeTypeDefOrFallback,
  nodesByKind,
  requiredKeysFor
} from '../lib/workflowNodes';
import {
  TEMPLATE_SCENARIOS,
  WORKFLOW_TEMPLATES,
  instantiateTemplate,
  templateById,
  templatesByComplexity
} from '../lib/workflowTemplates';
import { MAX_NODE_RETRIES, NODE_RUN_STATES, WORKFLOW_RUN_STATUSES } from '../types';
import type {
  NodeRun,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRun,
  WorkflowRunStatus
} from '../types';

const NOW = new Date(2026, 8, 12, 8, 30).getTime();

/** trigger -> action, the smallest graph that passes validation. */
function minimal(): WorkflowDefinition {
  const trigger = createNode('customer_created', { x: 0, y: 0 }, 't1');
  const action = createNode('send_message', { x: 300, y: 0 }, 'a1');
  action.config.template = 'Karibu';
  action.config.channel = 'whatsapp';
  return withEdge({ nodes: [trigger, action], edges: [] }, 't1', 'a1');
}

/** trigger -> condition -> (true) actionA / (false) actionB. */
function branching(): WorkflowDefinition {
  const trigger = createNode('message_received', { x: 0, y: 0 }, 't1');
  const condition = createNode('has_tag', { x: 300, y: 0 }, 'c1');
  condition.config.tag = 'vip';
  const yes = createNode('send_message', { x: 600, y: -80 }, 'a1');
  yes.config.template = 'VIP reply';
  const no = createNode('add_tag', { x: 600, y: 80 }, 'a2');
  no.config.tag = 'needs-review';
  let def: WorkflowDefinition = { nodes: [trigger, condition, yes, no], edges: [] };
  def = withEdge(def, 't1', 'c1');
  def = withEdge(def, 'c1', 'a1', 'true');
  def = withEdge(def, 'c1', 'a2', 'false');
  return def;
}

beforeEach(() => {
  resetNodeIdSequence();
});

/* ================================================================== graph */

describe('workflowGraph ids and catalogue lookups', () => {
  it('mints prefixed, unique node ids and resets on demand', () => {
    const first = nextNodeId('send_message');
    const second = nextNodeId('send_message');
    expect(first.startsWith('send_message-1-')).toBe(true);
    expect(second.startsWith('send_message-2-')).toBe(true);
    expect(first).not.toBe(second);

    resetNodeIdSequence();
    expect(nextNodeId('add_tag').startsWith('add_tag-1-')).toBe(true);
  });

  it('encodes the endpoints and branch into an edge id', () => {
    expect(nextEdgeId('a', 'b')).toMatch(/^edge-a-b-[a-z0-9]+$/);
    expect(nextEdgeId('a', 'b', 'true')).toMatch(/^edge-a-b-true-[a-z0-9]+$/);
  });

  it('maps a node type onto its kind, with action as the fallback', () => {
    expect(kindOfType('customer_created')).toBe('trigger');
    expect(kindOfType('has_tag')).toBe('condition');
    expect(kindOfType('send_message')).toBe('action');
    expect(kindOfType('not_a_real_type' as WorkflowNodeType)).toBe('action');
  });

  it('resolves label and description keys, falling back by kind', () => {
    expect(labelKeyFor({ type: 'send_message', kind: 'action' })).toBe('workflow.node.send_message.label');
    expect(descKeyFor({ type: 'send_message', kind: 'action' })).toBe('workflow.node.send_message.desc');
    expect(labelKeyFor({ type: 'bogus' as WorkflowNodeType, kind: 'trigger' })).toMatch(/^workflow\./);
  });

  it('starts from an empty graph and builds nodes with catalogue defaults', () => {
    expect(emptyDefinition()).toEqual({ nodes: [], edges: [] });
    const node = createNode('schedule');
    expect(node.kind).toBe('trigger');
    expect(node.type).toBe('schedule');
    expect(node.name).toBe('');
    expect(node.position).toEqual(ORIGIN);
    expect(node.errorStrategy).toBe('stop');
    expect(node.retries).toBe(0);
    expect(node.config.timezone).toBe(DEFAULT_TIMEZONE);
    expect(node.config.cron).toBeUndefined();
    expect(node.id.startsWith('schedule-')).toBe(true);
  });

  it('only records a branch on an edge that has one', () => {
    const plain = createEdge('a', 'b');
    expect(plain.branch).toBeUndefined();
    expect(plain.source).toBe('a');
    expect(createEdge('a', 'b', 'false').branch).toBe('false');
  });
});

describe('workflowGraph queries', () => {
  it('finds nodes and edges by id and endpoint', () => {
    const def = branching();
    expect(nodeById(def, 'c1')?.type).toBe('has_tag');
    expect(nodeById(def, 'nope')).toBeUndefined();
    expect(nodesOfKind(def, 'action').map((node) => node.id)).toEqual(['a1', 'a2']);
    expect(outgoing(def, 'c1').map((edge) => edge.branch)).toEqual(['true', 'false']);
    expect(incoming(def, 'a1')).toHaveLength(1);
    expect(findEdge(def, 'c1', 'a1', 'true')?.id).toBeTruthy();
    expect(findEdge(def, 'c1', 'a1')).toBeUndefined();
    expect(findEdge(def, 'a1', 'c1', 'true')).toBeUndefined();
  });

  it('picks the single trigger, or the first of several', () => {
    expect(triggerOf(emptyDefinition())).toBeNull();
    expect(triggerKindOf(emptyDefinition())).toBeNull();
    expect(triggerKindOf(minimal())).toBe('customer_created');
    const two = branching();
    two.nodes.push(createNode('schedule', { x: 0, y: 200 }, 't2'));
    expect(triggerOf(two)?.id).toBe('t1');
  });

  it('detects isolated nodes', () => {
    const def = minimal();
    expect(isIsolated(def, 'a1')).toBe(false);
    def.nodes.push(createNode('add_tag', { x: 0, y: 500 }, 'lonely'));
    expect(isIsolated(def, 'lonely')).toBe(true);
  });

  it('refuses a connection that cannot exist', () => {
    const def = branching();
    expect(canConnect(def, 't1', 'c1')).toBe('duplicate');
    expect(canConnect(def, 't1', 't1')).toBe('self-loop');
    expect(canConnect(def, 't1', 'ghost')).toBe('missing-node');
    expect(canConnect(def, 'a1', 'a2')).toBeNull();
    expect(canConnect(def, 'c1', 'a1', 'false')).toBeNull();
  });

  it('walks the reachable set forward from a node', () => {
    const def = branching();
    expect([...reachableFrom(def, 'c1')].sort()).toEqual(['a1', 'a2', 'c1']);
    expect([...reachableFrom(def, 'a1')]).toEqual(['a1']);
  });
});

describe('workflowGraph immutable mutations', () => {
  it('clones deeply so a copy cannot be mutated through the original', () => {
    const def = minimal();
    const copy = cloneDefinition(def);
    copy.nodes[0].config.segment = 'changed';
    copy.nodes[0].position.x = 999;
    expect(def.nodes[0].config.segment).not.toBe('changed');
    expect(def.nodes[0].position.x).toBe(0);
    expect(copy).not.toBe(def);
  });

  it('adds a node once and replaces it on a second pass', () => {
    let def = withNode(emptyDefinition(), createNode('add_tag', ORIGIN, 'a1'));
    expect(def.nodes).toHaveLength(1);
    def = withNode(def, { ...def.nodes[0], name: 'renamed' });
    expect(def.nodes).toHaveLength(1);
    expect(def.nodes[0].name).toBe('renamed');
  });

  it('drops every edge touching a removed node', () => {
    const def = withoutNode(branching(), 'c1');
    expect(def.nodes.map((node) => node.id)).toEqual(['t1', 'a1', 'a2']);
    expect(def.edges).toEqual([]);
  });

  it('patches a node without letting the caller overwrite its id', () => {
    const def = withNodePatch(minimal(), 'a1', { id: 'hacked', name: 'Send', retries: 2 });
    expect(def.nodes[1].id).toBe('a1');
    expect(def.nodes[1].name).toBe('Send');
    expect(def.nodes[1].retries).toBe(2);
  });

  it('copies position and config instead of aliasing them', () => {
    const position = { x: 12, y: 34 };
    const config = { template: 'hi' };
    const def = withNodePatch(minimal(), 'a1', { position, config });
    position.x = 99;
    config.template = 'mutated';
    expect(def.nodes[1].position.x).toBe(12);
    expect(def.nodes[1].config.template).toBe('hi');
  });

  it('merges config keys and leaves the rest alone', () => {
    const def = withConfigPatch(minimal(), 'a1', { channel: 'instagram' });
    expect(def.nodes[1].config.channel).toBe('instagram');
    expect(def.nodes[1].config.template).toBe('Karibu');
  });

  it('refuses to add an illegal edge but keeps the graph intact', () => {
    const def = minimal();
    const refused = withEdge(def, 'a1', 'a1');
    expect(refused.edges).toHaveLength(def.edges.length);
    expect(refused).not.toBe(def);
    expect(withEdge(def, 'a1', 't1').edges).toHaveLength(2);
  });

  it('removes an edge by id and moves nodes by position map', () => {
    const def = minimal();
    expect(withoutEdge(def, def.edges[0].id).edges).toEqual([]);
    const moved = withPositions(def, { a1: { x: 77, y: 88 } });
    expect(moved.nodes[1].position).toEqual({ x: 77, y: 88 });
    expect(moved.nodes[0].position).toEqual(def.nodes[0].position);
  });
});

describe('workflowGraph cycles, order and layout', () => {
  it('finds no cycle in a well formed graph', () => {
    expect(findCycle(branching())).toEqual([]);
    expect(hasCycle(branching())).toBe(false);
  });

  it('finds a cycle the moment one is drawn', () => {
    const def = withEdge(branching(), 'a1', 't1');
    expect(hasCycle(def)).toBe(true);
    expect(findCycle(def).length).toBeGreaterThan(0);
    expect(codesOf(validateDefinition(def))).toContain('CYCLE');
  });

  it('replays the true branch of a condition by default', () => {
    expect(executionOrder(branching()).map((node) => node.id)).toEqual(['t1', 'c1', 'a1']);
  });

  it('replays the false branch when the selection says so', () => {
    expect(executionOrder(branching(), { c1: 'false' }).map((node) => node.id)).toEqual([
      't1',
      'c1',
      'a2'
    ]);
  });

  it('replays nothing without a trigger', () => {
    expect(executionOrder(emptyDefinition())).toEqual([]);
    const orphan: WorkflowDefinition = { nodes: [createNode('add_tag', ORIGIN, 'a1')], edges: [] };
    expect(executionOrder(orphan)).toEqual([]);
  });

  it('lays nodes out in breadth first columns', () => {
    const laid = autoLayout(branching());
    const byId = new Map(laid.nodes.map((node) => [node.id, node.position]));
    expect(byId.get('t1')).toEqual({ x: ORIGIN.x, y: ORIGIN.y });
    expect(byId.get('c1')?.x).toBe(ORIGIN.x + X_GAP);
    expect(byId.get('a1')?.x).toBe(ORIGIN.x + 2 * X_GAP);
    expect(byId.get('a2')?.x).toBe(ORIGIN.x + 2 * X_GAP);
    expect(byId.get('a2')?.y).toBe(ORIGIN.y + Y_GAP);
    expect(autoLayout(emptyDefinition())).toEqual({ nodes: [], edges: [] });
  });

  it('summarises counts and depth', () => {
    expect(summarizeDefinition(emptyDefinition())).toEqual({
      nodes: 0,
      edges: 0,
      triggers: 0,
      conditions: 0,
      actions: 0,
      depth: 0
    });
    expect(summarizeDefinition(branching())).toEqual({
      nodes: 4,
      edges: 3,
      triggers: 1,
      conditions: 1,
      actions: 2,
      depth: 3
    });
  });
});

describe('workflowGraph normalisation and serialisation', () => {
  it('coerces junk from the wire into a usable graph', () => {
    const normalized = normalizeDefinition({
      nodes: [
        null,
        'nope',
        { id: '  ', type: '', kind: 'action', position: { x: 'abc', y: null } },
        {
          id: 'n2',
          kind: 'nonsense',
          type: 'schedule',
          name: 42,
          position: { x: '10', y: '20' },
          config: { cron: '0 6 * * *', nested: { deep: true }, list: [1], bad: NaN },
          errorStrategy: 'explode',
          retries: 999
        }
      ] as unknown as WorkflowNode[],
      edges: [
        null,
        { id: '', source: '', target: '' },
        { source: 'n2', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'x', branch: 'maybe', label: 'ok' }
      ] as unknown as WorkflowDefinition['edges']
    });

    expect(normalized.nodes).toHaveLength(2);
    // Ids fall back to type-<raw index + 1>; the two junk rows still consume indexes.
    expect(normalized.nodes[0].id).toBe('send_message-3');
    expect(normalized.nodes[0].type).toBe('send_message');
    expect(normalized.nodes[0].position).toEqual(ORIGIN);
    expect(normalized.nodes[1].kind).toBe('trigger');
    expect(normalized.nodes[1].name).toBe('');
    expect(normalized.nodes[1].position).toEqual({ x: 10, y: 20 });
    expect(normalized.nodes[1].config).toEqual({ cron: '0 6 * * *' });
    expect(normalized.nodes[1].errorStrategy).toBe('stop');
    expect(normalized.nodes[1].retries).toBe(MAX_NODE_RETRIES);

    expect(normalized.edges).toHaveLength(2);
    expect(normalized.edges[0].id).toBe('edge-3');
    expect(normalized.edges[1].id).toBe('e2');
    expect(normalized.edges[1].branch).toBeUndefined();
    expect(normalized.edges[1].label).toBe('ok');
  });

  it('clamps negative retries and keeps a description only when present', () => {
    const normalized = normalizeDefinition({
      nodes: [
        { id: 'a', type: 'add_tag', retries: -4, description: '  keep me' },
        { id: 'b', type: 'add_tag', retries: 2, description: '' }
      ] as unknown as WorkflowNode[]
    });
    expect(normalized.nodes[0].retries).toBe(0);
    expect(normalized.nodes[0].description).toBe('  keep me');
    expect(normalized.nodes[1].retries).toBe(2);
    expect(normalized.nodes[1].description).toBeUndefined();
  });

  it('round trips a definition through JSON', () => {
    const def = branching();
    const raw = serializeDefinition(def);
    expect(typeof raw).toBe('string');
    expect(deserializeDefinition(raw)).toEqual(normalizeDefinition(def));
  });

  it('returns an empty graph for missing or corrupt JSON', () => {
    expect(deserializeDefinition(null)).toEqual({ nodes: [], edges: [] });
    expect(deserializeDefinition('')).toEqual({ nodes: [], edges: [] });
    expect(deserializeDefinition('   ')).toEqual({ nodes: [], edges: [] });
    expect(deserializeDefinition('{not json')).toEqual({ nodes: [], edges: [] });
  });
});

describe('workflowGraph validation', () => {
  it('reports an empty canvas before anything else', () => {
    const result = validateDefinition(emptyDefinition());
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([issue('EMPTY')]);
    expect(codesOf(result)).toEqual(['EMPTY']);
  });

  it('accepts the minimal trigger to action graph', () => {
    const result = validateDefinition(minimal());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('demands a trigger and at least one action', () => {
    const action = createNode('add_tag', ORIGIN, 'a1');
    action.config.tag = 'vip';
    expect(codesOf(validateDefinition({ nodes: [action], edges: [] }))).toEqual([
      'NO_TRIGGER',
      'ORPHAN_NODE'
    ]);

    const triggerOnly: WorkflowDefinition = {
      nodes: [createNode('customer_created', ORIGIN, 't1')],
      edges: []
    };
    // A lone trigger is reachable from itself, so it is not reported as an orphan.
    expect(codesOf(validateDefinition(triggerOnly))).toEqual(['NO_ACTION']);
  });

  it('flags every trigger after the first', () => {
    const def = minimal();
    const extra = createNode('schedule', { x: 0, y: 300 }, 't2');
    extra.config.cron = '0 6 * * *';
    def.nodes.push(extra);
    const result = validateDefinition(def);
    expect(codesOf(result)).toContain('MULTIPLE_TRIGGERS');
    expect(issueNodeIds(result)).toContain('t2');
    expect(issueNodeIds(result)).not.toContain('t1');
  });

  it('demands both branches on a condition node', () => {
    const def = branching();
    const falseEdge = def.edges.find((edge) => edge.branch === 'false');
    const partial = withoutEdge(def, String(falseEdge?.id));
    const result = validateDefinition(partial);
    expect(codesOf(result)).toContain('CONDITION_MISSING_BRANCH');
    expect(issuesForNode(result, 'c1')).toHaveLength(1);
    expect(validateDefinition(branching()).valid).toBe(true);
  });

  it('flags a node whose required config is still blank', () => {
    const def = minimal();
    def.nodes[1].config.template = '   ';
    const result = validateDefinition(def);
    expect(codesOf(result)).toContain('MISSING_CONFIG');
    expect(issueNodeIds(result)).toEqual(['a1']);
  });

  it('separates an orphan node from an unreachable one', () => {
    const def = minimal();
    const orphan = createNode('add_tag', { x: 0, y: 400 }, 'lonely');
    orphan.config.tag = 'vip';
    def.nodes.push(orphan);
    expect(codesOf(validateDefinition(def))).toContain('ORPHAN_NODE');

    const islandA = createNode('add_tag', { x: 0, y: 600 }, 'island-a');
    islandA.config.tag = 'vip';
    const islandB = createNode('add_tag', { x: 0, y: 700 }, 'island-b');
    islandB.config.tag = 'vip';
    def.nodes.push(islandA, islandB);
    def.edges.push(createEdge('island-a', 'island-b'));
    const codes = codesOf(validateDefinition(def));
    expect(codes).toContain('ORPHAN_NODE');
    expect(codes.filter((code) => code === 'UNREACHABLE')).toHaveLength(2);
  });

  it('reports bad edges by edge id', () => {
    const def = minimal();
    def.edges.push({ id: 'self', source: 'a1', target: 'a1' });
    def.edges.push({ id: 'dangling', source: 'a1', target: 'ghost' });
    def.edges.push({ ...def.edges[0], id: 'dupe' });
    const result = validateDefinition(def);
    const codes = codesOf(result);
    expect(codes).toContain('SELF_LOOP');
    expect(codes).toContain('DANGLING_EDGE');
    expect(codes).toContain('DUPLICATE_EDGE');
    expect(issueEdgeIds(result)).toEqual(['self', 'dangling', 'dupe']);
  });

  it('counts two missing branches as two issues', () => {
    const def = minimal();
    const c9 = createNode('has_tag', { x: 0, y: 900 }, 'c9');
    c9.config.tag = 'vip';
    def.nodes.push(c9);
    def.edges.push(createEdge('t1', 'c9'));
    expect(issuesForNode(validateDefinition(def), 'c9')).toHaveLength(2);
  });

  it('builds an issue with a stable message key and optional targets', () => {
    expect(issue('CYCLE')).toEqual({ code: 'CYCLE', messageKey: 'workflow.issue.CYCLE' });
    expect(issue('CYCLE', { nodeId: 'n' })).toEqual({
      code: 'CYCLE',
      messageKey: 'workflow.issue.CYCLE',
      nodeId: 'n'
    });
    expect(issue('DUPLICATE_EDGE', { edgeId: 'e' }).edgeId).toBe('e');
  });
});

/* ==================================================================== runs */

describe('workflowRun deterministic seeds', () => {
  it('hashes to a stable non-negative integer', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    expect(hashSeed('')).toBeGreaterThan(0);
    expect(Number.isInteger(hashSeed('kili'))).toBe(true);
  });

  it('folds a seed into the unit interval', () => {
    for (const seed of ['a', 'b', 'wf-welcome', 'x:y:z']) {
      const value = seeded(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(seeded(seed)).toBe(value);
    }
  });
});

describe('workflowRun formatting', () => {
  it('renders every magnitude with the right unit', () => {
    expect(formatDuration(-5)).toBe('0 ms');
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(742)).toBe('742 ms');
    expect(formatDuration(1500)).toBe('1s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(120000)).toBe('2m');
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(3600000 + 15 * 60000)).toBe('1h 15m');
    expect(formatDuration(24 * 3600000)).toBe('1d');
    expect(formatDuration(24 * 3600000 + 3 * 3600000)).toBe('1d 3h');
  });

  it('translates the units per locale', () => {
    expect(formatDuration(742, 'zh')).toBe('742 毫秒');
    expect(formatDuration(1500, 'zh')).toBe('1 秒');
    expect(formatDuration(65000, 'zh')).toBe('1 分 5 秒');
    expect(formatDuration(1500, 'fr')).toBe('1 s');
    expect(formatDuration(65000, 'fr')).toBe('1 min 5 s');
  });
});

describe('workflowRun progress and counts', () => {
  function run(states: NodeRun['state'][], status: WorkflowRunStatus): WorkflowRun {
    return {
      id: 'r',
      workflowId: 'w',
      workflowName: 'W',
      status,
      triggerReason: 'workflow.triggerReason.customer_created',
      startedAt: NOW,
      endedAt: status === 'running' ? null : NOW + 1000,
      durationMs: status === 'running' ? 0 : 1000,
      nodeRuns: states.map((state, index) => ({
        nodeId: 'n' + index,
        nodeName: 'n' + index,
        nodeType: 'add_tag' as WorkflowNodeType,
        state,
        startedAt: state === 'pending' ? null : NOW,
        endedAt: state === 'pending' || state === 'running' ? null : NOW + 10,
        durationMs: state === 'pending' ? 0 : 10,
        attempts: 1,
        input: {},
        output: {}
      }))
    };
  }

  it('reports full progress for a finished run with no node records', () => {
    expect(progressOf(run([], 'succeeded'))).toBe(1);
    expect(progressOf(run([], 'failed'))).toBe(0);
    expect(progressOf(run([], 'running'))).toBe(0);
  });

  it('counts only terminal node states as progress', () => {
    expect(progressOf(run(['succeeded', 'succeeded', 'running', 'pending'], 'running'))).toBe(0.5);
    expect(progressOf(run(['succeeded', 'failed', 'skipped', 'pending'], 'failed'))).toBe(0.75);
    expect(progressOf(run(['succeeded'], 'succeeded'))).toBe(1);
  });

  it('buckets node runs by state, always returning all five keys', () => {
    const counts = nodeStateCounts(
      run(['succeeded', 'failed', 'running', 'pending', 'skipped'], 'failed')
    );
    expect(Object.keys(counts).sort()).toEqual([...NODE_RUN_STATES].sort());
    expect(counts).toEqual({ pending: 1, running: 1, succeeded: 1, failed: 1, skipped: 1 });
    expect(nodeStateCounts(run([], 'succeeded'))).toEqual({
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    });
  });
});

describe('workflowRun synthesis', () => {
  const workflow = { id: 'wf-welcome', name: 'New customer welcome', definition: branching() };

  it('returns no node runs for an empty graph', () => {
    expect(buildNodeRuns(emptyDefinition(), 'succeeded', { now: NOW })).toEqual([]);
  });

  it('marks every node succeeded and monotonic in time', () => {
    const runs = buildNodeRuns(branching(), 'succeeded', { now: NOW, seed: 's' });
    expect(runs.map((item) => item.nodeId)).toEqual(['t1', 'c1', 'a1']);
    expect(runs.every((item) => item.state === 'succeeded')).toBe(true);
    expect(runs.every((item) => item.endedAt !== null && item.durationMs > 0)).toBe(true);
    expect(runs[0].startedAt).toBe(NOW);
    for (let index = 1; index < runs.length; index += 1) {
      expect(runs[index].startedAt as number).toBeGreaterThan(runs[index - 1].startedAt as number);
    }
    expect(runs.every((item) => item.output.ok === true)).toBe(true);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = buildNodeRuns(branching(), 'failed', { now: NOW, seed: 'alpha' });
    const b = buildNodeRuns(branching(), 'failed', { now: NOW, seed: 'alpha' });
    const c = buildNodeRuns(branching(), 'failed', { now: NOW, seed: 'beta' });
    expect(a).toEqual(b);
    expect(a.map((item) => item.durationMs)).not.toEqual(c.map((item) => item.durationMs));
  });

  it('fails exactly one node and leaves the rest pending', () => {
    expect(executionOrder(branching(), { c1: 'false' })).toHaveLength(3);
    const runs = buildNodeRuns(branching(), 'failed', {
      now: NOW,
      seed: 'f',
      selection: { c1: 'false' }
    });
    expect(runs.filter((item) => item.state === 'failed')).toHaveLength(1);
    const failedAt = runs.findIndex((item) => item.state === 'failed');
    expect(failedAt).toBeGreaterThan(0);
    expect(runs.slice(0, failedAt).every((item) => item.state === 'succeeded')).toBe(true);
    expect(runs.slice(failedAt + 1).every((item) => item.state === 'pending')).toBe(true);
    expect(DEMO_ERROR_KEYS).toContain(String(runs[failedAt].error));
  });

  it('never reports attempts beyond the retry budget', () => {
    const def = branching();
    def.nodes[1].retries = 3;
    def.nodes[1].errorStrategy = 'retry';
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      for (const item of buildNodeRuns(def, 'failed', { now: NOW, seed })) {
        expect(item.attempts).toBeGreaterThanOrEqual(1);
        expect(item.attempts).toBeLessThanOrEqual(MAX_NODE_RETRIES + 1);
      }
    }
  });

  it('keeps a running run open ended with the last node in flight', () => {
    const runs = buildNodeRuns(branching(), 'running', { now: NOW, seed: 'r' });
    expect(runs[runs.length - 1].state).toBe('running');
    expect(runs[runs.length - 1].endedAt).toBeNull();
    expect(runs[runs.length - 1].durationMs).toBe(0);
    expect(runs.slice(0, -1).every((item) => item.state === 'succeeded')).toBe(true);
  });

  it('pends everything from the stop point onwards', () => {
    const runs = buildNodeRuns(branching(), 'stopped', { now: NOW, seed: 's' });
    const first = runs.findIndex((item) => item.state === 'pending');
    expect(first).toBeGreaterThan(0);
    expect(runs.slice(first).every((item) => item.state === 'pending')).toBe(true);
    expect(runs.slice(first).every((item) => item.startedAt === null)).toBe(true);
  });

  it('builds a whole run record with a stable id and trigger reason', () => {
    const first = synthesizeRun(workflow, 'succeeded', { now: NOW, seed: 'k' });
    const second = synthesizeRun(workflow, 'succeeded', { now: NOW, seed: 'k' });
    expect(first.id).toBe(second.id);
    expect(first.id.startsWith('run-')).toBe(true);
    expect(first.workflowId).toBe('wf-welcome');
    expect(first.workflowName).toBe('New customer welcome');
    expect(first.status).toBe('succeeded');
    expect(first.demo).toBe(true);
    expect(first.triggerReason).toBe('workflow.triggerReason.message_received');
    expect(first.startedAt).toBe(NOW);
    expect(first.endedAt).not.toBeNull();
    expect(first.durationMs).toBe((first.endedAt as number) - NOW);
    expect(first.durationMs).toBeGreaterThan(0);
  });

  it('leaves running and stopped runs without an end time', () => {
    for (const status of ['running', 'stopped'] as WorkflowRunStatus[]) {
      const built = synthesizeRun(workflow, status, { now: NOW });
      expect(built.endedAt, status).toBeNull();
      expect(built.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to an unknown trigger reason for a triggerless graph', () => {
    const built = synthesizeRun({ id: 'x', name: 'X', definition: emptyDefinition() }, 'succeeded', {
      now: NOW
    });
    expect(built.triggerReason).toBe('workflow.triggerReason.unknown');
    expect(built.nodeRuns).toEqual([]);
  });

  it('synthesises a newest-first history of the requested length', () => {
    const history = synthesizeRunHistory(workflow, 6, { now: NOW });
    expect(history).toHaveLength(6);
    expect(history.map((item) => item.startedAt)).toEqual(
      [...history.map((item) => item.startedAt)].sort((left, right) => right - left)
    );
    expect(history.every((item) => item.startedAt <= NOW)).toBe(true);
    expect(history.every((item) => WORKFLOW_RUN_STATUSES.includes(item.status))).toBe(true);
    expect(synthesizeRunHistory(workflow, 0, { now: NOW })).toEqual([]);
    expect(synthesizeRunHistory(workflow, -3, { now: NOW })).toEqual([]);
  });

  it('repeats a history exactly and gives each entry its own id', () => {
    const a = synthesizeRunHistory(workflow, 5, { now: NOW });
    const b = synthesizeRunHistory(workflow, 5, { now: NOW });
    expect(a.map((item) => item.id)).toEqual(b.map((item) => item.id));
    expect(new Set(a.map((item) => item.id)).size).toBe(5);
  });
});

describe('workflowRun statistics', () => {
  function fake(status: WorkflowRunStatus, durationMs: number, ended: boolean): WorkflowRun {
    return {
      id: 'r-' + status + '-' + durationMs,
      workflowId: 'w',
      workflowName: 'W',
      status,
      triggerReason: 'workflow.triggerReason.customer_created',
      startedAt: NOW,
      endedAt: ended ? NOW + durationMs : null,
      durationMs,
      nodeRuns: []
    };
  }

  it('starts from an all-zero stats block', () => {
    expect(emptyRunStats()).toEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      stopped: 0,
      running: 0,
      successRate: 0,
      averageDurationMs: 0
    });
    expect(computeRunStats([])).toEqual(emptyRunStats());
  });

  it('counts statuses and averages only finished durations', () => {
    expect(
      computeRunStats([
        fake('succeeded', 1000, true),
        fake('succeeded', 3000, true),
        fake('failed', 2000, true),
        fake('stopped', 500, true),
        fake('running', 0, false)
      ])
    ).toEqual({
      total: 5,
      succeeded: 2,
      failed: 1,
      stopped: 1,
      running: 1,
      successRate: 50,
      // (1000 + 3000 + 2000 + 500) / 4 finished runs; the running one is skipped.
      averageDurationMs: 1625
    });
  });

  it('reports a zero success rate when nothing finished', () => {
    expect(computeRunStats([fake('running', 0, false)]).successRate).toBe(0);
  });

  it('rounds the success rate to one decimal', () => {
    expect(
      computeRunStats([
        fake('succeeded', 10, true),
        fake('succeeded', 10, true),
        fake('failed', 10, true)
      ]).successRate
    ).toBe(66.7);
  });
});

/* =================================================================== nodes */

describe('workflowNodes catalogue', () => {
  it('lists every declared node type exactly once', () => {
    expect(NODE_TYPES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(NODE_TYPES.map((item) => item.type)).size).toBe(NODE_TYPES.length);
  });

  it('groups the catalogue by kind and keeps the groups exhaustive', () => {
    expect(nodesByKind('trigger').every((item) => item.kind === 'trigger')).toBe(true);
    expect(nodesByKind('condition').every((item) => item.kind === 'condition')).toBe(true);
    expect(nodesByKind('action').every((item) => item.kind === 'action')).toBe(true);
    expect(
      nodesByKind('trigger').length + nodesByKind('condition').length + nodesByKind('action').length
    ).toBe(NODE_TYPES.length);
    expect(nodesByKind('trigger').length).toBeGreaterThanOrEqual(7);
    expect(nodesByKind('condition').length).toBeGreaterThanOrEqual(5);
    expect(nodesByKind('action').length).toBeGreaterThanOrEqual(8);
  });

  it('answers the type predicates consistently with the catalogue', () => {
    expect(isTriggerType('customer_created')).toBe(true);
    expect(isTriggerType('has_tag')).toBe(false);
    expect(isConditionType('has_tag')).toBe(true);
    expect(isConditionType('send_message')).toBe(false);
    expect(isActionType('send_message')).toBe(true);
    expect(isActionType('customer_created')).toBe(false);
  });

  it('looks a type up, or falls back to a generic def of the right kind', () => {
    expect(nodeTypeDef('send_message')?.kind).toBe('action');
    expect(nodeTypeDef('nope' as WorkflowNodeType)).toBeUndefined();
    const fallback = nodeTypeDefOrFallback('nope' as WorkflowNodeType, 'trigger');
    expect(fallback.kind).toBe('trigger');
    expect(fallback.labelKey.startsWith('workflow.')).toBe(true);
    expect(nodeTypeDefOrFallback('send_message', 'trigger').type).toBe('send_message');
  });

  it('gives every def i18n keys in the workflow namespace', () => {
    for (const def of NODE_TYPES) {
      expect(def.labelKey, def.type).toMatch(/^workflow\.node\.[a-z_]+\.label$/);
      expect(def.descKey, def.type).toMatch(/^workflow\.node\.[a-z_]+\.desc$/);
      expect(['primary', 'accent', 'success', 'warning'], def.type).toContain(def.accent);
      for (const field of def.fields) {
        expect(field.labelKey, field.key).toMatch(/^workflow\.field\./);
        if (field.placeholderKey) expect(field.placeholderKey).toMatch(/^workflow\.field\./);
        if (field.helpKey) expect(field.helpKey).toMatch(/^workflow\.field\./);
        if (field.type === 'select') {
          expect(field.options?.length, field.key).toBeGreaterThan(0);
          for (const option of field.options ?? []) {
            expect(option.labelKey).toMatch(/^workflow\./);
          }
        }
        if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
          expect(field.min, field.key).toBeLessThanOrEqual(field.max);
        }
      }
    }
  });

  it('seeds config from declared defaults only', () => {
    expect(defaultConfigFor('customer_created')).toEqual({});
    expect(defaultConfigFor('message_received')).toEqual({ channel: 'whatsapp', inboundOnly: true });
    expect(defaultConfigFor('schedule').timezone).toBe(DEFAULT_TIMEZONE);
    expect(defaultConfigFor('customer_inactive').days).toBe(30);
    expect(defaultConfigFor('nope' as WorkflowNodeType)).toEqual({});
  });

  it('knows which keys are required and which are still blank', () => {
    expect(requiredKeysFor('customer_created')).toEqual([]);
    expect(requiredKeysFor('tag_changed')).toEqual(['tag', 'change']);
    expect(requiredKeysFor('schedule')).toEqual(['cron']);

    const node = createNode('tag_changed');
    expect(missingRequiredKeys(node)).toEqual(['tag']);
    expect(missingRequiredKeys({ ...node, config: { ...node.config, tag: '   ' } })).toEqual(['tag']);
    expect(missingRequiredKeys({ ...node, config: { ...node.config, tag: 'vip' } })).toEqual([]);
  });

  it('treats zero and false as filled values', () => {
    const node = createNode('customer_inactive');
    expect(node.config.days).toBe(30);
    expect(missingRequiredKeys({ ...node, config: { ...node.config, days: 0 } })).toEqual([]);
    const toggle = createNode('message_received');
    expect(
      missingRequiredKeys({ ...toggle, config: { ...toggle.config, inboundOnly: false } })
    ).toEqual([]);
  });

  it('collects every config key once, sorted', () => {
    const keys = allConfigKeys();
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('tag');
    expect(keys).toContain('template');
  });

  it('exposes the shared option lists the property panel renders', () => {
    expect(CHANNEL_OPTIONS.map((item) => item.value)).toEqual([
      'whatsapp',
      'facebook',
      'instagram',
      'tiktok'
    ]);
    expect(HTTP_METHOD_OPTIONS.map((item) => item.value)).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
    expect(ERROR_STRATEGY_OPTIONS.map((item) => item.value)).toEqual(['stop', 'continue', 'retry']);
    expect(WAIT_UNIT_OPTIONS.length).toBeGreaterThan(1);
    expect(fieldsFor('send_message').some((field) => field.key === 'template')).toBe(true);
    expect(fieldsFor('nope' as WorkflowNodeType)).toEqual([]);
  });
});

/* =============================================================== templates */

describe('workflowTemplates library', () => {
  it('ships five presets with unique ids and namespaced keys', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(5);
    expect(new Set(WORKFLOW_TEMPLATES.map((item) => item.id)).size).toBe(5);
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.id.startsWith('wf-tpl-')).toBe(true);
      expect(template.nameKey).toMatch(/^workflow\.template\.[a-z]+\.name$/);
      expect(template.descriptionKey).toMatch(/^workflow\.template\.[a-z]+\.desc$/);
      expect(template.scenarioKey).toMatch(/^workflow\.template\.scenario\.[a-z]+$/);
      expect(['simple', 'medium', 'complex']).toContain(template.complexity);
      expect(template.useCount).toBeGreaterThan(0);
      expect(template.definition.nodes.length).toBeGreaterThan(1);
    }
  });

  it('covers every scenario filter the grid offers', () => {
    expect(TEMPLATE_SCENARIOS).toHaveLength(5);
    for (const scenario of TEMPLATE_SCENARIOS) {
      expect(WORKFLOW_TEMPLATES.some((item) => item.scenarioKey === scenario), scenario).toBe(true);
    }
  });

  it('looks templates up by id and by complexity', () => {
    expect(templateById('wf-tpl-welcome')?.complexity).toBe('simple');
    expect(templateById('wf-tpl-nope')).toBeUndefined();
    expect(templatesByComplexity('simple').map((item) => item.id)).toEqual([
      'wf-tpl-welcome',
      'wf-tpl-birthday'
    ]);
    expect(templatesByComplexity('complex').map((item) => item.id)).toEqual(['wf-tpl-autoreply']);
    expect(
      templatesByComplexity('simple').length +
        templatesByComplexity('medium').length +
        templatesByComplexity('complex').length
    ).toBe(WORKFLOW_TEMPLATES.length);
  });

  it('every preset graph passes validation as shipped', () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const result = validateDefinition(template.definition);
      expect(result.issues, template.id).toEqual([]);
      expect(result.valid, template.id).toBe(true);
    }
  });

  it('instantiates a preset with fresh node and edge ids', () => {
    const template = templateById('wf-tpl-winback') ?? WORKFLOW_TEMPLATES[0];
    const copy = instantiateTemplate(template);
    expect(copy.nodes).toHaveLength(template.definition.nodes.length);
    expect(copy.edges).toHaveLength(template.definition.edges.length);
    expect(copy.nodes.map((node) => node.id)).not.toEqual(
      template.definition.nodes.map((node) => node.id)
    );
    expect(new Set(copy.nodes.map((node) => node.id)).size).toBe(copy.nodes.length);
    for (const edge of copy.edges) {
      expect(copy.nodes.some((node) => node.id === edge.source), edge.id).toBe(true);
      expect(copy.nodes.some((node) => node.id === edge.target), edge.id).toBe(true);
    }
    expect(validateDefinition(copy).valid).toBe(true);
  });

  it('keeps the shape, config and branches of the preset when instantiating', () => {
    const template = templateById('wf-tpl-autoreply') ?? WORKFLOW_TEMPLATES[0];
    const copy = instantiateTemplate(template);
    expect(copy.nodes.map((node) => node.type)).toEqual(
      template.definition.nodes.map((node) => node.type)
    );
    expect(copy.nodes.map((node) => node.position)).toEqual(
      template.definition.nodes.map((node) => node.position)
    );
    expect(copy.edges.map((edge) => edge.branch)).toEqual(
      template.definition.edges.map((edge) => edge.branch)
    );
    copy.nodes[0].config.segment = 'mutated';
    expect(template.definition.nodes[0].config.segment).not.toBe('mutated');
  });

  it('gives two instantiations of one preset disjoint ids', () => {
    const template = templateById('wf-tpl-welcome') ?? WORKFLOW_TEMPLATES[0];
    expect(instantiateTemplate(template).nodes.map((node) => node.id)).not.toEqual(
      instantiateTemplate(template).nodes.map((node) => node.id)
    );
  });
});
