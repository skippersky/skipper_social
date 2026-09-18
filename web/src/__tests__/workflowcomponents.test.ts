/**
 * Sprint 12 workflow components.
 *
 * Presentation and wiring only. Each component reads props, renders translated
 * text and emits intent, so these cases pin the rendered DOM and the emitted
 * payload rather than store state: the store, the composables and the graph
 * engine have their own suites. WorkflowCanvas is mounted in its list variant
 * on purpose. The graph variant lazily imports Vue Flow, which needs a layout
 * engine jsdom does not have, and the list renderer is what a phone gets.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import ExecutionPath from '../components/workflow/ExecutionPath.vue';
import NodeCard from '../components/workflow/NodeCard.vue';
import NodePanel from '../components/workflow/NodePanel.vue';
import NodePropertyPanel from '../components/workflow/NodePropertyPanel.vue';
import RunTimeline from '../components/workflow/RunTimeline.vue';
import TemplateCard from '../components/workflow/TemplateCard.vue';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas.vue';
import WorkflowCard from '../components/workflow/WorkflowCard.vue';
import { useI18nStore } from '../i18n';
import { relativeTime } from '../lib/relativeTime';
import { createEdge, createNode, emptyDefinition, summarizeDefinition } from '../lib/workflowGraph';
import { DRAG_MIME, NODE_TYPES, nodesByKind } from '../lib/workflowNodes';
import { templateById } from '../lib/workflowTemplates';
import { MAX_NODE_RETRIES } from '../types';
import type {
  NodeRun,
  NodeRunState,
  Workflow,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRun,
  WorkflowTemplate
} from '../types';

/* PART1-MARKER */

const NOW = new Date(2026, 8, 12, 9, 0).getTime();
const HOUR = 3_600_000;

let pinia: Pinia = createPinia();
setActivePinia(pinia);
let i18n = useI18nStore();

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  i18n = useI18nStore();
  i18n.setLocale('en');
});

/* --------------------------------------------------------------- factories */

/** trigger -> condition -> yes action / no action, every required field filled. */
function branching(): WorkflowDefinition {
  const trigger = createNode('message_received', { x: 0, y: 0 }, 't1');
  const condition = createNode('has_tag', { x: 300, y: 0 }, 'c1');
  condition.config.tag = 'vip';
  const yes = createNode('send_message', { x: 600, y: -80 }, 'a1');
  yes.config.template = 'Karibu';
  yes.name = 'Say hello';
  const no = createNode('add_tag', { x: 600, y: 80 }, 'a2');
  no.config.tag = 'needs-review';
  return {
    nodes: [trigger, condition, yes, no],
    edges: [
      createEdge('t1', 'c1'),
      createEdge('c1', 'a1', 'true'),
      createEdge('c1', 'a2', 'false')
    ]
  };
}

/** One lone node with an empty config, so the required-field warnings show. */
function bare(type: WorkflowNodeType, id: string): WorkflowDefinition {
  const node = createNode(type, { x: 0, y: 0 }, id);
  node.config = {};
  return { nodes: [node], edges: [] };
}

function wf(patch: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-1',
    name: 'Welcome flow',
    description: 'Greets a new customer',
    status: 'active',
    definition: branching(),
    triggerKind: 'message_received',
    nodeCount: 4,
    todayRuns: 6,
    successRuns: 9,
    failedRuns: 1,
    lastRunAt: NOW - 2 * HOUR,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  };
}

function nodeRun(nodeId: string, state: NodeRunState, patch: Partial<NodeRun> = {}): NodeRun {
  return {
    nodeId,
    nodeName: nodeId.toUpperCase(),
    nodeType: 'send_message',
    state,
    startedAt: state === 'pending' ? null : NOW,
    endedAt: state === 'succeeded' || state === 'failed' ? NOW + 742 : null,
    durationMs: state === 'succeeded' || state === 'failed' ? 742 : 0,
    attempts: 1,
    input: {},
    output: {},
    ...patch
  };
}

function run(patch: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 'run-1',
    workflowId: 'wf-1',
    workflowName: 'Welcome flow',
    status: 'succeeded',
    triggerReason: 'workflow.triggerReason.message_received',
    startedAt: NOW,
    endedAt: NOW + 900,
    durationMs: 900,
    nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'succeeded')],
    ...patch
  };
}

/** The real preset when the catalogue has it, an equivalent literal otherwise. */
function templateFixture(): WorkflowTemplate {
  const seeded = templateById('wf-tpl-birthday');
  if (seeded) return seeded;
  return {
    id: 'wf-tpl-birthday',
    nameKey: 'workflow.template.birthday.name',
    descriptionKey: 'workflow.template.birthday.desc',
    scenarioKey: 'workflow.template.scenario.lifecycle',
    complexity: 'simple',
    useCount: 22,
    definition: branching()
  };
}

/** jsdom has no DataTransfer, so the drag cases carry a recording stand-in. */
function fireDrag(element: Element, type: string): Record<string, string> {
  const payload: Record<string, string> = {};
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      setData: (key: string, value: string) => {
        payload[key] = value;
      },
      getData: (key: string) => payload[key] ?? '',
      effectAllowed: ''
    }
  });
  element.dispatchEvent(event);
  return payload;
}

/** Picks an action button by its translated label, and fails loudly if absent. */
function buttonByLabel(wrapper: VueWrapper, label: string): DOMWrapper<HTMLButtonElement> {
  const found = wrapper.findAll('button').filter((item) => item.text().trim() === label);
  expect(found.length, 'expected one button labelled ' + label).toBe(1);
  return found[0];
}

describe('NodeCard', () => {
  it('renders the translated label, description, accent and field count', () => {
    const wrapper = mount(NodeCard, {
      props: { type: 'send_message', kind: 'action' },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.nc').classes()).toContain('is-accent');
    expect(wrapper.find('.nc__label').text()).toBe(i18n.t('workflow.node.send_message.label'));
    expect(wrapper.find('.nc__desc').text()).toBe(i18n.t('workflow.node.send_message.desc'));
    expect(wrapper.find('.nc__count').text()).toBe('3');
    expect(wrapper.find('.nc').attributes('data-node-type')).toBe('send_message');
    expect(wrapper.find('.nc').attributes('data-node-kind')).toBe('action');
    expect(wrapper.find('.nc').attributes('aria-label')).toBe(
      i18n.t('workflow.node.send_message.label')
    );
    expect(wrapper.find('.nc').attributes('draggable')).toBe('true');
  });

  it('drops the description and the field badge in compact mode', () => {
    const wrapper = mount(NodeCard, {
      props: { type: 'has_tag', kind: 'condition', compact: true },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.nc').classes()).toContain('nc--compact');
    expect(wrapper.find('.nc__desc').exists()).toBe(false);
    expect(wrapper.find('.nc__count').exists()).toBe(false);
    expect(wrapper.find('.nc__label').text()).toBe(i18n.t('workflow.node.has_tag.label'));
  });

  it('prefers an explicit node definition over a catalogue lookup', () => {
    const wrapper = mount(NodeCard, {
      props: {
        type: 'has_tag',
        kind: 'condition',
        def: {
          type: 'has_tag',
          kind: 'condition',
          labelKey: 'workflow.node.has_tag.label',
          descKey: 'workflow.node.has_tag.desc',
          accent: 'success',
          fields: []
        }
      },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.nc').classes()).toContain('is-success');
    expect(wrapper.find('.nc__count').exists()).toBe(false);
  });

  it('emits add with the node type when clicked', async () => {
    const wrapper = mount(NodeCard, {
      props: { type: 'wait', kind: 'action' },
      global: { plugins: [pinia] }
    });
    await wrapper.find('.nc').trigger('click');
    expect(wrapper.emitted('add')).toEqual([['wait']]);
  });

  it('writes the shared drag payload plus a generic one for Firefox', () => {
    const wrapper = mount(NodeCard, {
      props: { type: 'add_tag', kind: 'action' },
      global: { plugins: [pinia] }
    });
    const payload = fireDrag(wrapper.find('.nc').element, 'dragstart');
    expect(payload[DRAG_MIME]).toBe('add_tag');
    expect(payload['text/plain']).toBe('add_tag');
  });

  it('survives a drag event with no dataTransfer at all', () => {
    const wrapper = mount(NodeCard, {
      props: { type: 'add_tag', kind: 'action' },
      global: { plugins: [pinia] }
    });
    const event = new Event('dragstart', { bubbles: true });
    expect(() => wrapper.find('.nc').element.dispatchEvent(event)).not.toThrow();
    expect(wrapper.emitted('add')).toBeUndefined();
  });
});


describe('NodePanel', () => {
  it('groups the whole catalogue in engine order with per group counts', () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    const groups = wrapper.findAll('.np__group');
    expect(groups.map((group) => group.attributes('data-kind'))).toEqual([
      'trigger',
      'condition',
      'action'
    ]);
    expect(wrapper.find('.np__title').text()).toBe('Node library');
    expect(wrapper.find('.np__count').text()).toBe(String(NODE_TYPES.length));
    expect(wrapper.findAll('.nc').length).toBe(NODE_TYPES.length);
    expect(groups[0].find('.np__group-count').text()).toBe('7/7');
    expect(groups[1].find('.np__group-count').text()).toBe('5/5');
    expect(groups[2].find('.np__group-count').text()).toBe('9/9');
    expect(groups[0].find('.np__group-label').text()).toBe('Trigger');
    expect(groups[2].find('.np__group-label').text()).toBe('Action');
  });

  it('narrows the palette on the raw node type and clears again', async () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    await wrapper.find('.np__input').setValue('http_request');
    expect(wrapper.find('.np__count').text()).toBe('1');
    expect(wrapper.findAll('.nc').length).toBe(1);
    expect(wrapper.find('.nc').attributes('data-node-type')).toBe('http_request');
    await wrapper.find('.np__clear').trigger('click');
    expect(wrapper.find('.np__count').text()).toBe(String(NODE_TYPES.length));
    expect(wrapper.find('.np__clear').exists()).toBe(false);
  });

  it('matches on the translated label as well as the type', async () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    await wrapper.find('.np__input').setValue(i18n.t('workflow.node.has_tag.label'));
    const types = wrapper.findAll('.nc').map((card) => card.attributes('data-node-type'));
    expect(types).toContain('has_tag');
    expect(Number(wrapper.find('.np__count').text())).toBeLessThan(NODE_TYPES.length);
  });

  it('says so when nothing matches, in the rail and in every group', async () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    await wrapper.find('.np__input').setValue('zzz-not-a-node');
    expect(wrapper.find('.np__count').text()).toBe('0');
    expect(wrapper.find('.np__none').text()).toBe('No node matches that search');
    expect(wrapper.findAll('.np__group-empty').length).toBe(3);
    expect(wrapper.findAll('.nc').length).toBe(0);
  });

  it('collapses one group and keeps the match count honest', async () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    const heads = wrapper.findAll('.np__group-head');
    expect(heads[1].attributes('aria-expanded')).toBe('true');
    await heads[1].trigger('click');
    expect(wrapper.findAll('.np__group-head')[1].attributes('aria-expanded')).toBe('false');
    expect(wrapper.findAll('.np__items').length).toBe(2);
    expect(wrapper.find('.np__count').text()).toBe(String(NODE_TYPES.length));
    await wrapper.findAll('.np__group-head')[1].trigger('click');
    expect(wrapper.findAll('.np__items').length).toBe(3);
  });

  it('relays add and drag from the cards it renders', async () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    const card = wrapper.find('.nc[data-node-type="wait"]');
    expect(card.exists()).toBe(true);
    await card.trigger('click');
    expect(wrapper.emitted('add')).toEqual([['wait']]);
    fireDrag(card.element, 'dragstart');
    expect(wrapper.emitted('drag')).toEqual([['wait']]);
  });

  it('exposes the palette to assistive tech and explains how to use it', () => {
    const wrapper = mount(NodePanel, { global: { plugins: [pinia] } });
    expect(wrapper.find('.np').attributes('aria-label')).toBe('Node library');
    expect(wrapper.find('.np__input').attributes('aria-label')).toBe('Search nodes');
    expect(wrapper.find('.np__hint').text()).toBe('Click to add, or drag onto the canvas.');
    expect(nodesByKind('condition').length).toBe(5);
  });
});

describe('NodePropertyPanel', () => {
  it('shows the empty hint and no form while nothing is selected', () => {
    const wrapper = mount(NodePropertyPanel, {
      props: { node: null },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.pp__empty').text()).toBe('Select a node to edit its settings');
    expect(wrapper.findAll('.pp__field').length).toBe(0);
    expect(wrapper.find('.pp__delete').exists()).toBe(false);
  });

  it('heads the form with the node kind, type and description', () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    node.name = 'Say hello';
    node.description = 'Greets the customer';
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.pp__title').text()).toBe('Node settings');
    expect(wrapper.find('.pp__badge').classes()).toContain('is-action');
    expect(wrapper.find('.pp__badge').text()).toBe('Action');
    expect(wrapper.find('.pp__type').text()).toBe(i18n.t('workflow.node.send_message.label'));
    expect(wrapper.find('.pp__desc').text()).toBe(i18n.t('workflow.node.send_message.desc'));
    expect((wrapper.find('#pp-name-a1').element as HTMLInputElement).value).toBe('Say hello');
    expect((wrapper.find('#pp-desc-a1').element as HTMLTextAreaElement).value).toBe(
      'Greets the customer'
    );
  });

  it('generates one field per schema row, in the right widget', () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect(wrapper.findAll('.pp__field[data-field]').length).toBe(3);
    expect(wrapper.find('.pp__field[data-field="channel"] select').exists()).toBe(true);
    expect(wrapper.find('.pp__field[data-field="template"] textarea').exists()).toBe(true);
    expect(wrapper.find('.pp__field[data-field="useAi"] .pp__switch').attributes('role')).toBe(
      'switch'
    );
    expect(wrapper.find('#pp-a1-channel').attributes('disabled')).toBeUndefined();
    expect(wrapper.findAll('#pp-a1-channel option').length).toBe(4);
  });

  it('emits a patch for the node name and the note', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    await wrapper.find('#pp-name-a1').setValue('Renamed');
    expect(wrapper.emitted('patch')).toEqual([[{ name: 'Renamed' }]]);
    await wrapper.find('#pp-desc-a1').setValue('kept short');
    expect(wrapper.emitted('patch')?.[1]).toEqual([{ description: 'kept short' }]);
  });

  it('emits a config patch per widget kind', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    node.config.template = 'Karibu';
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect((wrapper.find('#pp-a1-template').element as HTMLTextAreaElement).value).toBe('Karibu');
    await wrapper.find('#pp-a1-channel').setValue('instagram');
    expect(wrapper.emitted('config')).toEqual([[{ channel: 'instagram' }]]);
    await wrapper.find('#pp-a1-template').setValue('Habari');
    expect(wrapper.emitted('config')?.[1]).toEqual([{ template: 'Habari' }]);
    await wrapper.find('#pp-a1-useAi').trigger('click');
    expect(wrapper.emitted('config')?.[2]).toEqual([{ useAi: true }]);
  });

  it('reads a stored switch value and flips it off', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    node.config.useAi = true;
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('#pp-a1-useAi').attributes('aria-checked')).toBe('true');
    expect(wrapper.find('.pp__switch-text').text()).toBe('On');
    await wrapper.find('#pp-a1-useAi').trigger('click');
    expect(wrapper.emitted('config')).toEqual([[{ useAi: false }]]);
  });

  it('clamps a number field to the schema range', async () => {
    const node = createNode('customer_birthday', { x: 0, y: 0 }, 't9');
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect((wrapper.find('#pp-t9-offsetDays').element as HTMLInputElement).value).toBe('0');
    await wrapper.find('#pp-t9-offsetDays').setValue('99');
    expect(wrapper.emitted('config')).toEqual([[{ offsetDays: 7 }]]);
    await wrapper.find('#pp-t9-offsetDays').setValue('-40');
    expect(wrapper.emitted('config')?.[1]).toEqual([{ offsetDays: -7 }]);
    await wrapper.find('#pp-t9-offsetDays').setValue('3');
    expect(wrapper.emitted('config')?.[2]).toEqual([{ offsetDays: 3 }]);
  });

  it('marks a required field and explains what is missing', () => {
    const node = createNode('has_tag', { x: 0, y: 0 }, 'c1');
    const wrapper = mount(NodePropertyPanel, {
      props: { node, missing: ['tag'] },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.pp__req').exists()).toBe(true);
    expect(wrapper.find('.pp__field[data-field="tag"]').classes()).toContain('is-missing');
    expect(wrapper.find('.pp__missing').text()).toBe('Required');
    expect(wrapper.find('#pp-c1-tag').attributes('placeholder')).toBe(
      i18n.t('workflow.field.tagPlaceholder')
    );
  });

  it('surfaces the validation issues for this node as an alert', () => {
    const node = createNode('has_tag', { x: 0, y: 0 }, 'c1');
    const wrapper = mount(NodePropertyPanel, {
      props: {
        node,
        issues: [
          { code: 'MISSING_CONFIG', messageKey: 'workflow.issue.MISSING_CONFIG' },
          { code: 'ORPHAN_NODE', messageKey: 'workflow.issue.ORPHAN_NODE', nodeId: 'c1' }
        ]
      },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.pp__issues').attributes('role')).toBe('alert');
    expect(wrapper.findAll('.pp__issue').length).toBe(2);
    expect(wrapper.find('.pp__issue').text()).toBe('A node is missing required settings');
  });

  it('keeps retries locked until the strategy is retry, then clamps them', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    const stopped = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect(stopped.find('#pp-retries-a1').attributes('disabled')).toBeDefined();
    await stopped.find('#pp-strategy-a1').setValue('retry');
    expect(stopped.emitted('patch')).toEqual([[{ errorStrategy: 'retry' }]]);

    node.errorStrategy = 'retry';
    const retrying = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect(retrying.find('#pp-retries-a1').attributes('disabled')).toBeUndefined();
    expect(retrying.find('#pp-retries-a1').attributes('max')).toBe(String(MAX_NODE_RETRIES));
    await retrying.find('#pp-retries-a1').setValue('99');
    expect(retrying.emitted('patch')).toEqual([[{ retries: MAX_NODE_RETRIES }]]);
    await retrying.find('#pp-retries-a1').setValue('-4');
    expect(retrying.emitted('patch')?.[1]).toEqual([{ retries: 0 }]);
  });

  it('emits remove with the node id and close on request', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    await wrapper.find('.pp__delete').trigger('click');
    expect(wrapper.emitted('remove')).toEqual([['a1']]);
    await wrapper.find('.pp__close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('freezes every widget in readonly mode but still closes', async () => {
    const node = createNode('send_message', { x: 0, y: 0 }, 'a1');
    const wrapper = mount(NodePropertyPanel, {
      props: { node, readonly: true },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('#pp-name-a1').attributes('disabled')).toBeDefined();
    expect(wrapper.find('#pp-desc-a1').attributes('disabled')).toBeDefined();
    expect(wrapper.find('#pp-a1-channel').attributes('disabled')).toBeDefined();
    expect(wrapper.find('#pp-a1-template').attributes('disabled')).toBeDefined();
    expect(wrapper.find('#pp-a1-useAi').attributes('disabled')).toBeDefined();
    expect(wrapper.find('#pp-strategy-a1').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.pp__delete').exists()).toBe(false);
    await wrapper.find('#pp-name-a1').trigger('input');
    await wrapper.find('#pp-a1-useAi').trigger('click');
    expect(wrapper.emitted('patch')).toBeUndefined();
    expect(wrapper.emitted('config')).toBeUndefined();
    await wrapper.find('.pp__close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('falls back to schema defaults for a node with no config at all', () => {
    const node: WorkflowNode = {
      id: 'w1',
      kind: 'action',
      type: 'wait',
      name: '',
      position: { x: 0, y: 0 },
      config: {},
      errorStrategy: 'stop',
      retries: 0
    };
    const wrapper = mount(NodePropertyPanel, {
      props: { node },
      global: { plugins: [pinia] }
    });
    expect((wrapper.find('#pp-w1-duration').element as HTMLInputElement).value).toBe('1');
    expect((wrapper.find('#pp-w1-unit').element as HTMLSelectElement).value).toBe('hours');
    expect(wrapper.find('#pp-w1-duration').attributes('min')).toBe('1');
    expect(wrapper.find('#pp-w1-duration').attributes('max')).toBe('43200');
  });
});

describe('TemplateCard', () => {
  it('translates name, description and scenario and counts the preset steps', () => {
    const template = templateFixture();
    const steps = summarizeDefinition(template.definition).nodes;
    const wrapper = mount(TemplateCard, {
      props: { template },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.tc__name').text()).toBe(i18n.t('workflow.template.birthday.name'));
    expect(wrapper.find('.tc__desc').text()).toBe(i18n.t('workflow.template.birthday.desc'));
    expect(wrapper.find('.tc__badge').text()).toBe('Simple');
    expect(wrapper.find('.tc__badge').classes()).toContain('is-simple');
    expect(wrapper.find('.tc__uses').text()).toBe(String(template.useCount));
    expect(wrapper.find('.tc__facts').text()).toContain(steps + ' steps');
    expect(wrapper.find('.tc__facts').text()).toContain(
      i18n.t('workflow.template.scenario.lifecycle')
    );
    expect(wrapper.findAll('.tc__fact').length).toBe(3);
  });

  it('emits preview and use with the template id', async () => {
    const wrapper = mount(TemplateCard, {
      props: { template: templateFixture() },
      global: { plugins: [pinia] }
    });
    await wrapper.find('.tc__btn').trigger('click');
    expect(wrapper.emitted('preview')).toEqual([['wf-tpl-birthday']]);
    await wrapper.find('.tc__btn.is-primary').trigger('click');
    expect(wrapper.emitted('use')).toEqual([['wf-tpl-birthday']]);
    expect(buttonByLabel(wrapper, 'Preview structure').exists()).toBe(true);
    expect(buttonByLabel(wrapper, 'Use this template').exists()).toBe(true);
  });

  it('paints the complexity badge and the active state', () => {
    const complex = mount(TemplateCard, {
      props: { template: templateFixture(), active: true },
      global: { plugins: [pinia] }
    });
    expect(complex.find('.tc').classes()).toContain('is-active');
    expect(complex.find('.tc__badge').classes()).toContain('is-simple');

    const upgraded = mount(TemplateCard, {
      props: {
        template: { ...templateFixture(), complexity: 'complex' as const }
      },
      global: { plugins: [pinia] }
    });
    expect(upgraded.find('.tc').classes()).not.toContain('is-active');
    expect(upgraded.find('.tc__badge').classes()).toContain('is-complex');
    expect(upgraded.find('.tc__badge').text()).toBe('Complex');
  });
});

describe('WorkflowCard', () => {
  it('paints the status badge and the graph shape of the workflow', () => {
    const wrapper = mount(WorkflowCard, {
      props: { workflow: wf(), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.wf').classes()).toContain('is-active');
    expect(wrapper.find('.wf').attributes('data-workflow-id')).toBe('wf-1');
    expect(wrapper.find('.wf__name').text()).toBe('Welcome flow');
    expect(wrapper.find('.wf__desc').text()).toBe('Greets a new customer');
    expect(wrapper.find('.wf__status').text()).toBe('Active');
    const summary = summarizeDefinition(branching());
    expect(wrapper.find('.wf__meta').text()).toContain(
      i18n.t('workflow.card.stepCounts', {
        nodes: summary.nodes,
        conditions: summary.conditions,
        actions: summary.actions
      })
    );
    expect(wrapper.find('.wf__meta').text()).toContain(i18n.t('workflow.node.message_received.label'));
  });

  it('reads the success rate and colours it by threshold', () => {
    const healthy = mount(WorkflowCard, {
      props: { workflow: wf({ successRuns: 9, failedRuns: 1 }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(healthy.find('.wf__ok').text()).toBe('90%');
    expect(healthy.find('.wf__bad').exists()).toBe(false);

    const sick = mount(WorkflowCard, {
      props: { workflow: wf({ successRuns: 1, failedRuns: 3 }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(sick.find('.wf__bad').text()).toBe('25%');

    const untouched = mount(WorkflowCard, {
      props: { workflow: wf({ successRuns: 0, failedRuns: 0 }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(untouched.find('.wf__muted').text()).toBe('No runs yet');
    expect(untouched.find('.wf__ok').exists()).toBe(false);
  });

  it('shows a relative last run, or that it never ran', () => {
    const ran = mount(WorkflowCard, {
      props: { workflow: wf({ lastRunAt: NOW - 2 * HOUR }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(ran.find('.wf__meta').text()).toContain(relativeTime(NOW - 2 * HOUR, NOW, 'en'));

    const never = mount(WorkflowCard, {
      props: { workflow: wf({ lastRunAt: null }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(never.find('.wf__meta').text()).toContain('Never run');
  });

  it('names a missing trigger and hides an empty description', () => {
    const wrapper = mount(WorkflowCard, {
      props: { workflow: wf({ triggerKind: null, description: '' }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.wf__meta').text()).toContain('No trigger');
    expect(wrapper.find('.wf__desc').exists()).toBe(false);
  });

  it('offers activate on anything that is not running and pause on what is', () => {
    const draft = mount(WorkflowCard, {
      props: { workflow: wf({ status: 'draft' }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(buttonByLabel(draft, 'Activate').exists()).toBe(true);
    expect(draft.findAll('.wf__btn').length).toBe(6);
    expect(draft.findAll('button').some((item) => item.text().trim() === 'Pause')).toBe(false);

    const active = mount(WorkflowCard, {
      props: { workflow: wf({ status: 'active' }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(buttonByLabel(active, 'Pause').exists()).toBe(true);
    expect(active.findAll('button').some((item) => item.text().trim() === 'Activate')).toBe(false);

    const paused = mount(WorkflowCard, {
      props: { workflow: wf({ status: 'paused' }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(paused.find('.wf__status').text()).toBe('Paused');
    expect(buttonByLabel(paused, 'Activate').exists()).toBe(true);
  });

  it('emits every action with the workflow id and touches no store', async () => {
    const wrapper = mount(WorkflowCard, {
      props: { workflow: wf(), now: NOW },
      global: { plugins: [pinia] }
    });
    await buttonByLabel(wrapper, 'Pause').trigger('click');
    expect(wrapper.emitted('disable')).toEqual([['wf-1']]);
    await buttonByLabel(wrapper, 'Edit').trigger('click');
    expect(wrapper.emitted('edit')).toEqual([['wf-1']]);
    await buttonByLabel(wrapper, 'Runs').trigger('click');
    expect(wrapper.emitted('runs')).toEqual([['wf-1']]);
    await buttonByLabel(wrapper, 'Duplicate').trigger('click');
    expect(wrapper.emitted('duplicate')).toEqual([['wf-1']]);
    await buttonByLabel(wrapper, 'Details').trigger('click');
    expect(wrapper.emitted('open')).toEqual([['wf-1']]);
    await buttonByLabel(wrapper, 'Delete').trigger('click');
    expect(wrapper.emitted('delete')).toEqual([['wf-1']]);
  });

  it('emits enable from a card that is not running yet', async () => {
    const wrapper = mount(WorkflowCard, {
      props: { workflow: wf({ status: 'draft' }), now: NOW },
      global: { plugins: [pinia] }
    });
    await buttonByLabel(wrapper, 'Activate').trigger('click');
    expect(wrapper.emitted('enable')).toEqual([['wf-1']]);
    expect(wrapper.emitted('disable')).toBeUndefined();
  });

  it('reports today run count straight from the row', () => {
    const wrapper = mount(WorkflowCard, {
      props: { workflow: wf({ todayRuns: 42 }), now: NOW },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.wf__meta').text()).toContain('42');
    expect(wrapper.find('.wf__meta').text()).toContain(i18n.t('workflow.card.todayRuns'));
  });
});

/* ---------------------------------------------------------------- part 4 */

describe('RunTimeline', () => {
  it('shows the empty state before any node has executed', () => {
    const wrapper = mount(RunTimeline, { props: { nodeRuns: [] }, global: { plugins: [pinia] } });
    expect(wrapper.find('.rt__empty').text()).toBe('No node has executed yet');
    expect(wrapper.find('.rt__list').exists()).toBe(false);
  });

  it('paints one row per node run with its state class', () => {
    const wrapper = mount(RunTimeline, {
      props: {
        nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('a1', 'failed'), nodeRun('c1', 'running')]
      },
      global: { plugins: [pinia] }
    });
    const items = wrapper.findAll('.rt__item');
    expect(items).toHaveLength(3);
    expect(items[0].classes()).toContain('is-succeeded');
    expect(items[1].classes()).toContain('is-failed');
    expect(items[2].classes()).toContain('is-running');
    expect(items[1].find('.rt__state').text()).toBe('Failed');
    expect(items[2].find('.rt__name').text()).toBe('C1');
  });

  it('falls back to the node type label when the run carries no name', () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: [nodeRun('a1', 'succeeded', { nodeName: '   ' })] },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.rt__name').text()).toBe('Send message');
    expect(wrapper.find('.rt__type').text()).toBe('Send message');
  });

  it('reads "Not started" for a pending node instead of a timestamp', () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: [nodeRun('a2', 'pending')] },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.rt__meta').text()).toContain('Not started');
    expect(wrapper.find('.rt__meta').text()).not.toContain('/');
  });

  it('formats the duration and only mentions attempts after a retry', () => {
    const wrapper = mount(RunTimeline, {
      props: {
        nodeRuns: [nodeRun('a1', 'succeeded'), nodeRun('a2', 'failed', { attempts: 3 })]
      },
      global: { plugins: [pinia] }
    });
    const metas = wrapper.findAll('.rt__meta');
    expect(metas[0].text()).toContain('742 ms');
    expect(metas[0].text()).not.toContain('attempts');
    expect(metas[1].text()).toContain('3 attempts');
  });

  it('translates the stored error key into the failure line', () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: [nodeRun('a1', 'failed', { error: 'workflow.run.error.timeout' })] },
      global: { plugins: [pinia] }
    });
    const error = wrapper.find('.rt__error');
    expect(error.exists()).toBe(true);
    expect(error.text()).toContain('Error:');
    expect(error.text()).toContain(i18n.t('workflow.run.error.timeout'));
  });

  it('hides the payload toggle when both sides are empty', () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: [nodeRun('a1', 'succeeded')] },
      global: { plugins: [pinia] }
    });
    expect(wrapper.find('.rt__toggle').exists()).toBe(false);
    expect(wrapper.find('.rt__payloads').exists()).toBe(false);
  });

  it('expands the payload drawer and labels the side without data', async () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: [nodeRun('a1', 'succeeded', { input: { to: '+255700000000' } })] },
      global: { plugins: [pinia] }
    });
    const toggle = wrapper.find('.rt__toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.text()).toBe('Show payload');
    await toggle.trigger('click');
    const opened = wrapper.find('.rt__toggle');
    expect(opened.attributes('aria-expanded')).toBe('true');
    expect(opened.text()).toBe('Hide payload');
    const codes = wrapper.findAll('.rt__code');
    expect(codes).toHaveLength(1);
    expect(codes[0].text()).toBe(JSON.stringify({ to: '+255700000000' }, null, 2));
    expect(wrapper.find('.rt__nodata').text()).toBe('No payload');
    await opened.trigger('click');
    expect(wrapper.find('.rt__payloads').exists()).toBe(false);
  });

  it('emits select with the node id when the name is clicked', async () => {
    const wrapper = mount(RunTimeline, {
      props: { nodeRuns: run().nodeRuns },
      global: { plugins: [pinia] }
    });
    await wrapper.findAll('.rt__name')[1].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['a1']]);
  });
});

describe('ExecutionPath', () => {
  it('shows the empty state when there is no run yet', () => {
    const wrapper = mount(ExecutionPath, { props: { run: null }, global: { plugins: [pinia] } });
    expect(wrapper.find('.ep__empty').text()).toBe('This run has no execution path yet');
    expect(wrapper.find('.ep__track').exists()).toBe(false);
  });

  it('caps the track with start and end markers', () => {
    const wrapper = mount(ExecutionPath, { props: { run: run() }, global: { plugins: [pinia] } });
    const caps = wrapper.findAll('.ep__cap-label').map((item) => item.text());
    expect(caps).toEqual(['Start', 'End']);
    expect(wrapper.findAll('.ep__step')).toHaveLength(2);
    expect(wrapper.find('.ep__label').text()).toBe('T1');
  });

  it('marks the furthest executed step as reached', () => {
    const wrapper = mount(ExecutionPath, {
      props: {
        run: run({
          nodeRuns: [nodeRun('t1', 'succeeded'), nodeRun('c1', 'running'), nodeRun('a1', 'pending')]
        })
      },
      global: { plugins: [pinia] }
    });
    const reached = wrapper.findAll('.ep__step.is-reached');
    expect(reached).toHaveLength(1);
    expect(reached[0].classes()).toContain('is-running');
    expect(reached[0].text()).toContain('Step 2');
    expect(wrapper.findAll('.ep__step')[2].classes()).toContain('is-pending');
  });

  it('labels a skipped chip as the branch that was not taken', () => {
    const wrapper = mount(ExecutionPath, {
      props: {
        run: run({ nodeRuns: [nodeRun('a1', 'succeeded'), nodeRun('a2', 'skipped')] })
      },
      global: { plugins: [pinia] }
    });
    const notes = wrapper.findAll('.ep__skipped');
    expect(notes).toHaveLength(1);
    expect(notes[0].text()).toBe('Branch not taken');
  });

  it('emits select when a chip is clicked', async () => {
    const wrapper = mount(ExecutionPath, { props: { run: run() }, global: { plugins: [pinia] } });
    await wrapper.findAll('.ep__chip')[1].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['a1']]);
  });
});

describe('WorkflowCanvas list variant', () => {
  function edgeForBranch(def: WorkflowDefinition, branch: 'true' | 'false'): WorkflowEdge {
    const found = def.edges.find((edge) => edge.branch === branch);
    if (!found) throw new Error('fixture has no ' + branch + ' edge');
    return found;
  }

  function canvas(
    definition: WorkflowDefinition,
    patch: {
      readonly?: boolean;
      selectedNodeId?: string | null;
      problemNodeIds?: string[];
      nodeStates?: Record<string, string>;
    } = {}
  ) {
    return mount(WorkflowCanvas, {
      props: { definition, variant: 'list', ...patch },
      global: { plugins: [pinia] }
    });
  }

  it('renders the list surface and never pulls in the graph chunk', () => {
    const wrapper = canvas(branching());
    expect(wrapper.find('.wc').attributes('data-variant')).toBe('list');
    expect(wrapper.find('.wc__list').exists()).toBe(true);
    expect(wrapper.find('.wc__empty').exists()).toBe(false);
  });

  it('shows the empty canvas message when the definition has no nodes', () => {
    const wrapper = canvas(emptyDefinition());
    expect(wrapper.find('.wc__empty').text()).toBe('The canvas is empty');
    expect(wrapper.findAll('.wc__node')).toHaveLength(0);
    expect(wrapper.find('.wc__edge-count').exists()).toBe(false);
  });

  it('keeps definition order and paints a class per node kind', () => {
    const wrapper = canvas(branching());
    const ids = wrapper.findAll('.wc__node').map((item) => item.attributes('data-node-id'));
    expect(ids).toEqual(['t1', 'c1', 'a1', 'a2']);
    expect(wrapper.findAll('.wc__node.is-trigger')).toHaveLength(1);
    expect(wrapper.findAll('.wc__node.is-condition')).toHaveLength(1);
    expect(wrapper.findAll('.wc__node.is-action')).toHaveLength(2);
    expect(wrapper.find('.wc__step').text()).toBe('1');
  });

  it('marks the selected node and the nodes with missing settings', () => {
    const wrapper = canvas(branching(), { selectedNodeId: 'c1', problemNodeIds: ['a2'] });
    const nodes = wrapper.findAll('.wc__node');
    expect(nodes[1].classes()).toContain('is-selected');
    expect(nodes[3].classes()).toContain('is-problem');
    expect(nodes[0].classes()).not.toContain('is-selected');
    expect(nodes[0].classes()).not.toContain('is-problem');
  });

  it('exposes per node run state through a data attribute', () => {
    const wrapper = canvas(branching(), { nodeStates: { t1: 'succeeded', c1: 'running' } });
    const nodes = wrapper.findAll('.wc__node');
    expect(nodes[0].attributes('data-state')).toBe('succeeded');
    expect(nodes[1].attributes('data-state')).toBe('running');
    expect(nodes[2].attributes('data-state')).toBe('');
  });

  it('emits select with the node id when a row is clicked', async () => {
    const wrapper = canvas(branching());
    await wrapper.findAll('.wc__node-main')[2].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['a1']]);
  });

  it('prefers the node name over the catalogue label and still shows the type', () => {
    const wrapper = canvas(branching());
    const a1 = wrapper.find('[data-node-id="a1"]');
    expect(a1.find('.wc__label').text()).toBe('Say hello');
    expect(a1.find('.wc__type').text()).toBe('Send message');
    const t1 = wrapper.find('[data-node-id="t1"]');
    expect(t1.find('.wc__label').text()).toBe('Message received');
    expect(t1.find('.wc__kind').text()).toBe('Trigger');
  });

  it('labels the two condition arms and names their targets', () => {
    const wrapper = canvas(branching());
    const c1 = wrapper.find('[data-node-id="c1"]');
    const labels = c1.findAll('.wc__branch-label');
    expect(labels[0].classes()).toContain('is-true');
    expect(labels[0].text()).toBe('Yes');
    expect(labels[1].classes()).toContain('is-false');
    expect(labels[1].text()).toBe('No');
    const targets = c1.findAll('.wc__branch-target').map((item) => item.text());
    expect(targets).toEqual(['Say hello', 'Add tag']);
    const plain = wrapper.find('[data-node-id="t1"] .wc__branch-label');
    expect(plain.text()).toBe('Next');
    expect(wrapper.find('.wc__edge-count').text()).toBe('3 links');
  });

  it('emits disconnect with the edge id when an arm is cut', async () => {
    const def = branching();
    const wrapper = canvas(def);
    const cut = wrapper.find('[data-node-id="c1"]').findAll('.wc__branch-cut')[0];
    expect(cut.attributes('aria-label')).toBe('Disconnect');
    await cut.trigger('click');
    expect(wrapper.emitted('disconnect')).toEqual([[edgeForBranch(def, 'true').id]]);
  });

  it('stays read only without losing the ability to inspect a node', async () => {
    const wrapper = canvas(branching(), { readonly: true });
    expect(wrapper.find('.wc__list').attributes('data-readonly')).toBe('true');
    expect(wrapper.findAll('.wc__branch-cut')).toHaveLength(0);
    await wrapper.findAll('.wc__node-main')[0].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['t1']]);
    expect(wrapper.emitted('disconnect')).toBeUndefined();
  });

  it('reports missing required settings and an unconfigured digest', () => {
    const wrapper = canvas(bare('has_tag', 'c9'));
    expect(wrapper.find('.wc__missing').text()).toBe('1 required fields missing');
    expect(wrapper.find('.wc__digest').text()).toBe('Not configured yet');
    expect(wrapper.find('.wc__label').text()).toBe('Has tag');
  });

  it('summarizes a filled config as key value pairs', () => {
    const wrapper = canvas(branching());
    expect(wrapper.find('[data-node-id="c1"] .wc__digest').text()).toBe('tag: vip');
    expect(wrapper.find('[data-node-id="a1"] .wc__missing').exists()).toBe(false);
  });
});
