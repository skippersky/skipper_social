<script setup lang="ts">
/**
 * Right rail of the builder: the config form for whichever node is selected
 * (Sprint 12).
 *
 * The form is generated from the field schema in lib/workflowNodes, so adding a
 * node type to the palette automatically gives it a property form. Nothing here
 * talks to the store: it emits patches and the view forwards them to
 * useWorkflowBuilder, which keeps the graph immutable and the canvas honest.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { ERROR_STRATEGY_OPTIONS, nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import { MAX_NODE_RETRIES } from '../../types';
import type {
  NodeConfig,
  NodeConfigValue,
  NodeErrorStrategy,
  NodeFieldDef,
  WorkflowIssue,
  WorkflowNode
} from '../../types';

const props = defineProps<{
  node: WorkflowNode | null;
  issues?: WorkflowIssue[];
  missing?: string[];
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'patch', patch: Partial<WorkflowNode>): void;
  (e: 'config', patch: NodeConfig): void;
  (e: 'remove', id: string): void;
  (e: 'close'): void;
}>();

const i18n = useI18nStore();

const typeDef = computed(() =>
  props.node ? nodeTypeDefOrFallback(props.node.type, props.node.kind) : null
);
const fields = computed<NodeFieldDef[]>(() => typeDef.value?.fields ?? []);
const missingKeys = computed(() => props.missing ?? []);
const issueList = computed(() => props.issues ?? []);
const locked = computed(() => props.readonly === true);

/** Reads a config value with the schema default as the fallback. */
function valueOf(field: NodeFieldDef): NodeConfigValue {
  if (!props.node) return field.defaultValue ?? '';
  const stored = props.node.config[field.key];
  if (stored !== undefined) return stored;
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'switch') return false;
  if (field.type === 'number') return 0;
  return '';
}

function textValue(field: NodeFieldDef): string {
  const value = valueOf(field);
  return value === undefined ? '' : String(value);
}

function numberValue(field: NodeFieldDef): number {
  const value = valueOf(field);
  return typeof value === 'number' ? value : Number(value) || 0;
}

function boolValue(field: NodeFieldDef): boolean {
  return valueOf(field) === true;
}

function onText(field: NodeFieldDef, event: Event): void {
  if (locked.value) return;
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('config', { [field.key]: target.value });
}

function onNumber(field: NodeFieldDef, event: Event): void {
  if (locked.value) return;
  const target = event.target as HTMLInputElement;
  const raw = Number(target.value);
  const next = Number.isFinite(raw) ? raw : 0;
  const floor = field.min ?? Number.MIN_SAFE_INTEGER;
  const ceiling = field.max ?? Number.MAX_SAFE_INTEGER;
  emit('config', { [field.key]: Math.min(ceiling, Math.max(floor, next)) });
}

function onSelect(field: NodeFieldDef, event: Event): void {
  if (locked.value) return;
  const target = event.target as HTMLSelectElement;
  emit('config', { [field.key]: target.value });
}

function onSwitch(field: NodeFieldDef): void {
  if (locked.value) return;
  emit('config', { [field.key]: !boolValue(field) });
}

function onName(event: Event): void {
  if (locked.value) return;
  emit('patch', { name: (event.target as HTMLInputElement).value });
}

function onDescription(event: Event): void {
  if (locked.value) return;
  emit('patch', { description: (event.target as HTMLTextAreaElement).value });
}

function onStrategy(event: Event): void {
  if (locked.value) return;
  emit('patch', { errorStrategy: (event.target as HTMLSelectElement).value as NodeErrorStrategy });
}

function onRetries(event: Event): void {
  if (locked.value) return;
  const raw = Number((event.target as HTMLInputElement).value);
  const next = Number.isFinite(raw) ? Math.round(raw) : 0;
  emit('patch', { retries: Math.min(MAX_NODE_RETRIES, Math.max(0, next)) });
}

function onRemove(): void {
  if (locked.value || !props.node) return;
  emit('remove', props.node.id);
}

function onClose(): void {
  emit('close');
}
</script>

<template>
  <aside class="pp" :aria-label="i18n.t('workflow.property.title')">
    <header class="pp__head">
      <h2 class="pp__title">{{ i18n.t('workflow.property.title') }}</h2>
      <button
        class="pp__close"
        type="button"
        :aria-label="i18n.t('workflow.property.close')"
        @click="onClose"
      >&times;</button>
    </header>

    <p v-if="!node" class="pp__empty">{{ i18n.t('workflow.property.empty') }}</p>

    <template v-else>
      <div class="pp__kind">
        <span class="pp__badge" :class="'is-' + node.kind">{{ i18n.t('workflow.kind.' + node.kind) }}</span>
        <span class="pp__type">{{ typeDef ? i18n.t(typeDef.labelKey) : node.type }}</span>
      </div>

      <p v-if="typeDef" class="pp__desc">{{ i18n.t(typeDef.descKey) }}</p>

      <div v-if="issueList.length > 0" class="pp__issues" role="alert">
        <p v-for="(item, index) in issueList" :key="item.code + '-' + index" class="pp__issue">
          {{ i18n.t(item.messageKey) }}
        </p>
      </div>

      <div class="pp__field">
        <label class="pp__label" :for="'pp-name-' + node.id">
          {{ i18n.t('workflow.property.name') }}
        </label>
        <input
          :id="'pp-name-' + node.id"
          class="pp__input"
          type="text"
          :value="node.name"
          :disabled="locked"
          :placeholder="i18n.t('workflow.property.namePlaceholder')"
          @input="onName"
        />
      </div>

      <div class="pp__field">
        <label class="pp__label" :for="'pp-desc-' + node.id">
          {{ i18n.t('workflow.property.description') }}
        </label>
        <textarea
          :id="'pp-desc-' + node.id"
          class="pp__input pp__input--area"
          rows="2"
          :value="node.description ?? ''"
          :disabled="locked"
          @input="onDescription"
        ></textarea>
      </div>

      <div
        v-for="field in fields"
        :key="field.key"
        class="pp__field"
        :data-field="field.key"
        :class="{ 'is-missing': missingKeys.includes(field.key) }"
      >
        <label class="pp__label" :for="'pp-' + node.id + '-' + field.key">
          {{ i18n.t(field.labelKey) }}
          <span v-if="field.required" class="pp__req" aria-hidden="true">*</span>
        </label>

        <input
          v-if="field.type === 'text'"
          :id="'pp-' + node.id + '-' + field.key"
          class="pp__input"
          type="text"
          :value="textValue(field)"
          :disabled="locked"
          :placeholder="field.placeholderKey ? i18n.t(field.placeholderKey) : ''"
          @input="onText(field, $event)"
        />

        <textarea
          v-else-if="field.type === 'textarea'"
          :id="'pp-' + node.id + '-' + field.key"
          class="pp__input pp__input--area"
          rows="4"
          :value="textValue(field)"
          :disabled="locked"
          :placeholder="field.placeholderKey ? i18n.t(field.placeholderKey) : ''"
          @input="onText(field, $event)"
        ></textarea>

        <input
          v-else-if="field.type === 'number'"
          :id="'pp-' + node.id + '-' + field.key"
          class="pp__input"
          type="number"
          :value="numberValue(field)"
          :min="field.min"
          :max="field.max"
          :disabled="locked"
          @input="onNumber(field, $event)"
        />

        <select
          v-else-if="field.type === 'select'"
          :id="'pp-' + node.id + '-' + field.key"
          class="pp__input"
          :value="textValue(field)"
          :disabled="locked"
          @change="onSelect(field, $event)"
        >
          <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">
            {{ i18n.t(option.labelKey) }}
          </option>
        </select>

        <button
          v-else
          :id="'pp-' + node.id + '-' + field.key"
          class="pp__switch"
          type="button"
          role="switch"
          :aria-checked="boolValue(field)"
          :disabled="locked"
          @click="onSwitch(field)"
        >
          <span class="pp__switch-track" :class="{ 'is-on': boolValue(field) }">
            <span class="pp__switch-knob"></span>
          </span>
          <span class="pp__switch-text">
            {{ boolValue(field) ? i18n.t('workflow.property.on') : i18n.t('workflow.property.off') }}
          </span>
        </button>

        <p v-if="field.helpKey" class="pp__help">{{ i18n.t(field.helpKey) }}</p>
        <p v-if="missingKeys.includes(field.key)" class="pp__missing">
          {{ i18n.t('workflow.property.required') }}
        </p>
      </div>

      <div class="pp__divider"></div>

      <div class="pp__field">
        <label class="pp__label" :for="'pp-strategy-' + node.id">
          {{ i18n.t('workflow.property.errorStrategy') }}
        </label>
        <select
          :id="'pp-strategy-' + node.id"
          class="pp__input"
          :value="node.errorStrategy"
          :disabled="locked"
          @change="onStrategy"
        >
          <option v-for="option in ERROR_STRATEGY_OPTIONS" :key="option.value" :value="option.value">
            {{ i18n.t(option.labelKey) }}
          </option>
        </select>
        <p class="pp__help">{{ i18n.t('workflow.property.errorStrategyHelp') }}</p>
      </div>

      <div class="pp__field">
        <label class="pp__label" :for="'pp-retries-' + node.id">
          {{ i18n.t('workflow.property.retries') }}
        </label>
        <input
          :id="'pp-retries-' + node.id"
          class="pp__input"
          type="number"
          min="0"
          :max="MAX_NODE_RETRIES"
          :value="node.retries"
          :disabled="locked || node.errorStrategy !== 'retry'"
          @input="onRetries"
        />
        <p class="pp__help">{{ i18n.t('workflow.property.retriesHelp', { max: MAX_NODE_RETRIES }) }}</p>
      </div>

      <button v-if="!locked" class="pp__delete" type="button" @click="onRemove">
        {{ i18n.t('workflow.property.delete') }}
      </button>
    </template>
  </aside>
</template>

<style scoped>
.pp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  height: 100%;
  padding: 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  overflow-y: auto;
}
.pp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pp__title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.pp__close {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ks-border-default);
  border-radius: 50%;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.pp__close:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.pp__empty {
  margin: 0;
  padding: 24px 12px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.pp__kind {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pp__badge {
  flex: none;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid var(--ks-border-strong);
  color: var(--ks-text-secondary);
}
.pp__badge.is-trigger {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.pp__badge.is-condition {
  border-color: var(--ks-accent);
  color: var(--ks-accent);
}
.pp__badge.is-action {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.pp__type {
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp__desc {
  margin: 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--ks-text-tertiary);
}
.pp__issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.pp__issue {
  margin: 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--ks-error);
}
.pp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pp__field.is-missing .pp__input {
  border-color: var(--ks-error);
}
.pp__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.pp__req {
  color: var(--ks-error);
}
.pp__input {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.pp__input--area {
  resize: vertical;
  line-height: 19px;
}
.pp__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.pp__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pp__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}
.pp__switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pp__switch:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
  border-radius: var(--ks-radius-btn);
}
.pp__switch-track {
  flex: none;
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--ks-border-strong);
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.pp__switch-track.is-on {
  background: var(--ks-grad-brand);
}
.pp__switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: transform var(--ks-motion-fast) var(--ks-ease);
}
.pp__switch-track.is-on .pp__switch-knob {
  transform: translateX(18px);
}
.pp__switch-text {
  font-size: 12px;
  color: var(--ks-text-secondary);
}
.pp__help {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
}
.pp__missing {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-error);
  font-weight: 600;
}
.pp__divider {
  height: 1px;
  background: var(--ks-border-default);
}
.pp__delete {
  margin-top: auto;
  height: 38px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-error);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.pp__delete:hover {
  background: var(--ks-bg-muted);
}
.pp__delete:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}

@media (max-width: 1023px) {
  .pp {
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    overflow: visible;
  }
}
</style>
