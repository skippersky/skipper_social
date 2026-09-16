/**
 * Template library browsing and editing (Sprint 11).
 *
 * Search and category filtering run client-side over the fetched list, which
 * is small by design; the store stays the only place that talks to the api.
 * Validation reuses lib/marketingValidation so the dialog and the wizard agree
 * on what a template may look like.
 */
import { computed, ref } from 'vue';
import { useMarketingStore } from '../stores/marketing';
import {
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  TEMPLATE_TITLE_MAX,
  isTemplateValid,
  validateTemplateForm
} from '../lib/marketingValidation';
import type { ValidationErrors } from '../lib/marketingValidation';
import type { MarketingTemplate, TemplateCategory, TemplateInput } from '../types';
import { MARKETING_GOALS } from '../types';

export const TEMPLATE_CATEGORIES: Array<TemplateCategory | 'all'> = ['all', ...MARKETING_GOALS];

export const EMPTY_TEMPLATE: TemplateInput = {
  name: '',
  category: 'promotion',
  title: '',
  content: '',
  cta: ''
};

export function useTemplates() {
  const store = useMarketingStore();
  const query = ref('');
  const category = ref<TemplateCategory | 'all'>('all');
  const dialogOpen = ref(false);
  const editing = ref<MarketingTemplate | null>(null);
  const draft = ref<TemplateInput>({ ...EMPTY_TEMPLATE });
  const errors = ref<ValidationErrors>({});

  const templates = computed(() => store.templates);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);

  const filtered = computed(() => {
    const text = query.value.trim().toLowerCase();
    return templates.value.filter((item) => {
      if (category.value !== 'all' && item.category !== category.value) return false;
      if (!text) return true;
      return (item.name + ' ' + item.title + ' ' + item.content).toLowerCase().includes(text);
    });
  });

  const isEditing = computed(() => editing.value !== null);
  const canSave = computed(() => isTemplateValid(draft.value));

  async function refresh(next?: TemplateCategory | 'all'): Promise<MarketingTemplate[]> {
    if (next !== undefined) category.value = next;
    return store.fetchTemplates(category.value === 'all' ? undefined : category.value);
  }

  function search(text: string): void {
    query.value = text;
  }

  function filterByCategory(next: TemplateCategory | 'all'): void {
    category.value = next;
  }

  function openCreate(preset?: Partial<TemplateInput>): void {
    editing.value = null;
    draft.value = { ...EMPTY_TEMPLATE, ...(preset ?? {}) };
    errors.value = {};
    dialogOpen.value = true;
  }

  function openEdit(template: MarketingTemplate): void {
    editing.value = template;
    draft.value = {
      name: template.name,
      category: template.category,
      title: template.title,
      content: template.content,
      cta: template.cta
    };
    errors.value = {};
    dialogOpen.value = true;
  }

  function closeDialog(): void {
    dialogOpen.value = false;
    editing.value = null;
    errors.value = {};
  }

  function updateDraft(patch: Partial<TemplateInput>): void {
    draft.value = { ...draft.value, ...patch };
    if (Object.keys(errors.value).length > 0) errors.value = validateTemplateForm(draft.value);
  }

  function validate(): ValidationErrors {
    errors.value = validateTemplateForm(draft.value);
    return errors.value;
  }

  async function save(): Promise<MarketingTemplate | null> {
    if (Object.keys(validate()).length > 0) return null;
    const saved = editing.value
      ? await store.updateTemplate(editing.value.id, draft.value)
      : await store.createTemplate(draft.value);
    if (saved) closeDialog();
    return saved;
  }

  async function remove(templateId: string): Promise<boolean> {
    return store.deleteTemplate(templateId);
  }

  return {
    templates,
    filtered,
    loading,
    saving,
    error,
    query,
    category,
    dialogOpen,
    editing,
    draft,
    errors,
    isEditing,
    canSave,
    limits: {
      name: TEMPLATE_NAME_MAX,
      title: TEMPLATE_TITLE_MAX,
      body: TEMPLATE_BODY_MAX
    },
    refresh,
    search,
    filterByCategory,
    openCreate,
    openEdit,
    closeDialog,
    updateDraft,
    validate,
    save,
    remove
  };
}
