<script setup lang="ts">
/**
 * Execution log for one workflow run (Sprint 12).
 *
 * The spec asks for a timeline carrying node name, time, state, input, output
 * and error. Payloads start collapsed: a twenty node run would otherwise be a
 * wall of JSON that hides the one line you came for. State badges read from the
 * same NodeRunState vocabulary the execution path paints, so the two views can
 * never disagree about what a colour means.
 */
import { computed, ref } from 'vue';
import { useI18nStore } from '../../i18n';
import { kindOfType } from '../../lib/workflowGraph';
import { nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import { formatDuration } from '../../lib/workflowRun';
import type { NodeRun } from '../../types';

const props = defineProps<{ nodeRuns: NodeRun[] }>();

const emit = defineEmits<{ (e: 'select', nodeId: string): void }>();

const i18n = useI18nStore();

/** Per node drawer state, so opening one payload leaves the others closed. */
const open = ref<Record<string, boolean>>({});

const items = computed<NodeRun[]>(() => props.nodeRuns ?? []);
const isEmpty = computed(() => items.value.length === 0);

function labelOf(item: NodeRun): string {
  if (item.nodeName && item.nodeName.trim()) return item.nodeName;
  return i18n.t(nodeTypeDefOrFallback(item.nodeType, kindOfType(item.nodeType)).labelKey);
}

function typeLabelOf(item: NodeRun): string {
  return i18n.t(nodeTypeDefOrFallback(item.nodeType, kindOfType(item.nodeType)).labelKey);
}

function startedText(item: NodeRun): string {
  if (item.startedAt === null) return i18n.t('workflow.timeline.notStarted');
  return new Date(item.startedAt).toLocaleString();
}

function durationText(item: NodeRun): string {
  return formatDuration(item.durationMs, i18n.locale);
}

/** Empty payloads render as the explicit "no payload" label, never as "{}". */
function payloadOf(value: Record<string, unknown> | undefined): string {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value, null, 2);
}

function hasPayload(item: NodeRun): boolean {
  return payloadOf(item.input) !== '' || payloadOf(item.output) !== '';
}

function isOpen(nodeId: string): boolean {
  return open.value[nodeId] === true;
}

function toggle(nodeId: string): void {
  open.value = { ...open.value, [nodeId]: !isOpen(nodeId) };
}

function onSelect(nodeId: string): void {
  emit('select', nodeId);
}
</script>

<template>
  <div class="rt">
    <p v-if="isEmpty" class="rt__empty">{{ i18n.t('workflow.timeline.empty') }}</p>
    <ol v-else class="rt__list">
      <li
        v-for="(item, index) in items"
        :key="item.nodeId + ':' + index"
        class="rt__item"
        :class="'is-' + item.state"
      >
        <span class="rt__dot" aria-hidden="true"></span>
        <div class="rt__body">
          <div class="rt__head">
            <button class="rt__name" type="button" @click="onSelect(item.nodeId)">
              {{ labelOf(item) }}
            </button>
            <span class="rt__state">{{ i18n.t('workflow.nodeState.' + item.state) }}</span>
          </div>
          <p class="rt__meta">
            <span class="rt__type">{{ typeLabelOf(item) }}</span>
            <span class="rt__sep" aria-hidden="true">&middot;</span>
            <span>{{ i18n.t('workflow.timeline.started') }}: {{ startedText(item) }}</span>
            <span class="rt__sep" aria-hidden="true">&middot;</span>
            <span>{{ durationText(item) }}</span>
            <template v-if="item.attempts > 1">
              <span class="rt__sep" aria-hidden="true">&middot;</span>
              <span>{{ i18n.t('workflow.timeline.attempts', { n: item.attempts }) }}</span>
            </template>
          </p>
          <p v-if="item.error" class="rt__error">
            <strong>{{ i18n.t('workflow.timeline.error') }}:</strong>
            {{ i18n.t(item.error) }}
          </p>
          <button
            v-if="hasPayload(item)"
            class="rt__toggle"
            type="button"
            :aria-expanded="isOpen(item.nodeId)"
            @click="toggle(item.nodeId)"
          >
            {{ isOpen(item.nodeId) ? i18n.t('workflow.timeline.collapse') : i18n.t('workflow.timeline.expand') }}
          </button>
          <div v-if="isOpen(item.nodeId)" class="rt__payloads">
            <section class="rt__payload">
              <h4 class="rt__payload-title">{{ i18n.t('workflow.timeline.input') }}</h4>
              <pre v-if="payloadOf(item.input)" class="rt__code">{{ payloadOf(item.input) }}</pre>
              <p v-else class="rt__nodata">{{ i18n.t('workflow.timeline.noData') }}</p>
            </section>
            <section class="rt__payload">
              <h4 class="rt__payload-title">{{ i18n.t('workflow.timeline.output') }}</h4>
              <pre v-if="payloadOf(item.output)" class="rt__code">{{ payloadOf(item.output) }}</pre>
              <p v-else class="rt__nodata">{{ i18n.t('workflow.timeline.noData') }}</p>
            </section>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.rt__empty {
  margin: 0;
  padding: 24px 16px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  color: var(--ks-text-tertiary);
  font-size: 13px;
  text-align: center;
}
.rt__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0 0 0 6px;
  list-style: none;
}
.rt__item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 10px 0 10px 4px;
  border-left: 2px solid var(--ks-border-default);
}
.rt__item:last-child {
  border-left-color: transparent;
}
.rt__dot {
  position: absolute;
  left: -7px;
  top: 16px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--ks-bg-surface);
  border-radius: 50%;
  background: var(--ks-border-strong);
}
.rt__item.is-succeeded .rt__dot {
  background: var(--ks-success);
}
.rt__item.is-failed .rt__dot {
  background: var(--ks-error);
}
.rt__item.is-running .rt__dot {
  background: var(--ks-primary);
  animation: rt-pulse 1.4s var(--ks-ease) infinite;
}
.rt__item.is-skipped .rt__dot {
  background: var(--ks-warning);
}
@keyframes rt-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(244, 99, 58, 0.45);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(244, 99, 58, 0);
  }
}
.rt__body {
  flex: 1;
  min-width: 0;
}
.rt__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.rt__name {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ks-text-primary);
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.rt__name:hover {
  color: var(--ks-primary-text);
}
.rt__name:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
  border-radius: 4px;
}
.rt__state {
  flex: none;
  padding: 2px 9px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.rt__item.is-succeeded .rt__state {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.rt__item.is-failed .rt__state {
  border-color: var(--ks-error);
  color: var(--ks-error);
}
.rt__item.is-running .rt__state {
  border-color: var(--ks-primary);
  color: var(--ks-primary-text);
}
.rt__item.is-skipped .rt__state {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.rt__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 4px 0 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.rt__type {
  color: var(--ks-text-secondary);
  font-weight: 600;
}
.rt__sep {
  color: var(--ks-border-strong);
}
.rt__error {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 12px;
  line-height: 18px;
}
.rt__toggle {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ks-primary-text);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.rt__toggle:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
  border-radius: 4px;
}
.rt__payloads {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.rt__payload {
  min-width: 0;
}
.rt__payload-title {
  margin: 0 0 4px;
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.rt__code {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
  font-family: var(--ks-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 17px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}
.rt__nodata {
  margin: 0;
  padding: 8px 10px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-text-tertiary);
  font-size: 12px;
}

@media (max-width: 767px) {
  .rt__payloads {
    grid-template-columns: minmax(0, 1fr);
  }
  .rt__head {
    align-items: flex-start;
  }
}
</style>
