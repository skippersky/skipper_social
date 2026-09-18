<script setup lang="ts">
/**
 * Workflow template library (Sprint 12).
 *
 * Two ways in, because they answer different questions. "Use this template"
 * drops the preset straight onto the builder canvas and navigates there, which
 * is what someone who already knows what they want expects. "Preview" opens a
 * read only dialog with the graph, its shape summary and a name field, for the
 * visitor who wants to see the branches before committing to a draft. Nothing
 * here writes to the backend until a draft is actually created.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import TemplateCard from '../../../components/workflow/TemplateCard.vue';
import WorkflowCanvas from '../../../components/workflow/WorkflowCanvas.vue';
import {
  TEMPLATE_COMPLEXITY_FILTERS,
  TEMPLATE_SCENARIO_FILTERS,
  scenarioSlug,
  useWorkflowTemplates
} from '../../../composables/useWorkflowTemplates';
import type { TemplateComplexityFilter } from '../../../composables/useWorkflowTemplates';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import { emptyDefinition } from '../../../lib/workflowGraph';
import type { WorkflowTemplate } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();

usePageMeta(
  i18n.t('workflow.templates.metaTitle'),
  i18n.t('workflow.templates.metaDescription')
);

const {
  templates,
  visibleTemplates,
  popularTemplates,
  previewTemplate,
  previewDefinition,
  previewSummary,
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
} = useWorkflowTemplates();

const complexities = TEMPLATE_COMPLEXITY_FILTERS;
const scenarios = TEMPLATE_SCENARIO_FILTERS;

/** Popular is a sort, not a filter: it reorders whatever is already narrowed. */
const popularOnly = ref(false);
const nameText = ref('');
const isMobile = ref(false);

const variant = computed<'graph' | 'list'>(() => (isMobile.value ? 'list' : 'graph'));

const cards = computed<WorkflowTemplate[]>(() => {
  if (!popularOnly.value) return visibleTemplates.value;
  const allowed = new Set(visibleTemplates.value.map((item) => item.id));
  return popularTemplates.value.filter((item) => allowed.has(item.id));
});

const previewDef = computed(() => previewDefinition.value ?? emptyDefinition());
const dialogOpen = computed(() => previewTemplate.value !== null);

function syncViewport(): void {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 1024;
}

function complexityLabel(item: TemplateComplexityFilter): string {
  return item === 'all' ? i18n.t('workflow.filterAll') : i18n.t('workflow.complexity.' + item);
}

function tabCount(item: TemplateComplexityFilter): number {
  return item === 'all' ? templates.value.length : byComplexity(item).length;
}

function scenarioLabel(key: string): string {
  return key === 'all' ? i18n.t('workflow.templates.scenarioAll') : i18n.t(key);
}

function onComplexity(next: TemplateComplexityFilter): void {
  filterComplexity(next);
}

function onScenario(event: Event): void {
  const target = event.target as HTMLSelectElement | null;
  filterScenario(target ? target.value : 'all');
}

function onPopular(): void {
  popularOnly.value = !popularOnly.value;
}

function onPreview(id: string): void {
  const template = templates.value.find((item) => item.id === id);
  openPreview(id);
  nameText.value = template ? i18n.t(template.nameKey) : '';
}

/** Fast path: stage the preset on the shared canvas and open the builder. */
async function onUse(id: string): Promise<void> {
  const staged = previewOnCanvas(id);
  if (!staged) return;
  showToast(i18n.t('workflow.templates.canvasToast'));
  await router.push('/dashboard/workflows/builder');
}

function onClosePreview(): void {
  closePreview();
  nameText.value = '';
}

async function onCreate(): Promise<void> {
  const template = previewTemplate.value;
  if (!template) return;
  const name = nameText.value.trim();
  if (name === '') {
    showToast(i18n.t('common.required'));
    return;
  }
  const created = await useTemplate(template.id, name);
  if (!created) return;
  showToast(i18n.t('workflow.templates.createdToast'));
  onClosePreview();
  await router.push({ path: '/dashboard/workflows/builder', query: { id: created.id } });
}

async function onRetry(): Promise<void> {
  await refresh();
}

onMounted(async () => {
  syncViewport();
  if (typeof window !== 'undefined') window.addEventListener('resize', syncViewport);
  await loadTemplates();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', syncViewport);
});
</script>

<template>
  <section class="wft">
    <header class="wft__top">
      <button
        class="wft__home"
        type="button"
        :aria-label="i18n.t('workflow.backToList')"
        @click="router.push('/dashboard/workflows')"
      >&larr;</button>
      <div class="wft__heading">
        <h1 class="wft__title">{{ i18n.t('workflow.templates.title') }}</h1>
        <p class="wft__subtitle">{{ i18n.t('workflow.templates.subtitle') }}</p>
      </div>
    </header>

    <div class="wft__filters">
      <div
        class="wft__tabs"
        role="tablist"
        :aria-label="i18n.t('workflow.templates.filterComplexity')"
      >
        <button
          v-for="item in complexities"
          :key="item"
          class="wft__tab"
          :class="{ 'is-active': complexityFilter === item }"
          type="button"
          role="tab"
          :aria-selected="complexityFilter === item"
          @click="onComplexity(item)"
        >
          {{ complexityLabel(item) }}
          <span class="wft__tab-count">{{ tabCount(item) }}</span>
        </button>
      </div>
      <div class="wft__side">
        <label class="wft__field">
          <span class="wft__sr-only">{{ i18n.t('workflow.templates.filterScenario') }}</span>
          <select class="wft__select" :value="scenarioFilter" @change="onScenario">
            <option value="all">{{ i18n.t('workflow.templates.scenarioAll') }}</option>
            <option v-for="key in scenarios" :key="key" :value="scenarioSlug(key)">
              {{ scenarioLabel(key) }}
            </option>
          </select>
        </label>
        <button
          class="wft__btn"
          type="button"
          :class="{ 'is-active': popularOnly }"
          :aria-pressed="popularOnly"
          @click="onPopular"
        >{{ i18n.t('workflow.templates.popular') }}</button>
        <button class="wft__btn is-ghost" type="button" :disabled="loading" @click="onRetry">
          {{ i18n.t('common.retry') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="wft__error">
      <strong>{{ i18n.t('workflow.error') }}</strong>
      <span>{{ i18n.t(error) }}</span>
      <button class="wft__btn" type="button" @click="onRetry">
        {{ i18n.t('common.retry') }}
      </button>
    </div>

    <div v-if="cards.length > 0" class="wft__grid">
      <TemplateCard
        v-for="item in cards"
        :key="item.id"
        :template="item"
        :active="previewTemplate?.id === item.id"
        @preview="onPreview"
        @use="onUse"
      />
    </div>

    <p v-else-if="!loading" class="wft__empty">{{ i18n.t('workflow.templates.empty') }}</p>
    <p v-else class="wft__empty">{{ i18n.t('common.loading') }}</p>

    <div
      v-if="dialogOpen && previewTemplate"
      class="wft__overlay"
      role="dialog"
      :aria-label="i18n.t('workflow.templates.previewTitle')"
      @click.self="onClosePreview"
    >
      <div class="wft__dialog">
        <header class="wft__dialog-head">
          <div class="wft__dialog-heading">
            <h2 class="wft__dialog-title">{{ i18n.t(previewTemplate.nameKey) }}</h2>
            <p class="wft__dialog-sub">{{ i18n.t('workflow.templates.previewTitle') }}</p>
          </div>
          <button
            class="wft__btn is-ghost"
            type="button"
            :aria-label="i18n.t('workflow.templates.closePreview')"
            @click="onClosePreview"
          >{{ i18n.t('common.close') }}</button>
        </header>

        <p class="wft__dialog-desc">{{ i18n.t(previewTemplate.descriptionKey) }}</p>

        <dl v-if="previewSummary" class="wft__summary">
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.nodes') }}</dt>
            <dd>{{ previewSummary.nodes }}</dd>
          </div>
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.triggers') }}</dt>
            <dd>{{ previewSummary.triggers }}</dd>
          </div>
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.conditions') }}</dt>
            <dd>{{ previewSummary.conditions }}</dd>
          </div>
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.actions') }}</dt>
            <dd>{{ previewSummary.actions }}</dd>
          </div>
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.edges') }}</dt>
            <dd>{{ previewSummary.edges }}</dd>
          </div>
          <div class="wft__summary-item">
            <dt>{{ i18n.t('workflow.detail.depth') }}</dt>
            <dd>{{ previewSummary.depth }}</dd>
          </div>
        </dl>

        <div class="wft__canvas">
          <WorkflowCanvas :definition="previewDef" :variant="variant" readonly />
        </div>

        <label class="wft__field wft__field--block">
          <span class="wft__label">{{ i18n.t('workflow.templates.nameLabel') }}</span>
          <input
            v-model="nameText"
            class="wft__input"
            type="text"
            :placeholder="i18n.t('workflow.templates.namePlaceholder')"
          />
        </label>

        <footer class="wft__dialog-actions">
          <button class="wft__btn" type="button" @click="onClosePreview">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            class="wft__btn"
            type="button"
            :disabled="saving"
            @click="onUse(previewTemplate.id)"
          >{{ i18n.t('workflow.templates.onCanvas') }}</button>
          <button
            class="wft__btn is-primary"
            type="button"
            :disabled="saving || nameText.trim() === ''"
            @click="onCreate"
          >{{ i18n.t('workflow.templates.create') }}</button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wft {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}
.wft__top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.wft__home {
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.wft__home:hover {
  border-color: var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.wft__heading {
  flex: 1 1 auto;
  min-width: 0;
}
.wft__title {
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}
.wft__subtitle {
  margin: 6px 0 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 19px;
}
.wft__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wft__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.wft__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-base);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease), background var(--ks-motion-fast) var(--ks-ease);
}
.wft__tab:hover {
  border-color: var(--ks-border-strong);
  color: var(--ks-text-primary);
}
.wft__tab.is-active {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wft__tab-count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.wft__tab.is-active .wft__tab-count {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
}
.wft__side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.wft__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wft__field--block {
  width: 100%;
}
.wft__label {
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.wft__select,
.wft__input {
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  line-height: 18px;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.wft__select:focus-visible,
.wft__input:focus-visible {
  border-color: var(--ks-primary);
  box-shadow: 0 0 0 3px var(--ks-grad-soft);
  outline: none;
}
.wft__btn {
  padding: 8px 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    background var(--ks-motion-fast) var(--ks-ease), opacity var(--ks-motion-fast) var(--ks-ease);
}
.wft__btn:hover:not(:disabled) {
  border-color: var(--ks-border-strong);
}
.wft__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wft__btn.is-active {
  border-color: var(--ks-primary);
  color: var(--ks-primary-text);
}
.wft__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wft__btn.is-ghost {
  background: transparent;
}
.wft__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.wft__error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--ks-border-default);
  border-left: 3px solid var(--ks-error);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 13px;
}
.wft__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.wft__empty {
  margin: 0;
  padding: 48px 16px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  color: var(--ks-text-tertiary);
  font-size: 14px;
  text-align: center;
}
.wft__overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--ks-bg-base);
  background: rgba(0, 0, 0, 0.45);
  overflow-y: auto;
}
.wft__dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 900px;
  padding: 20px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-float);
}
.wft__dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.wft__dialog-heading {
  min-width: 0;
}
.wft__dialog-title {
  margin: 0;
  color: var(--ks-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 25px;
}
.wft__dialog-sub {
  margin: 4px 0 0;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
.wft__dialog-desc {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.wft__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 1px;
  margin: 0;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-border-default);
  overflow: hidden;
}
.wft__summary-item {
  padding: 10px 12px;
  background: var(--ks-bg-base);
}
.wft__summary-item dt {
  color: var(--ks-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.wft__summary-item dd {
  margin: 4px 0 0;
  color: var(--ks-text-primary);
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.wft__canvas {
  min-height: 260px;
  padding: 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
}
.wft__dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 1023px) {
  .wft {
    padding: 16px 16px 32px;
  }
  .wft__filters {
    align-items: stretch;
    flex-direction: column;
  }
  .wft__side {
    width: 100%;
  }
  .wft__select,
  .wft__input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
  .wft__overlay {
    padding: 12px;
  }
  .wft__dialog {
    padding: 16px;
  }
}
@media (max-width: 767px) {
  .wft__title {
    font-size: 19px;
    line-height: 26px;
  }
  .wft__grid {
    grid-template-columns: 1fr;
  }
  .wft__tab {
    flex: 1 1 auto;
    justify-content: center;
  }
  .wft__btn {
    flex: 1 1 auto;
  }
  .wft__dialog-actions .wft__btn {
    flex: 1 1 100%;
  }
}
</style>
