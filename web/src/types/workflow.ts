/**
 * Automation workflow domain types (Sprint 12).
 *
 * A workflow is a plain directed graph: nodes carry a coarse kind
 * (trigger / condition / action) plus a concrete type discriminant, and edges
 * carry an optional branch label for the two outputs of a condition node.
 *
 * Nothing here imports Vue. That is deliberate: lib/workflowGraph validates,
 * lays out, serialises and replays the graph as pure data, so the engine rules
 * are testable without a canvas and Vue Flow stays a thin renderer on top.
 */

/** Coarse family; drives palette grouping, node colour and validation rules. */
export type WorkflowNodeKind = 'trigger' | 'condition' | 'action';

/** Trigger nodes reuse events already emitted by Sprints 6, 7 and 11. */
export type TriggerKind =
  | 'customer_created'
  | 'tag_changed'
  | 'message_received'
  | 'marketing_response'
  | 'schedule'
  | 'customer_birthday'
  | 'customer_inactive';

export type ConditionKind =
  | 'has_tag'
  | 'in_segment'
  | 'channel_is'
  | 'time_window'
  | 'expression';

/** Action nodes call back into the conversation, customer, marketing and notification APIs. */
export type ActionKind =
  | 'send_message'
  | 'add_tag'
  | 'remove_tag'
  | 'move_segment'
  | 'trigger_campaign'
  | 'send_notification'
  | 'wait'
  | 'http_request'
  | 'update_profile';

export type WorkflowNodeType = TriggerKind | ConditionKind | ActionKind;

export const TRIGGER_KINDS: TriggerKind[] = [
  'customer_created',
  'tag_changed',
  'message_received',
  'marketing_response',
  'schedule',
  'customer_birthday',
  'customer_inactive'
];

export const CONDITION_KINDS: ConditionKind[] = [
  'has_tag',
  'in_segment',
  'channel_is',
  'time_window',
  'expression'
];

export const ACTION_KINDS: ActionKind[] = [
  'send_message',
  'add_tag',
  'remove_tag',
  'move_segment',
  'trigger_campaign',
  'send_notification',
  'wait',
  'http_request',
  'update_profile'
];

export const WORKFLOW_NODE_KINDS: WorkflowNodeKind[] = ['trigger', 'condition', 'action'];

/** draft = never published, active = the engine listens, paused = the engine ignores. */
export type WorkflowStatus = 'draft' | 'active' | 'paused';

export const WORKFLOW_STATUSES: WorkflowStatus[] = ['draft', 'active', 'paused'];

export type WorkflowRunStatus = 'running' | 'succeeded' | 'failed' | 'stopped';

export const WORKFLOW_RUN_STATUSES: WorkflowRunStatus[] = ['running', 'succeeded', 'failed', 'stopped'];

/** Per node state, painted onto the execution path view. */
export type NodeRunState = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export const NODE_RUN_STATES: NodeRunState[] = ['pending', 'running', 'succeeded', 'failed', 'skipped'];

/** What the engine does when an action node throws. */
export type NodeErrorStrategy = 'stop' | 'continue' | 'retry';

export const NODE_ERROR_STRATEGIES: NodeErrorStrategy[] = ['stop', 'continue', 'retry'];

/** Retry ceiling; the property panel clamps to this so a typo cannot spin forever. */
export const MAX_NODE_RETRIES = 5;

export type ConditionBranch = 'true' | 'false';

export const CONDITION_BRANCHES: ConditionBranch[] = ['true', 'false'];

export interface NodePosition {
  x: number;
  y: number;
}

/** Config values stay flat and JSON safe so a graph round trips through the API untouched. */
export type NodeConfigValue = string | number | boolean;

export type NodeConfig = Record<string, NodeConfigValue | undefined>;

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  position: NodePosition;
  config: NodeConfig;
  errorStrategy: NodeErrorStrategy;
  /** Attempts allowed on top of the first try when errorStrategy is 'retry'. */
  retries: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  /** Present only on the two outgoing edges of a condition node. */
  branch?: ConditionBranch;
  label?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  /** Denormalised from the single trigger node so list rows need no graph walk. */
  triggerKind: TriggerKind | null;
  nodeCount: number;
  todayRuns: number;
  successRuns: number;
  failedRuns: number;
  lastRunAt: number | null;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface WorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  status?: WorkflowStatus;
}

export interface WorkflowListParams {
  query?: string;
  status?: WorkflowStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface PagedWorkflows {
  workflows: Workflow[];
  total: number;
  hasMore: boolean;
}

/** Headline tiles on the workflow list page. */
export interface WorkflowOverview {
  activeWorkflows: number;
  todayTriggers: number;
  todaySucceeded: number;
  todayFailed: number;
}

export type WorkflowIssueCode =
  | 'EMPTY'
  | 'NO_TRIGGER'
  | 'MULTIPLE_TRIGGERS'
  | 'NO_ACTION'
  | 'ORPHAN_NODE'
  | 'UNREACHABLE'
  | 'CONDITION_MISSING_BRANCH'
  | 'CYCLE'
  | 'DANGLING_EDGE'
  | 'SELF_LOOP'
  | 'DUPLICATE_EDGE'
  | 'MISSING_CONFIG';

/** A machine readable code plus the i18n key the UI renders; never a raw string. */
export interface WorkflowIssue {
  code: WorkflowIssueCode;
  messageKey: string;
  nodeId?: string;
  edgeId?: string;
}

export interface WorkflowValidation {
  valid: boolean;
  issues: WorkflowIssue[];
}

export interface NodeRun {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  state: NodeRunState;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number;
  attempts: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  triggerReason: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  nodeRuns: NodeRun[];
  demo?: boolean;
}

export interface WorkflowRunListParams {
  workflowId?: string;
  status?: WorkflowRunStatus | 'all';
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface PagedWorkflowRuns {
  runs: WorkflowRun[];
  total: number;
  hasMore: boolean;
}

/** Summary strip on the runs page: totals plus a success rate and mean duration. */
export interface WorkflowRunStats {
  total: number;
  succeeded: number;
  failed: number;
  stopped: number;
  running: number;
  successRate: number;
  averageDurationMs: number;
}

export type WorkflowTemplateComplexity = 'simple' | 'medium' | 'complex';

export const WORKFLOW_TEMPLATE_COMPLEXITIES: WorkflowTemplateComplexity[] = ['simple', 'medium', 'complex'];

/**
 * A preset graph. Names and descriptions are i18n keys rather than literals so
 * the template library translates with the rest of the product.
 */
export interface WorkflowTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  scenarioKey: string;
  complexity: WorkflowTemplateComplexity;
  useCount: number;
  definition: WorkflowDefinition;
}

/* ------------------------------------------------------------------ palette */

export type NodeFieldType = 'text' | 'number' | 'select' | 'textarea' | 'switch';

export interface NodeFieldOption {
  value: string;
  labelKey: string;
}

/** One row of the dynamic property form rendered by NodePropertyPanel. */
export interface NodeFieldDef {
  key: string;
  labelKey: string;
  type: NodeFieldType;
  required?: boolean;
  placeholderKey?: string;
  helpKey?: string;
  options?: NodeFieldOption[];
  min?: number;
  max?: number;
  defaultValue?: NodeConfigValue;
}

/** Palette swatch; the component maps it onto a --ks-* token, never a raw hex. */
export type NodeAccent = 'primary' | 'accent' | 'success' | 'warning';

export interface NodeTypeDef {
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  labelKey: string;
  descKey: string;
  accent: NodeAccent;
  fields: NodeFieldDef[];
}

/** Throttle for the run status poller; the spec asks for one probe every 2s. */
export const RUN_POLL_INTERVAL_MS = 2000;

/** Ceiling for the exponential backoff used when a poll fails. */
export const RUN_POLL_MAX_INTERVAL_MS = 30000;
