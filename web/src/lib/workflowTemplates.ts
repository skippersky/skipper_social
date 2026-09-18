/**
 * Workflow template library (Sprint 12).
 *
 * Five presets covering the flows East African merchants actually ask for.
 * Nodes are built through createNode so a template inherits the catalogue
 * defaults instead of duplicating them, and every id is stable so a template
 * renders identically on each visit. instantiateTemplate rewrites those ids
 * when a merchant copies a preset into their own workspace.
 *
 * Names, descriptions and scenarios are i18n keys, never literals: the library
 * has to translate with the rest of the product.
 */
import { createNode, nextNodeId, X_GAP, Y_GAP, ORIGIN } from './workflowGraph';
import type {
  ConditionBranch,
  NodeConfig,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowTemplate,
  WorkflowTemplateComplexity
} from '../types';

function node(
  type: WorkflowNodeType,
  id: string,
  column: number,
  row: number,
  config: NodeConfig = {}
): WorkflowNode {
  const created = createNode(
    type,
    { x: ORIGIN.x + column * X_GAP, y: ORIGIN.y + row * Y_GAP },
    id
  );
  return { ...created, config: { ...created.config, ...config } };
}

function edge(source: string, target: string, branch?: ConditionBranch): WorkflowEdge {
  const edgeId = 'tpl-' + source + '-' + target + (branch ? '-' + branch : '');
  const built: WorkflowEdge = { id: edgeId, source, target };
  if (branch) built.branch = branch;
  return built;
}

/* --------------------------------------------------------------- welcome */

const WELCOME: WorkflowDefinition = {
  nodes: [
    node('customer_created', 'welcome-trigger', 0, 0, { segment: '' }),
    node('add_tag', 'welcome-tag', 1, 0, { tag: 'new-customer' }),
    node('send_message', 'welcome-message', 2, 0, {
      channel: 'whatsapp',
      template: 'Karibu {name}! Asante kujiunga nasi. Hapa utapata matoleo mapya na msaada wa haraka.',
      useAi: false
    })
  ],
  edges: [edge('welcome-trigger', 'welcome-tag'), edge('welcome-tag', 'welcome-message')]
};

/* --------------------------------------------------------------- win back */

const WIN_BACK: WorkflowDefinition = {
  nodes: [
    node('customer_inactive', 'winback-trigger', 0, 0, { days: 45 }),
    node('has_tag', 'winback-condition', 1, 0, { tag: 'vip' }),
    node('send_message', 'winback-vip', 2, 0, {
      channel: 'whatsapp',
      template: 'Tunakukosa {name}. Kama mteja wetu maalum, hapa kuna punguzo la 15%: KARIBU15.',
      useAi: true
    }),
    node('add_tag', 'winback-tag', 2, 1, { tag: 'winback-pending' }),
    node('send_message', 'winback-reminder', 3, 1, {
      channel: 'whatsapp',
      template: 'Habari {name}, imepita muda tangu ununuzi wako wa mwisho. Tuko na bidhaa mpya kwako.',
      useAi: false
    })
  ],
  edges: [
    edge('winback-trigger', 'winback-condition'),
    edge('winback-condition', 'winback-vip', 'true'),
    edge('winback-condition', 'winback-tag', 'false'),
    edge('winback-tag', 'winback-reminder')
  ]
};

/* --------------------------------------------------------------- birthday */

const BIRTHDAY: WorkflowDefinition = {
  nodes: [
    node('customer_birthday', 'birthday-trigger', 0, 0, { offsetDays: 0, segment: '' }),
    node('wait', 'birthday-wait', 1, 0, { duration: 9, unit: 'hours' }),
    node('send_message', 'birthday-message', 2, 0, {
      channel: 'whatsapp',
      template: 'Heri ya kuzaliwa {name}! Tukutumia pongezi na zawadi ndogo kwa oda yako inayofuata.',
      useAi: true
    })
  ],
  edges: [edge('birthday-trigger', 'birthday-wait'), edge('birthday-wait', 'birthday-message')]
};

/* --------------------------------------------------- marketing follow up */

const FOLLOW_UP: WorkflowDefinition = {
  nodes: [
    node('marketing_response', 'followup-trigger', 0, 0, { campaignId: '', event: 'click' }),
    node('wait', 'followup-wait', 1, 0, { duration: 2, unit: 'days' }),
    node('move_segment', 'followup-segment', 2, 0, { segment: 'hot-leads' }),
    node('send_notification', 'followup-notify', 3, 0, {
      title: 'Campaign responder needs a follow up',
      body: 'A recipient clicked the campaign and moved into hot-leads.',
      level: 'info'
    })
  ],
  edges: [
    edge('followup-trigger', 'followup-wait'),
    edge('followup-wait', 'followup-segment'),
    edge('followup-segment', 'followup-notify')
  ]
};

/* ------------------------------------------------------------- auto reply */

const AUTO_REPLY: WorkflowDefinition = {
  nodes: [
    node('message_received', 'reply-trigger', 0, 0, {
      channel: 'whatsapp',
      keyword: '',
      inboundOnly: true
    }),
    node('time_window', 'reply-window', 1, 0, { startHour: 8, endHour: 18, weekdays: '1,2,3,4,5' }),
    node('send_message', 'reply-open', 2, 0, {
      channel: 'whatsapp',
      template: 'Asante kwa ujumbe wako. Timu yetu ipo kazini na itakujibu ndani ya dakika chache.',
      useAi: true
    }),
    node('send_message', 'reply-closed', 2, 1, {
      channel: 'whatsapp',
      template: 'Tumepokea ujumbe wako. Kwa sasa nje ya saa za kazi, tutakujibu kesho asubuhi.',
      useAi: false
    })
  ],
  edges: [
    edge('reply-trigger', 'reply-window'),
    edge('reply-window', 'reply-open', 'true'),
    edge('reply-window', 'reply-closed', 'false')
  ]
};

interface TemplateSeed {
  id: string;
  slug: string;
  scenario: string;
  complexity: WorkflowTemplateComplexity;
  useCount: number;
  definition: WorkflowDefinition;
}

const SEEDS: TemplateSeed[] = [
  { id: 'wf-tpl-welcome', slug: 'welcome', scenario: 'onboarding', complexity: 'simple', useCount: 48, definition: WELCOME },
  { id: 'wf-tpl-winback', slug: 'winback', scenario: 'retention', complexity: 'medium', useCount: 31, definition: WIN_BACK },
  { id: 'wf-tpl-birthday', slug: 'birthday', scenario: 'lifecycle', complexity: 'simple', useCount: 22, definition: BIRTHDAY },
  { id: 'wf-tpl-followup', slug: 'followup', scenario: 'marketing', complexity: 'medium', useCount: 17, definition: FOLLOW_UP },
  { id: 'wf-tpl-autoreply', slug: 'autoreply', scenario: 'support', complexity: 'complex', useCount: 39, definition: AUTO_REPLY }
];

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = SEEDS.map((seed) => ({
  id: seed.id,
  nameKey: 'workflow.template.' + seed.slug + '.name',
  descriptionKey: 'workflow.template.' + seed.slug + '.desc',
  scenarioKey: 'workflow.template.scenario.' + seed.scenario,
  complexity: seed.complexity,
  useCount: seed.useCount,
  definition: seed.definition
}));

/** Scenario keys the template grid filters on, in display order. */
export const TEMPLATE_SCENARIOS: string[] = ['onboarding', 'retention', 'lifecycle', 'marketing', 'support'].map(
  (scenario) => 'workflow.template.scenario.' + scenario
);

export function templateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}

export function templatesByComplexity(complexity: WorkflowTemplateComplexity): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((template) => template.complexity === complexity);
}

/**
 * Copies a preset with fresh ids, so two merchants starting from the same
 * template never share node ids in the run timeline.
 */
export function instantiateTemplate(template: WorkflowTemplate): WorkflowDefinition {
  const idMap = new Map<string, string>();
  const nodes = template.definition.nodes.map((item) => {
    const fresh = nextNodeId(item.type);
    idMap.set(item.id, fresh);
    return { ...item, id: fresh, position: { ...item.position }, config: { ...item.config } };
  });
  const edges = template.definition.edges.map((item, index) => {
    const source = idMap.get(item.source) ?? item.source;
    const target = idMap.get(item.target) ?? item.target;
    const built: WorkflowEdge = { id: 'edge-' + (index + 1) + '-' + source + '-' + target, source, target };
    if (item.branch) built.branch = item.branch;
    if (item.label) built.label = item.label;
    return built;
  });
  return { nodes, edges };
}
