/**
 * Workflow run synthesis and statistics (Sprint 12).
 *
 * The workflow engine lives on the server, so the browser never executes a
 * graph. What it does need is a faithful replay: the timeline, the execution
 * path and the stats strip are all driven by NodeRun records. This module turns
 * a definition plus an outcome into those records deterministically, which is
 * what lets the demo backend show a plausible run and the tests assert on exact
 * numbers instead of ranges.
 *
 * Determinism matters more than realism: seeds hash their own ids, never call
 * Math.random, so the same workflow renders the same run twice.
 */
import { messages } from '../i18n/messages';
import type { UiLocale } from '../i18n/messages';
import { executionOrder } from './workflowGraph';
import type { BranchSelection } from './workflowGraph';
import { MAX_NODE_RETRIES } from '../types';
import type {
  NodeRun,
  NodeRunState,
  Workflow,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStats,
  WorkflowRunStatus
} from '../types';

/** Outcomes the demo backend can synthesise; mirrors WorkflowRunStatus. */
export type RunOutcome = WorkflowRunStatus;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEMO_ERROR_KEYS: string[] = [
  'workflow.run.error.timeout',
  'workflow.run.error.channel',
  'workflow.run.error.rateLimit',
  'workflow.run.error.generic'
];

export interface RunSeedOptions {
  /** Anchor timestamp; every node time is derived from it. */
  now?: number;
  /** Extra salt so two runs of one workflow differ but stay repeatable. */
  seed?: string;
  /** Concrete branch choices, used to replay one path through a condition. */
  selection?: BranchSelection;
}

/** Stable 32 bit hash, folded to 0..1 by callers that need a fraction. */
export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Deterministic 0..1 value for a seed; the demo equivalent of Math.random. */
export function seeded(seed: string): number {
  return (hashSeed(seed) % 10000) / 10000;
}

/** Pick one entry from a list without randomness. */
function pick<T>(seed: string, list: readonly T[]): T {
  return list[hashSeed(seed) % list.length];
}

function between(seed: string, min: number, max: number): number {
  return Math.round(min + seeded(seed) * (max - min));
}

export function formatDuration(ms: number, locale: UiLocale = 'en'): string {
  const table = messages[locale] ?? messages.en;
  const safe = Math.max(0, Math.round(ms));
  function unit(key: string, value: number): string {
    return (table[key] ?? String(value)).replace('{n}', String(value));
  }
  if (safe < SECOND) return unit('workflow.duration.ms', safe);
  if (safe < MINUTE) return unit('workflow.duration.second', Math.floor(safe / SECOND));
  if (safe < HOUR) {
    const minutes = Math.floor(safe / MINUTE);
    const seconds = Math.floor((safe % MINUTE) / SECOND);
    return seconds > 0
      ? unit('workflow.duration.minute', minutes) + ' ' + unit('workflow.duration.second', seconds)
      : unit('workflow.duration.minute', minutes);
  }
  if (safe < DAY) {
    const hours = Math.floor(safe / HOUR);
    const minutes = Math.floor((safe % HOUR) / MINUTE);
    return minutes > 0
      ? unit('workflow.duration.hour', hours) + ' ' + unit('workflow.duration.minute', minutes)
      : unit('workflow.duration.hour', hours);
  }
  const days = Math.floor(safe / DAY);
  const hours = Math.floor((safe % DAY) / HOUR);
  return hours > 0
    ? unit('workflow.duration.day', days) + ' ' + unit('workflow.duration.hour', hours)
    : unit('workflow.duration.day', days);
}

/** How far a run has got, 0..1, for the progress bar on the run list. */
export function progressOf(run: WorkflowRun): number {
  if (run.nodeRuns.length === 0) return run.status === 'succeeded' ? 1 : 0;
  const done = run.nodeRuns.filter(
    (item) => item.state === 'succeeded' || item.state === 'failed' || item.state === 'skipped'
  ).length;
  return Math.min(1, done / run.nodeRuns.length);
}

export function nodeStateCounts(run: WorkflowRun): Record<NodeRunState, number> {
  const counts: Record<NodeRunState, number> = {
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0
  };
  for (const item of run.nodeRuns) counts[item.state] += 1;
  return counts;
}

function nodeDurationMs(nodeId: string, salt: string): number {
  return between(nodeId + ':' + salt + ':duration', 180, 2400);
}

function attemptsFor(state: NodeRunState, retries: number, salt: string, nodeId: string): number {
  if (state !== 'failed') return 1;
  const allowed = Math.min(MAX_NODE_RETRIES, Math.max(0, retries));
  if (allowed === 0) return 1;
  return 1 + (hashSeed(nodeId + ':' + salt) % allowed);
}

/**
 * Walks the replay order and paints each node with a state consistent with the
 * overall outcome: a failed run has exactly one failed node and everything
 * after it stays pending, which is what an operator expects to see.
 */
export function buildNodeRuns(
  def: WorkflowDefinition,
  outcome: RunOutcome,
  options: RunSeedOptions = {}
): NodeRun[] {
  const salt = options.seed ?? 'run';
  const start = options.now ?? Date.now();
  const order = executionOrder(def, options.selection);
  if (order.length === 0) return [];

  const failureIndex =
    outcome === 'failed' ? Math.max(1, hashSeed(order[0].id + ':' + salt) % order.length) : -1;
  const runningIndex = outcome === 'running' ? Math.max(1, order.length - 1) : -1;
  const stoppedIndex =
    outcome === 'stopped' ? Math.max(1, hashSeed(salt + ':' + order.length) % order.length) : -1;

  let cursor = start;
  const runs: NodeRun[] = [];
  for (let index = 0; index < order.length; index += 1) {
    const node = order[index];
    let state: NodeRunState = 'succeeded';
    if (failureIndex >= 0 && index === failureIndex) state = 'failed';
    else if (runningIndex >= 0 && index === runningIndex) state = 'running';
    else if (stoppedIndex >= 0 && index >= stoppedIndex) state = 'pending';
    else if (failureIndex >= 0 && index > failureIndex) state = 'pending';

    const pending = state === 'pending';
    const duration = pending ? 0 : nodeDurationMs(node.id, salt);
    const attempts = attemptsFor(state, node.retries, salt, node.id);
    const run: NodeRun = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      state,
      startedAt: pending ? null : cursor,
      endedAt: pending || state === 'running' ? null : cursor + duration,
      durationMs: state === 'running' ? 0 : duration,
      attempts,
      input: pending ? {} : { nodeType: node.type, configKeys: Object.keys(node.config).length },
      output:
        state === 'succeeded' ? { ok: true, attempts, channel: node.config.channel ?? null } : {}
    };
    if (state === 'failed') run.error = pick(node.id + ':' + salt, DEMO_ERROR_KEYS);
    runs.push(run);
    cursor += duration + between(node.id + ':' + salt + ':gap', 40, 320);
  }
  return runs;
}

/** One complete run record for a workflow, ready to hand to the timeline. */
export function synthesizeRun(
  workflow: Pick<Workflow, 'id' | 'name' | 'definition'>,
  outcome: RunOutcome,
  options: RunSeedOptions = {}
): WorkflowRun {
  const salt = options.seed ?? workflow.id;
  const nodeRuns = buildNodeRuns(workflow.definition, outcome, { ...options, seed: salt });
  const startedAt = options.now ?? Date.now();
  const finished = nodeRuns.filter((item) => item.endedAt !== null);
  const lastEnd =
    finished.length > 0 ? Math.max(...finished.map((item) => item.endedAt as number)) : null;
  const endedAt = outcome === 'running' || outcome === 'stopped' ? null : lastEnd;
  const durationMs =
    endedAt === null
      ? Math.max(0, (lastEnd ?? startedAt) - startedAt)
      : Math.max(0, endedAt - startedAt);
  return {
    id: 'run-' + hashSeed(workflow.id + ':' + salt).toString(36),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: outcome,
    triggerReason: 'workflow.triggerReason.' + (workflow.definition.nodes[0]?.type ?? 'unknown'),
    startedAt,
    endedAt,
    durationMs,
    nodeRuns,
    demo: true
  };
}

/**
 * A spread of outcomes for one workflow, newest first. The mix is derived from
 * the workflow id so the same workflow always shows the same history.
 */
export function synthesizeRunHistory(
  workflow: Pick<Workflow, 'id' | 'name' | 'definition'>,
  count: number,
  options: RunSeedOptions = {}
): WorkflowRun[] {
  const now = options.now ?? Date.now();
  const total = Math.max(0, count);
  const runs: WorkflowRun[] = [];
  for (let index = 0; index < total; index += 1) {
    const salt = workflow.id + ':' + String(index);
    const roll = seeded(salt);
    let outcome: RunOutcome = 'succeeded';
    if (roll > 0.94) outcome = 'failed';
    else if (roll > 0.88) outcome = 'stopped';
    else if (roll > 0.85 && index === 0) outcome = 'running';
    const startedAt = now - index * between(salt + ':spacing', 20, 190) * MINUTE;
    runs.push(synthesizeRun(workflow, outcome, { now: startedAt, seed: salt }));
  }
  return runs.sort((left, right) => right.startedAt - left.startedAt);
}

export function emptyRunStats(): WorkflowRunStats {
  return {
    total: 0,
    succeeded: 0,
    failed: 0,
    stopped: 0,
    running: 0,
    successRate: 0,
    averageDurationMs: 0
  };
}

/**
 * Headline numbers for the runs page. successRate is a percentage (0..100) over
 * finished runs only, so an in-flight run does not drag the rate down.
 */
export function computeRunStats(runs: readonly WorkflowRun[]): WorkflowRunStats {
  const stats = emptyRunStats();
  let durationSum = 0;
  let durationCount = 0;
  for (const run of runs) {
    stats.total += 1;
    if (run.status === 'succeeded') stats.succeeded += 1;
    else if (run.status === 'failed') stats.failed += 1;
    else if (run.status === 'stopped') stats.stopped += 1;
    else stats.running += 1;
    if (run.endedAt !== null && run.durationMs > 0) {
      durationSum += run.durationMs;
      durationCount += 1;
    }
  }
  const finished = stats.succeeded + stats.failed + stats.stopped;
  stats.successRate = finished > 0 ? Math.round((stats.succeeded / finished) * 1000) / 10 : 0;
  stats.averageDurationMs = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;
  return stats;
}
