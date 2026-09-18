<script setup lang="ts">
/**
 * Execution path of one workflow run (Sprint 12).
 *
 * A horizontal strip of the nodes the engine actually walked, in replay order,
 * each chip painted by its NodeRunState. It is deliberately read only: the run
 * detail page already offers the graph for structure and the timeline for
 * payloads, so this component answers exactly one question, "how far did it get
 * and where did it stop". Skipped chips carry the branch label because a
 * condition node that sent the run down one arm leaves the other arm skipped.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { kindOfType } from '../../lib/workflowGraph';
import { nodeTypeDefOrFallback } from '../../lib/workflowNodes';
import type { NodeRun, WorkflowRun } from '../../types';

const props = defineProps<{ run: WorkflowRun | null }>();

const emit = defineEmits<{ (e: 'select', nodeId: string): void }>();

const i18n = useI18nStore();

const steps = computed<NodeRun[]>(() => props.run?.nodeRuns ?? []);
const isEmpty = computed(() => steps.value.length === 0);

/** Where the run currently sits, for the "reached step n of m" reading. */
const reachedIndex = computed(() => {
  let last = -1;
  steps.value.forEach((item, index) => {
    if (item.state !== 'pending') last = index;
  });
  return last;
});

function labelOf(item: NodeRun): string {
  if (item.nodeName && item.nodeName.trim()) return item.nodeName;
  return i18n.t(nodeTypeDefOrFallback(item.nodeType, kindOfType(item.nodeType)).labelKey);
}

function onSelect(nodeId: string): void {
  emit('select', nodeId);
}
</script>

<template>
  <div class="ep">
    <p v-if="isEmpty" class="ep__empty">{{ i18n.t('workflow.path.empty') }}</p>
    <ol v-else class="ep__track" :aria-label="i18n.t('workflow.runDetail.pathTitle')">
      <li class="ep__cap">
        <span class="ep__cap-dot" aria-hidden="true"></span>
        <span class="ep__cap-label">{{ i18n.t('workflow.path.start') }}</span>
      </li>
      <li
        v-for="(item, index) in steps"
        :key="item.nodeId + ':' + index"
        class="ep__step"
        :class="['is-' + item.state, { 'is-reached': index === reachedIndex }]"
      >
        <button class="ep__chip" type="button" @click="onSelect(item.nodeId)">
          <span class="ep__index">{{ i18n.t('workflow.path.step', { n: index + 1 }) }}</span>
          <span class="ep__label">{{ labelOf(item) }}</span>
          <span class="ep__state">{{ i18n.t('workflow.nodeState.' + item.state) }}</span>
        </button>
        <span v-if="item.state === 'skipped'" class="ep__skipped">
          {{ i18n.t('workflow.path.skippedBranch') }}
        </span>
      </li>
      <li class="ep__cap">
        <span class="ep__cap-dot" aria-hidden="true"></span>
        <span class="ep__cap-label">{{ i18n.t('workflow.path.end') }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.ep__empty {
  margin: 0;
  padding: 20px 16px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  color: var(--ks-text-tertiary);
  font-size: 13px;
  text-align: center;
}
.ep__track {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 4px 2px 8px;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: thin;
}
.ep__cap {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 12px;
}
.ep__cap-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ks-border-strong);
}
.ep__cap-label {
  color: var(--ks-text-tertiary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ep__step {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.ep__step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 21px;
  left: calc(100% + 2px);
  width: 6px;
  height: 2px;
  background: var(--ks-border-strong);
}
.ep__chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 148px;
  padding: 8px 10px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.ep__chip:hover {
  border-color: var(--ks-border-strong);
  box-shadow: var(--ks-shadow-card);
}
.ep__chip:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.ep__index {
  color: var(--ks-text-tertiary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ep__label {
  color: var(--ks-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.ep__state {
  color: var(--ks-text-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.ep__step.is-succeeded .ep__chip {
  border-left: 3px solid var(--ks-success);
}
.ep__step.is-failed .ep__chip {
  border-color: var(--ks-error);
  border-left: 3px solid var(--ks-error);
  background: var(--ks-bg-muted);
}
.ep__step.is-running .ep__chip {
  border-color: var(--ks-primary);
  border-left: 3px solid var(--ks-primary);
  animation: ep-blink 1.4s var(--ks-ease) infinite;
}
.ep__step.is-skipped .ep__chip {
  border-left: 3px solid var(--ks-warning);
  opacity: 0.85;
}
.ep__step.is-pending .ep__chip {
  opacity: 0.6;
}
.ep__step.is-reached .ep__chip {
  box-shadow: var(--ks-shadow-card);
}
@keyframes ep-blink {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(244, 99, 58, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(244, 99, 58, 0);
  }
}
.ep__skipped {
  color: var(--ks-warning);
  font-size: 10px;
  font-weight: 600;
}

@media (max-width: 767px) {
  .ep__track {
    flex-direction: column;
    align-items: stretch;
    overflow-x: visible;
  }
  .ep__cap {
    flex-direction: row;
    justify-content: center;
    padding-top: 0;
  }
  .ep__step:not(:last-child)::after {
    top: auto;
    bottom: -6px;
    left: 50%;
    width: 2px;
    height: 6px;
  }
  .ep__chip {
    width: 100%;
  }
}
</style>
