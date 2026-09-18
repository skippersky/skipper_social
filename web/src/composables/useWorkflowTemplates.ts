/**
 * Workflow template library (Sprint 12).
 *
 * Templates are preset graphs with i18n keys instead of literals. This
 * composable loads them, filters by complexity, previews a graph without
 * persisting anything, and instantiates one into a new draft workflow.
 */
import { computed, ref } from 'vue';
import { useWorkflowStore } from '../stores/workflow';
import {
  TEMPLATE_SCENARIOS,
  instantiateTemplate,
  templateById,
  templatesByComplexity
} from '../lib/workflowTemplates';
import { summarizeDefinition } from '../lib/workflowGraph';
import type { DefinitionSummary } from '../lib/workflowGraph';
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowTemplate,
  WorkflowTemplateComplexity
} from '../types';

export type TemplateComplexityFilter = WorkflowTemplateComplexity | 'all';

export const TEMPLATE_COMPLEXITY_FILTERS: TemplateComplexityFilter[] = [
  'all',
  'simple',
  'medium',
  'complex'
];

export const TEMPLATE_SCENARIO_FILTERS: string[] = TEMPLATE_SCENARIOS;

/** Strips the shared key prefix so filters can be compared against the raw slug. */
export function scenarioSlug(scenarioKey: string): string {
  return scenarioKey.replace('workflow.template.scenario.', '');
}

export function useWorkflowTemplates() {
  const store = useWorkflowStore();

  const complexityFilter = ref<TemplateComplexityFilter>('all');
  const scenarioFilter = ref<string>('all');
  const previewId = ref<string | null>(null);

  const templates = computed(() => store.templates);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);

  /** Client-side narrowing; the library is small enough to filter in memory. */
  const visibleTemplates = computed(() =>
    templates.value.filter((template) => {
      if (complexityFilter.value !== 'all' && template.complexity !== complexityFilter.value) {
        return false;
      }
      if (scenarioFilter.value === 'all') return true;
      return scenarioSlug(template.scenarioKey) === scenarioFilter.value;
    })
  );

  const popularTemplates = computed(() =>
    [...templates.value].sort((a, b) => b.useCount - a.useCount)
  );

  const previewTemplate = computed<WorkflowTemplate | null>(() =>
    previewId.value ? (templateById(previewId.value) ?? null) : null
  );

  /** The graph a preview renders; instantiated fresh so ids never collide. */
  const previewDefinition = computed<WorkflowDefinition | null>(() =>
    previewTemplate.value ? instantiateTemplate(previewTemplate.value) : null
  );

  const previewSummary = computed<DefinitionSummary | null>(() =>
    previewDefinition.value ? summarizeDefinition(previewDefinition.value) : null
  );

  async function loadTemplates(): Promise<WorkflowTemplate[]> {
    return store.fetchTemplates();
  }

  /** Alias kept because the spec names this entry point refresh. */
  const refresh = loadTemplates;

  function filterComplexity(next: TemplateComplexityFilter): WorkflowTemplate[] {
    complexityFilter.value = next;
    return visibleTemplates.value;
  }

  function filterScenario(next: string): WorkflowTemplate[] {
    scenarioFilter.value = next;
    return visibleTemplates.value;
  }

  function byComplexity(complexity: WorkflowTemplateComplexity): WorkflowTemplate[] {
    return templatesByComplexity(complexity);
  }

  function openPreview(templateIdValue: string | null): void {
    previewId.value = templateIdValue;
  }

  function closePreview(): void {
    previewId.value = null;
  }

  /** Copies a preset onto the builder canvas without saving anything. */
  function previewOnCanvas(templateIdValue: string): WorkflowDefinition | null {
    const template = templateById(templateIdValue);
    if (!template) return null;
    return store.setDefinition(instantiateTemplate(template));
  }

  /** Instantiates into a persisted draft; the name is already translated. */
  async function useTemplate(templateIdValue: string, name: string): Promise<Workflow | null> {
    return store.createFromTemplate(templateIdValue, name);
  }

  return {
    templates,
    visibleTemplates,
    popularTemplates,
    previewTemplate,
    previewDefinition,
    previewSummary,
    previewId,
    complexityFilter,
    scenarioFilter,
    loading,
    saving,
    error,
    loadTemplates,
    refresh,
    filterComplexity,
    filterScenario,
    byComplexity,
    openPreview,
    closePreview,
    previewOnCanvas,
    useTemplate
  };
}
