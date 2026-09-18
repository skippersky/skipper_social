<script setup lang="ts">
/**
 * One workflow in the list grid (Sprint 12).
 *
 * Presentational by design: every action is an emit, so the list view owns the
 * store calls and the toasts. Status drives both the badge and which actions
 * are reachable, which makes publishing an invalid graph impossible from the UI
 * rather than merely rejected by the server.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import { summarizeDefinition } from '../../lib/workflowGraph';
import { nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import type { Workflow } from '../../types';

const props = defineProps<{ workflow: Workflow; now?: number }>();

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'enable', id: string): void;
  (e: 'disable', id: string): void;
  (e: 'duplicate', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'runs', id: string): void;
}>();

const i18n = useI18nStore();

/** Injectable so tests can freeze the "ran 2h ago" label. */
const clock = computed(() => props.now ?? Date.now());
const status = computed(() => props.workflow.status);
const summary = computed(() => summarizeDefinition(props.workflow.definition));
const triggerLabel = computed(() => {
  const kind = props.workflow.triggerKind;
  if (!kind) return i18n.t('workflow.card.noTrigger');
  return i18n.t(nodeTypeDefOrFallback(kind, 'trigger').labelKey);
});
const runTotal = computed(
  () => props.workflow.successRuns + props.workflow.failedRuns
);
const successRate = computed(() =>
  runTotal.value === 0
    ? null
    : Math.round((props.workflow.successRuns / runTotal.value) * 100)
);
const lastRunText = computed(() =>
  props.workflow.lastRunAt === null
    ? i18n.t('workflow.card.neverRun')
    : relativeTime(props.workflow.lastRunAt, clock.value, i18n.locale)
);
const canEnable = computed(() => status.value !== 'active');
const canDisable = computed(() => status.value === 'active');

function onOpen(): void {
  emit('open', props.workflow.id);
}
function onEdit(): void {
  emit('edit', props.workflow.id);
}
function onEnable(): void {
  emit('enable', props.workflow.id);
}
function onDisable(): void {
  emit('disable', props.workflow.id);
}
function onDuplicate(): void {
  emit('duplicate', props.workflow.id);
}
function onDelete(): void {
  emit('delete', props.workflow.id);
}
function onRuns(): void {
  emit('runs', props.workflow.id);
}
</script>

<template>
  <article class="wf" :class="'is-' + status" :data-workflow-id="workflow.id">
    <header class="wf__head">
      <h3 class="wf__name">{{ workflow.name }}</h3>
      <span class="wf__status" :class="'is-' + status">
        {{ i18n.t('workflow.status.' + status) }}
      </span>
    </header>

    <p v-if="workflow.description" class="wf__desc">{{ workflow.description }}</p>

    <dl class="wf__meta">
      <div class="wf__meta-row">
        <dt>{{ i18n.t('workflow.card.trigger') }}</dt>
        <dd>{{ triggerLabel }}</dd>
      </div>
      <div class="wf__meta-row">
        <dt>{{ i18n.t('workflow.card.steps') }}</dt>
        <dd>
          {{ i18n.t('workflow.card.stepCounts', {
            nodes: summary.nodes,
            conditions: summary.conditions,
            actions: summary.actions
          }) }}
        </dd>
      </div>
      <div class="wf__meta-row">
        <dt>{{ i18n.t('workflow.card.todayRuns') }}</dt>
        <dd>{{ workflow.todayRuns }}</dd>
      </div>
      <div class="wf__meta-row">
        <dt>{{ i18n.t('workflow.card.successRate') }}</dt>
        <dd>
          <span v-if="successRate === null" class="wf__muted">
            {{ i18n.t('workflow.card.noRuns') }}
          </span>
          <span v-else :class="successRate >= 80 ? 'wf__ok' : 'wf__bad'">{{ successRate }}%</span>
        </dd>
      </div>
      <div class="wf__meta-row">
        <dt>{{ i18n.t('workflow.card.lastRun') }}</dt>
        <dd>{{ lastRunText }}</dd>
      </div>
    </dl>

    <footer class="wf__actions">
      <button v-if="canEnable" class="wf__btn is-primary" type="button" @click="onEnable">
        {{ i18n.t('workflow.card.enable') }}
      </button>
      <button v-if="canDisable" class="wf__btn" type="button" @click="onDisable">
        {{ i18n.t('workflow.card.disable') }}
      </button>
      <button class="wf__btn is-ghost" type="button" @click="onEdit">
        {{ i18n.t('workflow.card.edit') }}
      </button>
      <button class="wf__btn is-ghost" type="button" @click="onRuns">
        {{ i18n.t('workflow.card.runs') }}
      </button>
      <button class="wf__btn is-ghost" type="button" @click="onDuplicate">
        {{ i18n.t('workflow.card.duplicate') }}
      </button>
      <button class="wf__btn is-ghost" type="button" @click="onOpen">
        {{ i18n.t('workflow.card.open') }}
      </button>
      <button class="wf__btn is-danger" type="button" @click="onDelete">
        {{ i18n.t('workflow.card.delete') }}
      </button>
    </footer>
  </article>
</template>

<style scoped>
.wf {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: box-shadow var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.wf:hover {
  border-color: var(--ks-border-strong);
  box-shadow: var(--ks-shadow-float);
}
.wf__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.wf__name {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
  word-break: break-word;
}
.wf__status {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
.wf__status.is-active {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wf__status.is-paused {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.wf__desc {
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wf__meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wf__meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.wf__meta-row dt {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.wf__meta-row dd {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.wf__muted {
  color: var(--ks-text-tertiary);
}
.wf__ok {
  color: var(--ks-success);
  font-weight: 600;
}
.wf__bad {
  color: var(--ks-error);
  font-weight: 600;
}
.wf__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--ks-border-default);
}
.wf__btn {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.wf__btn:hover {
  background: var(--ks-bg-muted);
}
.wf__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wf__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wf__btn.is-primary:hover {
  filter: brightness(1.04);
}
.wf__btn.is-danger {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.wf__btn.is-ghost {
  border-color: transparent;
  color: var(--ks-primary-text);
}
.wf__btn.is-ghost:hover {
  background: var(--ks-bg-muted);
}

@media (max-width: 767px) {
  .wf {
    padding: 14px;
  }
  .wf__meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .wf__meta-row dd {
    text-align: left;
  }
  .wf__btn {
    flex: 1 1 auto;
  }
}
</style>
