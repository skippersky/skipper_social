/**
 * AI copy generation flow (Sprint 11).
 *
 * Wraps the marketing store with the three actions the generator offers:
 * generate, regenerate and refine. Two rules matter here. First, an in-flight
 * lock: a double-click or a fast keystroke sequence shares one request instead
 * of stacking calls against the model. Second, the Sprint 0 semantic cache is
 * visible to the user - regenerating with identical inputs returns the same
 * draft, which is the cache working, not the UI being stuck.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { useMarketingStore } from '../stores/marketing';
import { isContentSendable, summarizeContent } from '../lib/marketingContent';
import type {
  AIContentRequest,
  ContentLanguage,
  ContentLength,
  ContentTone,
  MarketingContent,
  MarketingGoal,
  MarketingTemplate
} from '../types';

export interface AIContentForm {
  prompt: string;
  goal: MarketingGoal;
  audience: string;
  language: ContentLanguage;
  tone: ContentTone;
  length: ContentLength;
}

export const DEFAULT_AI_FORM: AIContentForm = {
  prompt: '',
  goal: 'promotion',
  audience: '',
  language: 'en',
  tone: 'friendly',
  length: 'standard'
};

/** Auto-generate waits this long after the last keystroke. */
export const GENERATE_DEBOUNCE_MS = 400;

export function useAIContent() {
  const store = useMarketingStore();
  const form = ref<AIContentForm>({ ...DEFAULT_AI_FORM });
  const feedback = ref('');
  const generating = ref(false);
  const lastError = ref<string | null>(null);
  /** True when the last result came back identical, i.e. the semantic cache hit. */
  const cacheHit = ref(false);

  let inFlight: Promise<MarketingContent | null> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const content = computed(() => store.generatedContent);
  const previews = computed(() => store.previews);
  const canGenerate = computed(() => form.value.prompt.trim().length > 0 && !generating.value);
  const canRefine = computed(
    () => content.value !== null && feedback.value.trim().length > 0 && !generating.value
  );
  const summary = computed(() => (content.value ? summarizeContent(content.value) : ''));
  const sendable = computed(() => isContentSendable(content.value));
  const charCount = computed(() => content.value?.body.length ?? 0);

  function toRequest(withFeedback: boolean): AIContentRequest {
    const request: AIContentRequest = {
      prompt: form.value.prompt.trim(),
      goal: form.value.goal,
      audience: form.value.audience.trim(),
      language: form.value.language,
      tone: form.value.tone,
      length: form.value.length
    };
    if (withFeedback) {
      request.feedback = feedback.value.trim();
      request.sourceId = content.value?.id;
    } else if (content.value) {
      request.sourceId = content.value.id;
    }
    return request;
  }

  /** One request at a time; concurrent callers receive the same promise. */
  async function run(request: AIContentRequest): Promise<MarketingContent | null> {
    if (inFlight) return inFlight;
    const previousId = content.value?.id ?? null;
    generating.value = true;
    lastError.value = null;
    cacheHit.value = false;
    inFlight = store
      .generateContent(request)
      .then((result) => {
        if (!result) {
          lastError.value = store.error;
          return null;
        }
        cacheHit.value = previousId !== null && result.id === previousId && !request.feedback;
        return result;
      })
      .finally(() => {
        generating.value = false;
        inFlight = null;
      });
    return inFlight;
  }

  async function generate(): Promise<MarketingContent | null> {
    return run(toRequest(false));
  }

  /** Same inputs, so a hit here is the semantic cache doing its job. */
  async function regenerate(): Promise<MarketingContent | null> {
    return run(toRequest(false));
  }

  async function refine(text?: string): Promise<MarketingContent | null> {
    if (text !== undefined) feedback.value = text;
    if (!content.value || !feedback.value.trim()) return null;
    const result = await run(toRequest(true));
    if (result) feedback.value = '';
    return result;
  }

  function update(patch: Partial<AIContentForm>): void {
    form.value = { ...form.value, ...patch };
  }

  /** Debounced generate for the "write as I type" affordance. */
  function scheduleGenerate(): void {
    cancelScheduled();
    if (!canGenerate.value) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void generate();
    }, GENERATE_DEBOUNCE_MS);
  }

  function cancelScheduled(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  /** Edits made in the textarea flow back so previews and validation follow. */
  function updateContent(patch: Partial<MarketingContent>): void {
    if (!content.value) return;
    store.setContent({ ...content.value, ...patch });
  }

  /** A template becomes an editable draft with the same goal and language. */
  function applyTemplate(template: MarketingTemplate): MarketingContent {
    const draft: MarketingContent = {
      id: 'tpl-' + template.id,
      title: template.title,
      body: template.content,
      cta: template.cta,
      imageSuggestion: '',
      hashtags: [],
      goal: template.category,
      language: form.value.language,
      tone: form.value.tone,
      length: form.value.length,
      createdAt: Date.now()
    };
    form.value = { ...form.value, goal: template.category, prompt: template.title };
    store.setContent(draft);
    void store.useTemplate(template.id);
    return draft;
  }

  function clear(): void {
    cancelScheduled();
    feedback.value = '';
    cacheHit.value = false;
    lastError.value = null;
    store.clearContent();
  }

  onBeforeUnmount(cancelScheduled);

  return {
    form,
    feedback,
    generating,
    lastError,
    cacheHit,
    content,
    previews,
    canGenerate,
    canRefine,
    summary,
    sendable,
    charCount,
    toRequest,
    generate,
    regenerate,
    refine,
    update,
    scheduleGenerate,
    cancelScheduled,
    updateContent,
    applyTemplate,
    clear
  };
}
