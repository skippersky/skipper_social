/**
 * Workflow graph engine (Sprint 12).
 *
 * Pure data in, pure data out: no Vue, no Vue Flow, no timers, no storage. The
 * canvas is a renderer sitting on top of this module, which owns id generation,
 * structural validation, layered layout, JSON round tripping and the replay
 * order the run timeline paints. Keeping the rules here means a graph can be
 * checked in a unit test exactly the way the builder checks it before a
 * workflow is allowed to go active.
 */
import { MAX_NODE_RETRIES } from '../types';
import type {
  ConditionBranch,
  NodeConfig,
  NodeConfigValue,
  NodeErrorStrategy,
  NodePosition,
  TriggerKind,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowIssue,
  WorkflowIssueCode,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowNodeType,
  WorkflowValidation
} from '../types';
import { defaultConfigFor, missingRequiredKeys, nodeTypeDef, nodeTypeDefOrFallback } from './workflowNodes';

/** Column spacing used by autoLayout: about one node width plus breathing room. */
export const X_GAP = 260;
export const Y_GAP = 140;
export const ORIGIN: NodePosition = { x: 40, y: 40 };

/** Per condition node branch choice; replays one concrete path through the graph. */
export type BranchSelection = Record<string, ConditionBranch>;

/** Why a drag-connect was refused; the composable maps it onto an i18n key. */
export type ConnectProblem = 'missing-node' | 'self-loop' | 'duplicate';

export interface DefinitionSummary {
  nodes: number;
  edges: number;
  triggers: number;
  conditions: number;
  actions: number;
  /** Longest trigger to leaf chain, in nodes. Zero for an empty graph. */
  depth: number;
}

let sequence = 0;

/** Test hook: ids become predictable again after a reset. */
export function resetNodeIdSequence(): void {
  sequence = 0;
}

function token(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function nextNodeId(type: WorkflowNodeType): string {
  sequence += 1;
  return type + '-' + sequence.toString(36) + '-' + token();
}

export function nextEdgeId(source: string, target: string, branch?: ConditionBranch): string {
  return 'edge-' + source + '-' + target + (branch ? '-' + branch : '') + '-' + token();
}

function isKind(value: unknown): value is WorkflowNodeKind {
  return value === 'trigger' || value === 'condition' || value === 'action';
}

function isStrategy(value: unknown): value is NodeErrorStrategy {
  return value === 'stop' || value === 'continue' || value === 'retry';
}

function isBranch(value: unknown): value is ConditionBranch {
  return value === 'true' || value === 'false';
}

/* ----------------------------------------------------------------- catalogue */

export function kindOfType(type: WorkflowNodeType): WorkflowNodeKind {
  return nodeTypeDef(type)?.kind ?? 'action';
}

export function labelKeyFor(node: Pick<WorkflowNode, 'type' | 'kind'>): string {
  return nodeTypeDefOrFallback(node.type, node.kind).labelKey;
}

export function descKeyFor(node: Pick<WorkflowNode, 'type' | 'kind'>): string {
  return nodeTypeDefOrFallback(node.type, node.kind).descKey;
}

/* -------------------------------------------------------------------- create */

export function emptyDefinition(): WorkflowDefinition {
  return { nodes: [], edges: [] };
}

/** A fresh node already carries its field defaults, so it is one edit from valid. */
export function createNode(
  type: WorkflowNodeType,
  position: NodePosition = { ...ORIGIN },
  id?: string
): WorkflowNode {
  return {
    id: id ?? nextNodeId(type),
    kind: kindOfType(type),
    type,
    name: '',
    position: { x: position.x, y: position.y },
    config: defaultConfigFor(type),
    errorStrategy: 'stop',
    retries: 0
  };
}

export function createEdge(source: string, target: string, branch?: ConditionBranch): WorkflowEdge {
  const edge: WorkflowEdge = { id: nextEdgeId(source, target, branch), source, target };
  if (branch) edge.branch = branch;
  return edge;
}

/* --------------------------------------------------------------------- query */

export function nodeById(def: WorkflowDefinition, id: string): WorkflowNode | undefined {
  return def.nodes.find((node) => node.id === id);
}

export function nodesOfKind(def: WorkflowDefinition, kind: WorkflowNodeKind): WorkflowNode[] {
  return def.nodes.filter((node) => node.kind === kind);
}

/** The single trigger of a well formed graph; with several, the first declared. */
export function triggerOf(def: WorkflowDefinition): WorkflowNode | null {
  const triggers = nodesOfKind(def, 'trigger');
  return triggers.length > 0 ? triggers[0] : null;
}

export function triggerKindOf(def: WorkflowDefinition): TriggerKind | null {
  const trigger = triggerOf(def);
  return trigger ? (trigger.type as TriggerKind) : null;
}

export function outgoing(def: WorkflowDefinition, id: string): WorkflowEdge[] {
  return def.edges.filter((edge) => edge.source === id);
}

export function incoming(def: WorkflowDefinition, id: string): WorkflowEdge[] {
  return def.edges.filter((edge) => edge.target === id);
}

export function findEdge(
  def: WorkflowDefinition,
  source: string,
  target: string,
  branch?: ConditionBranch
): WorkflowEdge | undefined {
  return def.edges.find(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (edge.branch ?? undefined) === (branch ?? undefined)
  );
}

export function isIsolated(def: WorkflowDefinition, id: string): boolean {
  return incoming(def, id).length === 0 && outgoing(def, id).length === 0;
}

export function canConnect(
  def: WorkflowDefinition,
  source: string,
  target: string,
  branch?: ConditionBranch
): ConnectProblem | null {
  if (!nodeById(def, source) || !nodeById(def, target)) return 'missing-node';
  if (source === target) return 'self-loop';
  if (findEdge(def, source, target, branch)) return 'duplicate';
  return null;
}

/* -------------------------------------------------------------------- mutate */

export function cloneDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    nodes: def.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      config: { ...node.config }
    })),
    edges: def.edges.map((edge) => ({ ...edge }))
  };
}

export function withNode(def: WorkflowDefinition, node: WorkflowNode): WorkflowDefinition {
  const exists = def.nodes.some((item) => item.id === node.id);
  return {
    nodes: exists
      ? def.nodes.map((item) => (item.id === node.id ? node : item))
      : [...def.nodes, node],
    edges: [...def.edges]
  };
}

/** Removes the node and every edge touching it, so no dangling edge can survive. */
export function withoutNode(def: WorkflowDefinition, id: string): WorkflowDefinition {
  return {
    nodes: def.nodes.filter((node) => node.id !== id),
    edges: def.edges.filter((edge) => edge.source !== id && edge.target !== id)
  };
}

export function withNodePatch(
  def: WorkflowDefinition,
  id: string,
  patch: Partial<WorkflowNode>
): WorkflowDefinition {
  return {
    nodes: def.nodes.map((node) => {
      if (node.id !== id) return node;
      const next: WorkflowNode = { ...node, ...patch, id: node.id };
      if (patch.position) next.position = { ...patch.position };
      if (patch.config) next.config = { ...patch.config };
      return next;
    }),
    edges: [...def.edges]
  };
}

export function withConfigPatch(
  def: WorkflowDefinition,
  id: string,
  patch: NodeConfig
): WorkflowDefinition {
  return {
    nodes: def.nodes.map((node) =>
      node.id === id ? { ...node, config: { ...node.config, ...patch } } : node
    ),
    edges: [...def.edges]
  };
}

/** Refuses a bad connection instead of silently adding it; see canConnect. */
export function withEdge(
  def: WorkflowDefinition,
  source: string,
  target: string,
  branch?: ConditionBranch
): WorkflowDefinition {
  if (canConnect(def, source, target, branch)) return cloneDefinition(def);
  return { nodes: [...def.nodes], edges: [...def.edges, createEdge(source, target, branch)] };
}

export function withoutEdge(def: WorkflowDefinition, edgeId: string): WorkflowDefinition {
  return { nodes: [...def.nodes], edges: def.edges.filter((edge) => edge.id !== edgeId) };
}

export function withPositions(
  def: WorkflowDefinition,
  positions: Record<string, NodePosition>
): WorkflowDefinition {
  return {
    nodes: def.nodes.map((node) =>
      positions[node.id] ? { ...node, position: { ...positions[node.id] } } : node
    ),
    edges: [...def.edges]
  };
}

/* ------------------------------------------------------------------ traverse */

export function reachableFrom(def: WorkflowDefinition, startId: string): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of outgoing(def, id)) {
      if (!seen.has(edge.target)) queue.push(edge.target);
    }
  }
  return seen;
}

/** Node ids forming the first cycle found, empty when the graph is acyclic. */
export function findCycle(def: WorkflowDefinition): string[] {
  const state = new Map<string, number>();
  const stack: string[] = [];
  let found: string[] = [];

  function visit(id: string): boolean {
    state.set(id, 1);
    stack.push(id);
    for (const edge of outgoing(def, id)) {
      if (!nodeById(def, edge.target)) continue;
      const mark = state.get(edge.target) ?? 0;
      if (mark === 1) {
        const at = stack.indexOf(edge.target);
        found = at >= 0 ? stack.slice(at) : [edge.target];
        return true;
      }
      if (mark === 0 && visit(edge.target)) return true;
    }
    stack.pop();
    state.set(id, 2);
    return false;
  }

  for (const node of def.nodes) {
    if ((state.get(node.id) ?? 0) === 0 && visit(node.id)) break;
  }
  return found;
}

export function hasCycle(def: WorkflowDefinition): boolean {
  return findCycle(def).length > 0;
}

/**
 * Replay order for one run. Condition nodes follow the selected branch, which
 * defaults to the true side, so the timeline can show either path.
 */
export function executionOrder(
  def: WorkflowDefinition,
  selection: BranchSelection = {}
): WorkflowNode[] {
  const start = triggerOf(def);
  if (!start) return [];
  const order: WorkflowNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [start.id];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeById(def, id);
    if (!node) continue;
    order.push(node);
    let next = outgoing(def, id);
    if (node.kind === 'condition') {
      const branch = selection[id] ?? 'true';
      const chosen = next.filter((edge) => edge.branch === branch);
      next = chosen.length > 0 ? chosen : next.filter((edge) => !edge.branch);
    }
    for (const edge of next) {
      if (!visited.has(edge.target)) queue.push(edge.target);
    }
  }
  return order;
}

function depthMap(def: WorkflowDefinition): Map<string, number> {
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodesOfKind(def, 'trigger')) {
    depth.set(node.id, 0);
    queue.push(node.id);
  }
  /* Unconnected or triggerless fragments still get a column instead of piling up. */
  for (const node of def.nodes) {
    if (depth.has(node.id)) continue;
    if (incoming(def, node.id).length === 0) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const base = depth.get(id) ?? 0;
    for (const edge of outgoing(def, id)) {
      if (depth.has(edge.target)) continue;
      depth.set(edge.target, base + 1);
      queue.push(edge.target);
    }
  }
  for (const node of def.nodes) {
    if (!depth.has(node.id)) depth.set(node.id, 0);
  }
  return depth;
}

/** Breadth first columns, so a trigger reads left to right into its actions. */
export function autoLayout(def: WorkflowDefinition): WorkflowDefinition {
  if (def.nodes.length === 0) return cloneDefinition(def);
  const depth = depthMap(def);
  const used = new Map<number, number>();
  return {
    nodes: def.nodes.map((node) => {
      const column = depth.get(node.id) ?? 0;
      const row = used.get(column) ?? 0;
      used.set(column, row + 1);
      return {
        ...node,
        position: { x: ORIGIN.x + column * X_GAP, y: ORIGIN.y + row * Y_GAP }
      };
    }),
    edges: def.edges.map((edge) => ({ ...edge }))
  };
}

export function summarizeDefinition(def: WorkflowDefinition): DefinitionSummary {
  const depth = depthMap(def);
  let deepest = 0;
  for (const value of depth.values()) deepest = Math.max(deepest, value);
  return {
    nodes: def.nodes.length,
    edges: def.edges.length,
    triggers: nodesOfKind(def, 'trigger').length,
    conditions: nodesOfKind(def, 'condition').length,
    actions: nodesOfKind(def, 'action').length,
    depth: def.nodes.length === 0 ? 0 : deepest + 1
  };
}

/* ---------------------------------------------------------------- serialise */

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : fallback;
}

/** Config stays flat and JSON safe: anything else the server sends is dropped. */
function normalizeConfig(input: unknown): NodeConfig {
  const out: NodeConfig = {};
  if (!input || typeof input !== 'object') return out;
  for (const entry of Object.entries(input as Record<string, unknown>)) {
    const value = entry[1];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'boolean') {
      out[entry[0]] = value as NodeConfigValue;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[entry[0]] = value;
    }
  }
  return out;
}

function normalizeNode(input: unknown, index: number): WorkflowNode | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<WorkflowNode> & Record<string, unknown>;
  const type = (typeof raw.type === 'string' && raw.type.trim()
    ? raw.type
    : 'send_message') as WorkflowNodeType;
  const kind = isKind(raw.kind) ? raw.kind : kindOfType(type);
  const rawPosition = (raw.position && typeof raw.position === 'object'
    ? raw.position
    : {}) as Partial<NodePosition>;
  const retries = Math.round(toFiniteNumber(raw.retries, 0));
  const node: WorkflowNode = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : type + '-' + (index + 1),
    kind,
    type,
    name: typeof raw.name === 'string' ? raw.name : '',
    position: {
      x: toFiniteNumber(rawPosition.x, ORIGIN.x),
      y: toFiniteNumber(rawPosition.y, ORIGIN.y)
    },
    config: normalizeConfig(raw.config),
    errorStrategy: isStrategy(raw.errorStrategy) ? raw.errorStrategy : 'stop',
    retries: Math.min(MAX_NODE_RETRIES, Math.max(0, retries))
  };
  if (typeof raw.description === 'string' && raw.description) node.description = raw.description;
  return node;
}

function normalizeEdge(input: unknown, index: number): WorkflowEdge | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<WorkflowEdge>;
  const source = typeof raw.source === 'string' ? raw.source.trim() : '';
  const target = typeof raw.target === 'string' ? raw.target.trim() : '';
  if (!source || !target) return null;
  const edge: WorkflowEdge = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : 'edge-' + (index + 1),
    source,
    target
  };
  if (isBranch(raw.branch)) edge.branch = raw.branch;
  if (typeof raw.label === 'string' && raw.label) edge.label = raw.label;
  return edge;
}

/** Coerces anything the API or a pasted JSON blob contains into a usable graph. */
export function normalizeDefinition(input?: Partial<WorkflowDefinition> | null): WorkflowDefinition {
  const source = input ?? {};
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const rawEdges = Array.isArray(source.edges) ? source.edges : [];
  const nodes: WorkflowNode[] = [];
  rawNodes.forEach((raw, index) => {
    const node = normalizeNode(raw, index);
    if (node) nodes.push(node);
  });
  const edges: WorkflowEdge[] = [];
  rawEdges.forEach((raw, index) => {
    const edge = normalizeEdge(raw, index);
    if (edge) edges.push(edge);
  });
  return { nodes, edges };
}

export function serializeDefinition(def: WorkflowDefinition): string {
  return JSON.stringify(normalizeDefinition(def));
}

export function deserializeDefinition(raw: string | null | undefined): WorkflowDefinition {
  if (!raw || raw.trim() === '') return emptyDefinition();
  try {
    return normalizeDefinition(JSON.parse(raw) as Partial<WorkflowDefinition>);
  } catch {
    return emptyDefinition();
  }
}

/* --------------------------------------------------------------- validation */

export function issue(
  code: WorkflowIssueCode,
  target: { nodeId?: string; edgeId?: string } = {}
): WorkflowIssue {
  const out: WorkflowIssue = { code, messageKey: 'workflow.issue.' + code };
  if (target.nodeId) out.nodeId = target.nodeId;
  if (target.edgeId) out.edgeId = target.edgeId;
  return out;
}

/**
 * Every structural rule the engine needs before a workflow may go active.
 * Issues come out in a stable order (counts, then edges, then condition
 * branches, then per node config, then reachability, then cycles) so the panel
 * and the tests agree on which problem to show first.
 */
export function validateDefinition(def: WorkflowDefinition): WorkflowValidation {
  const graph = normalizeDefinition(def);
  const issues: WorkflowIssue[] = [];

  if (graph.nodes.length === 0) {
    return { valid: false, issues: [issue('EMPTY')] };
  }

  const triggers = nodesOfKind(graph, 'trigger');
  if (triggers.length === 0) {
    issues.push(issue('NO_TRIGGER'));
  } else if (triggers.length > 1) {
    for (const extra of triggers.slice(1)) {
      issues.push(issue('MULTIPLE_TRIGGERS', { nodeId: extra.id }));
    }
  }
  if (nodesOfKind(graph, 'action').length === 0) issues.push(issue('NO_ACTION'));

  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === edge.target) {
      issues.push(issue('SELF_LOOP', { nodeId: edge.source, edgeId: edge.id }));
      continue;
    }
    if (!nodeById(graph, edge.source) || !nodeById(graph, edge.target)) {
      issues.push(issue('DANGLING_EDGE', { edgeId: edge.id }));
      continue;
    }
    const key = edge.source + '=>' + edge.target + '#' + (edge.branch ?? '-');
    if (seen.has(key)) {
      issues.push(issue('DUPLICATE_EDGE', { edgeId: edge.id }));
      continue;
    }
    seen.add(key);
  }

  for (const node of graph.nodes) {
    if (node.kind !== 'condition') continue;
    const branches = new Set(
      outgoing(graph, node.id)
        .map((edge) => edge.branch)
        .filter((branch): branch is ConditionBranch => isBranch(branch))
    );
    if (!branches.has('true')) issues.push(issue('CONDITION_MISSING_BRANCH', { nodeId: node.id }));
    if (!branches.has('false')) issues.push(issue('CONDITION_MISSING_BRANCH', { nodeId: node.id }));
  }

  for (const node of graph.nodes) {
    if (missingRequiredKeys(node).length > 0) issues.push(issue('MISSING_CONFIG', { nodeId: node.id }));
  }

  if (triggers.length > 0) {
    const reached = new Set<string>();
    for (const trigger of triggers) {
      for (const id of reachableFrom(graph, trigger.id)) reached.add(id);
    }
    for (const node of graph.nodes) {
      if (reached.has(node.id)) continue;
      issues.push(issue(isIsolated(graph, node.id) ? 'ORPHAN_NODE' : 'UNREACHABLE', { nodeId: node.id }));
    }
  } else {
    for (const node of graph.nodes) {
      if (isIsolated(graph, node.id)) issues.push(issue('ORPHAN_NODE', { nodeId: node.id }));
    }
  }

  const cycle = findCycle(graph);
  if (cycle.length > 0) issues.push(issue('CYCLE', { nodeId: cycle[0] }));

  return { valid: issues.length === 0, issues };
}

export function issueNodeIds(validation: WorkflowValidation): string[] {
  const ids: string[] = [];
  for (const item of validation.issues) {
    if (item.nodeId && !ids.includes(item.nodeId)) ids.push(item.nodeId);
  }
  return ids;
}

export function issueEdgeIds(validation: WorkflowValidation): string[] {
  const ids: string[] = [];
  for (const item of validation.issues) {
    if (item.edgeId && !ids.includes(item.edgeId)) ids.push(item.edgeId);
  }
  return ids;
}

export function issuesForNode(validation: WorkflowValidation, nodeId: string): WorkflowIssue[] {
  return validation.issues.filter((item) => item.nodeId === nodeId);
}

export function codesOf(validation: WorkflowValidation): WorkflowIssueCode[] {
  return validation.issues.map((item) => item.code);
}
