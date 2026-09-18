/**
 * Workflow node catalogue (Sprint 12).
 *
 * One declarative table drives three surfaces: the draggable palette, the
 * dynamic property form and the validation rules. Adding a node type means
 * adding a row here, not touching a component. Labels are i18n keys, so a
 * missing translation fails the locale parity guard instead of leaking English.
 */
import { CHANNEL_PLATFORMS } from '../types';
import type {
  ActionKind,
  ChannelPlatform,
  ConditionKind,
  NodeConfig,
  NodeFieldOption,
  NodeTypeDef,
  TriggerKind,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowNodeType
} from '../types';

/**
 * Shared drag payload key. The palette writes it on dragstart and the graph
 * canvas reads it on drop, so the constant lives in the catalogue instead of in
 * a component: a <script setup> block cannot export, and importing it from the
 * card would pull the whole palette entry into the graph chunk.
 */
export const DRAG_MIME = 'application/x-kili-node-type';

const CHANNEL_LABEL_KEYS: Record<ChannelPlatform, string> = {
  whatsapp: 'workflow.channel.whatsapp',
  facebook: 'workflow.channel.facebook',
  instagram: 'workflow.channel.instagram',
  tiktok: 'workflow.channel.tiktok'
};

/** Built from CHANNEL_PLATFORMS so the palette cannot drift from the channel registry. */
export const CHANNEL_OPTIONS: NodeFieldOption[] = CHANNEL_PLATFORMS.map((platform) => ({
  value: platform,
  labelKey: CHANNEL_LABEL_KEYS[platform]
}));

export const TRIGGER_CHANGE_OPTIONS: NodeFieldOption[] = [
  { value: 'added', labelKey: 'workflow.trigger.change.added' },
  { value: 'removed', labelKey: 'workflow.trigger.change.removed' },
  { value: 'any', labelKey: 'workflow.trigger.change.any' }
];

export const MARKETING_EVENT_OPTIONS: NodeFieldOption[] = [
  { value: 'click', labelKey: 'workflow.trigger.event.click' },
  { value: 'reply', labelKey: 'workflow.trigger.event.reply' },
  { value: 'any', labelKey: 'workflow.trigger.event.any' }
];

export const NOTIFICATION_LEVEL_OPTIONS: NodeFieldOption[] = [
  { value: 'info', labelKey: 'workflow.action.level.info' },
  { value: 'warning', labelKey: 'workflow.action.level.warning' },
  { value: 'error', labelKey: 'workflow.action.level.error' }
];

export const WAIT_UNIT_OPTIONS: NodeFieldOption[] = [
  { value: 'minutes', labelKey: 'workflow.action.unit.minutes' },
  { value: 'hours', labelKey: 'workflow.action.unit.hours' },
  { value: 'days', labelKey: 'workflow.action.unit.days' }
];

export const HTTP_METHOD_OPTIONS: NodeFieldOption[] = [
  { value: 'GET', labelKey: 'workflow.common.get' },
  { value: 'POST', labelKey: 'workflow.common.post' },
  { value: 'PUT', labelKey: 'workflow.common.put' },
  { value: 'DELETE', labelKey: 'workflow.common.delete' }
];

export const ERROR_STRATEGY_OPTIONS: NodeFieldOption[] = [
  { value: 'stop', labelKey: 'workflow.errorStrategy.stop' },
  { value: 'continue', labelKey: 'workflow.errorStrategy.continue' },
  { value: 'retry', labelKey: 'workflow.errorStrategy.retry' }
];

/** KiliSocial serves East Africa first, so the cron default is Dar es Salaam. */
export const DEFAULT_TIMEZONE = 'Africa/Dar_es_Salaam';

const TRIGGER_TYPES: NodeTypeDef[] = [
  {
    type: 'customer_created',
    kind: 'trigger',
    labelKey: 'workflow.node.customer_created.label',
    descKey: 'workflow.node.customer_created.desc',
    accent: 'primary',
    fields: [
      { key: 'segment', labelKey: 'workflow.field.segment', type: 'text', placeholderKey: 'workflow.field.segmentPlaceholder' }
    ]
  },
  {
    type: 'tag_changed',
    kind: 'trigger',
    labelKey: 'workflow.node.tag_changed.label',
    descKey: 'workflow.node.tag_changed.desc',
    accent: 'primary',
    fields: [
      { key: 'tag', labelKey: 'workflow.field.tag', type: 'text', required: true, placeholderKey: 'workflow.field.tagPlaceholder' },
      { key: 'change', labelKey: 'workflow.field.change', type: 'select', required: true, options: TRIGGER_CHANGE_OPTIONS, defaultValue: 'any' }
    ]
  },
  {
    type: 'message_received',
    kind: 'trigger',
    labelKey: 'workflow.node.message_received.label',
    descKey: 'workflow.node.message_received.desc',
    accent: 'primary',
    fields: [
      { key: 'channel', labelKey: 'workflow.field.channel', type: 'select', required: true, options: CHANNEL_OPTIONS, defaultValue: 'whatsapp' },
      { key: 'keyword', labelKey: 'workflow.field.keyword', type: 'text', placeholderKey: 'workflow.field.keywordPlaceholder', helpKey: 'workflow.field.keywordHelp' },
      { key: 'inboundOnly', labelKey: 'workflow.field.inboundOnly', type: 'switch', defaultValue: true }
    ]
  },
  {
    type: 'marketing_response',
    kind: 'trigger',
    labelKey: 'workflow.node.marketing_response.label',
    descKey: 'workflow.node.marketing_response.desc',
    accent: 'primary',
    fields: [
      { key: 'campaignId', labelKey: 'workflow.field.campaignId', type: 'text', placeholderKey: 'workflow.field.campaignIdPlaceholder' },
      { key: 'event', labelKey: 'workflow.field.event', type: 'select', required: true, options: MARKETING_EVENT_OPTIONS, defaultValue: 'any' }
    ]
  },
  {
    type: 'schedule',
    kind: 'trigger',
    labelKey: 'workflow.node.schedule.label',
    descKey: 'workflow.node.schedule.desc',
    accent: 'primary',
    fields: [
      { key: 'cron', labelKey: 'workflow.field.cron', type: 'text', required: true, placeholderKey: 'workflow.field.cronPlaceholder', helpKey: 'workflow.field.cronHelp' },
      { key: 'timezone', labelKey: 'workflow.field.timezone', type: 'text', defaultValue: DEFAULT_TIMEZONE }
    ]
  },
  {
    type: 'customer_birthday',
    kind: 'trigger',
    labelKey: 'workflow.node.customer_birthday.label',
    descKey: 'workflow.node.customer_birthday.desc',
    accent: 'primary',
    fields: [
      { key: 'offsetDays', labelKey: 'workflow.field.offsetDays', type: 'number', min: -7, max: 7, defaultValue: 0, helpKey: 'workflow.field.offsetDaysHelp' },
      { key: 'segment', labelKey: 'workflow.field.segment', type: 'text', placeholderKey: 'workflow.field.segmentPlaceholder' }
    ]
  },
  {
    type: 'customer_inactive',
    kind: 'trigger',
    labelKey: 'workflow.node.customer_inactive.label',
    descKey: 'workflow.node.customer_inactive.desc',
    accent: 'primary',
    fields: [
      { key: 'days', labelKey: 'workflow.field.days', type: 'number', required: true, min: 1, max: 365, defaultValue: 30 }
    ]
  }
];

const CONDITION_TYPES: NodeTypeDef[] = [
  {
    type: 'has_tag',
    kind: 'condition',
    labelKey: 'workflow.node.has_tag.label',
    descKey: 'workflow.node.has_tag.desc',
    accent: 'warning',
    fields: [
      { key: 'tag', labelKey: 'workflow.field.tag', type: 'text', required: true, placeholderKey: 'workflow.field.tagPlaceholder' }
    ]
  },
  {
    type: 'in_segment',
    kind: 'condition',
    labelKey: 'workflow.node.in_segment.label',
    descKey: 'workflow.node.in_segment.desc',
    accent: 'warning',
    fields: [
      { key: 'segment', labelKey: 'workflow.field.segment', type: 'text', required: true, placeholderKey: 'workflow.field.segmentPlaceholder' }
    ]
  },
  {
    type: 'channel_is',
    kind: 'condition',
    labelKey: 'workflow.node.channel_is.label',
    descKey: 'workflow.node.channel_is.desc',
    accent: 'warning',
    fields: [
      { key: 'channel', labelKey: 'workflow.field.channel', type: 'select', required: true, options: CHANNEL_OPTIONS, defaultValue: 'whatsapp' }
    ]
  },
  {
    type: 'time_window',
    kind: 'condition',
    labelKey: 'workflow.node.time_window.label',
    descKey: 'workflow.node.time_window.desc',
    accent: 'warning',
    fields: [
      { key: 'startHour', labelKey: 'workflow.field.startHour', type: 'number', required: true, min: 0, max: 23, defaultValue: 9 },
      { key: 'endHour', labelKey: 'workflow.field.endHour', type: 'number', required: true, min: 0, max: 23, defaultValue: 18 },
      { key: 'weekdays', labelKey: 'workflow.field.weekdays', type: 'text', defaultValue: '1,2,3,4,5', helpKey: 'workflow.field.weekdaysHelp' }
    ]
  },
  {
    type: 'expression',
    kind: 'condition',
    labelKey: 'workflow.node.expression.label',
    descKey: 'workflow.node.expression.desc',
    accent: 'warning',
    fields: [
      { key: 'expression', labelKey: 'workflow.field.expression', type: 'textarea', required: true, placeholderKey: 'workflow.field.expressionPlaceholder', helpKey: 'workflow.field.expressionHelp' }
    ]
  }
];

const ACTION_TYPES: NodeTypeDef[] = [
  {
    type: 'send_message',
    kind: 'action',
    labelKey: 'workflow.node.send_message.label',
    descKey: 'workflow.node.send_message.desc',
    accent: 'accent',
    fields: [
      { key: 'channel', labelKey: 'workflow.field.channel', type: 'select', required: true, options: CHANNEL_OPTIONS, defaultValue: 'whatsapp' },
      { key: 'template', labelKey: 'workflow.field.template', type: 'textarea', required: true, placeholderKey: 'workflow.field.templatePlaceholder', helpKey: 'workflow.field.templateHelp' },
      { key: 'useAi', labelKey: 'workflow.field.useAi', type: 'switch', defaultValue: false, helpKey: 'workflow.field.useAiHelp' }
    ]
  },
  {
    type: 'add_tag',
    kind: 'action',
    labelKey: 'workflow.node.add_tag.label',
    descKey: 'workflow.node.add_tag.desc',
    accent: 'success',
    fields: [
      { key: 'tag', labelKey: 'workflow.field.tag', type: 'text', required: true, placeholderKey: 'workflow.field.tagPlaceholder' }
    ]
  },
  {
    type: 'remove_tag',
    kind: 'action',
    labelKey: 'workflow.node.remove_tag.label',
    descKey: 'workflow.node.remove_tag.desc',
    accent: 'success',
    fields: [
      { key: 'tag', labelKey: 'workflow.field.tag', type: 'text', required: true, placeholderKey: 'workflow.field.tagPlaceholder' }
    ]
  },
  {
    type: 'move_segment',
    kind: 'action',
    labelKey: 'workflow.node.move_segment.label',
    descKey: 'workflow.node.move_segment.desc',
    accent: 'success',
    fields: [
      { key: 'segment', labelKey: 'workflow.field.segment', type: 'text', required: true, placeholderKey: 'workflow.field.segmentPlaceholder' }
    ]
  },
  {
    type: 'trigger_campaign',
    kind: 'action',
    labelKey: 'workflow.node.trigger_campaign.label',
    descKey: 'workflow.node.trigger_campaign.desc',
    accent: 'accent',
    fields: [
      { key: 'campaignId', labelKey: 'workflow.field.campaignId', type: 'text', required: true, placeholderKey: 'workflow.field.campaignIdPlaceholder' }
    ]
  },
  {
    type: 'send_notification',
    kind: 'action',
    labelKey: 'workflow.node.send_notification.label',
    descKey: 'workflow.node.send_notification.desc',
    accent: 'accent',
    fields: [
      { key: 'title', labelKey: 'workflow.field.title', type: 'text', required: true },
      { key: 'body', labelKey: 'workflow.field.body', type: 'textarea' },
      { key: 'level', labelKey: 'workflow.field.level', type: 'select', options: NOTIFICATION_LEVEL_OPTIONS, defaultValue: 'info' }
    ]
  },
  {
    type: 'wait',
    kind: 'action',
    labelKey: 'workflow.node.wait.label',
    descKey: 'workflow.node.wait.desc',
    accent: 'warning',
    fields: [
      { key: 'duration', labelKey: 'workflow.field.duration', type: 'number', required: true, min: 1, max: 43200, defaultValue: 1 },
      { key: 'unit', labelKey: 'workflow.field.unit', type: 'select', required: true, options: WAIT_UNIT_OPTIONS, defaultValue: 'hours' }
    ]
  },
  {
    type: 'http_request',
    kind: 'action',
    labelKey: 'workflow.node.http_request.label',
    descKey: 'workflow.node.http_request.desc',
    accent: 'accent',
    fields: [
      { key: 'method', labelKey: 'workflow.field.method', type: 'select', required: true, options: HTTP_METHOD_OPTIONS, defaultValue: 'POST' },
      { key: 'url', labelKey: 'workflow.field.url', type: 'text', required: true, placeholderKey: 'workflow.field.urlPlaceholder' },
      { key: 'body', labelKey: 'workflow.field.body', type: 'textarea' },
      { key: 'timeoutMs', labelKey: 'workflow.field.timeoutMs', type: 'number', min: 500, max: 60000, defaultValue: 10000 }
    ]
  },
  {
    type: 'update_profile',
    kind: 'action',
    labelKey: 'workflow.node.update_profile.label',
    descKey: 'workflow.node.update_profile.desc',
    accent: 'success',
    fields: [
      { key: 'field', labelKey: 'workflow.field.field', type: 'text', required: true, placeholderKey: 'workflow.field.fieldPlaceholder' },
      { key: 'value', labelKey: 'workflow.field.value', type: 'text', required: true }
    ]
  }
];

/** Palette order: triggers, then conditions, then actions. */
export const NODE_TYPES: NodeTypeDef[] = [...TRIGGER_TYPES, ...CONDITION_TYPES, ...ACTION_TYPES];

const BY_TYPE = new Map<WorkflowNodeType, NodeTypeDef>(
  NODE_TYPES.map((def) => [def.type, def])
);

export function nodeTypeDef(type: WorkflowNodeType): NodeTypeDef | undefined {
  return BY_TYPE.get(type);
}

/** Falls back to a bare definition so an unknown type from the server still renders. */
export function nodeTypeDefOrFallback(type: WorkflowNodeType, kind: WorkflowNodeKind): NodeTypeDef {
  return (
    BY_TYPE.get(type) ?? {
      type,
      kind,
      labelKey: 'workflow.node.unknown.label',
      descKey: 'workflow.node.unknown.desc',
      accent: 'warning',
      fields: []
    }
  );
}

export function nodesByKind(kind: WorkflowNodeKind): NodeTypeDef[] {
  return NODE_TYPES.filter((def) => def.kind === kind);
}

export function isTriggerType(type: WorkflowNodeType): type is TriggerKind {
  return BY_TYPE.get(type)?.kind === 'trigger';
}

export function isConditionType(type: WorkflowNodeType): type is ConditionKind {
  return BY_TYPE.get(type)?.kind === 'condition';
}

export function isActionType(type: WorkflowNodeType): type is ActionKind {
  return BY_TYPE.get(type)?.kind === 'action';
}

/** Seed config straight from the field defaults so a fresh node is already usable. */
export function defaultConfigFor(type: WorkflowNodeType): NodeConfig {
  const config: NodeConfig = {};
  for (const field of BY_TYPE.get(type)?.fields ?? []) {
    if (field.defaultValue !== undefined) config[field.key] = field.defaultValue;
  }
  return config;
}

export function fieldsFor(type: WorkflowNodeType): NodeTypeDef['fields'] {
  return BY_TYPE.get(type)?.fields ?? [];
}

export function requiredKeysFor(type: WorkflowNodeType): string[] {
  return fieldsFor(type)
    .filter((field) => field.required)
    .map((field) => field.key);
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** Required keys the operator has not filled in yet; drives the property panel badge. */
export function missingRequiredKeys(node: Pick<WorkflowNode, 'type' | 'config'>): string[] {
  return requiredKeysFor(node.type).filter((key) => isBlank(node.config[key]));
}

/** Every distinct config key any node type declares, used by the JSON export. */
export function allConfigKeys(): string[] {
  const keys = new Set<string>();
  for (const def of NODE_TYPES) {
    for (const field of def.fields) keys.add(field.key);
  }
  return [...keys].sort();
}
