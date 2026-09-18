<script setup lang="ts">
/**
 * One preset in the workflow template library (Sprint 12).
 *
 * Presentational only. A template carries i18n keys instead of literals, so the
 * card resolves name, description and scenario through t() and the whole
 * library translates with the rest of the product. Both actions are emits: the
 * page owns preview state and the create call, which keeps the store out of the
 * card and lets the same component serve the grid and the preview dialog.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { summarizeDefinition } from '../../lib/workflowGraph';
import type { WorkflowTemplate } from '../../types';

const props = defineProps<{ template: WorkflowTemplate; active?: boolean }>();

const emit = defineEmits<{
  (e: 'preview', id: string): void;
  (e: 'use', id: string): void;
}>();

const i18n = useI18nStore();

const name = computed(() => i18n.t(props.template.nameKey));
const description = computed(() => i18n.t(props.template.descriptionKey));
const scenario = computed(() => i18n.t(props.template.scenarioKey));
const complexity = computed(() => i18n.t('workflow.complexity.' + props.template.complexity));
const steps = computed(() => summarizeDefinition(props.template.definition).nodes);

function onPreview(): void {
  emit('preview', props.template.id);
}

function onUse(): void {
  emit('use', props.template.id);
}
</script>

<template>
  <article class="tc" :class="{ 'is-active': active }">
    <header class="tc__head">
      <h3 class="tc__name">{{ name }}</h3>
      <span class="tc__badge" :class="'is-' + template.complexity">{{ complexity }}</span>
    </header>
    <p class="tc__desc">{{ description }}</p>
    <dl class="tc__facts">
      <div class="tc__fact">
        <dt>{{ i18n.t('workflow.templates.filterScenario') }}</dt>
        <dd>{{ scenario }}</dd>
      </div>
      <div class="tc__fact">
        <dt>{{ i18n.t('workflow.templates.stepCount', { n: steps }) }}</dt>
        <dd>{{ i18n.t('workflow.templateCard.steps', { n: steps }) }}</dd>
      </div>
      <div class="tc__fact">
        <dt>{{ i18n.t('workflow.templates.useCount', { n: template.useCount }) }}</dt>
        <dd class="tc__uses">{{ template.useCount }}</dd>
      </div>
    </dl>
    <footer class="tc__actions">
      <button
        class="tc__btn"
        type="button"
        :title="i18n.t('workflow.templates.preview')"
        @click="onPreview"
      >
        {{ i18n.t('workflow.templateCard.preview') }}
      </button>
      <button
        class="tc__btn is-primary"
        type="button"
        :title="i18n.t('workflow.templates.use')"
        @click="onUse"
      >
        {{ i18n.t('workflow.templateCard.use') }}
      </button>
    </footer>
  </article>
</template>

<style scoped>
.tc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    transform var(--ks-motion-fast) var(--ks-ease);
}
.tc:hover {
  border-color: var(--ks-border-strong);
  transform: translateY(-1px);
}
.tc.is-active {
  border-color: var(--ks-primary);
}
.tc__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.tc__name {
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 21px;
}
.tc__badge {
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
.tc__badge.is-simple {
  border-color: var(--ks-success);
  color: var(--ks-success);
}
.tc__badge.is-medium {
  border-color: var(--ks-warning);
  color: var(--ks-warning);
}
.tc__badge.is-complex {
  border-color: var(--ks-accent);
  color: var(--ks-accent);
}
.tc__desc {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.tc__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--ks-border-default);
}
.tc__fact {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}
.tc__fact dt {
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 600;
}
.tc__fact dd {
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tc__actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}
.tc__btn {
  flex: 1 1 auto;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.tc__btn:hover {
  background: var(--ks-bg-muted);
}
.tc__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.tc__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tc__btn.is-primary:hover {
  filter: brightness(1.04);
}

@media (max-width: 767px) {
  .tc__actions {
    flex-direction: column;
  }
}
</style>
