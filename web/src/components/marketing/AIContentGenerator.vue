<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { useAIContent } from '../../composables/useAIContent';
import type { AIContentForm } from '../../composables/useAIContent';
import {
  CONTENT_LANGUAGES,
  CONTENT_LENGTHS,
  CONTENT_TONES,
  MARKETING_GOALS
} from '../../types';
import type { ContentLanguage, ContentLength, ContentTone, MarketingGoal } from '../../types';

const i18n = useI18nStore();
const {
  form,
  feedback,
  generating,
  lastError,
  cacheHit,
  content,
  canGenerate,
  canRefine,
  charCount,
  generate,
  regenerate,
  refine,
  update,
  scheduleGenerate
} = useAIContent();

const emit = defineEmits<{ (e: 'generated', id: string): void }>();

const hasDraft = computed(() => content.value !== null);
/** The empty-state hint only earns its space while the prompt is still blank. */
const showHint = computed(
  () => !hasDraft.value && lastError.value === null && form.value.prompt.trim().length === 0
);

async function onGenerate(): Promise<void> {
  const result = await generate();
  if (result) emit('generated', result.id);
}

async function onRegenerate(): Promise<void> {
  const result = await regenerate();
  if (result) emit('generated', result.id);
}

async function onRefine(): Promise<void> {
  const result = await refine();
  if (result) emit('generated', result.id);
}

function onPromptInput(event: Event): void {
  update({ prompt: (event.target as HTMLInputElement).value });
  scheduleGenerate();
}

function onField<K extends keyof AIContentForm>(field: K, value: AIContentForm[K]): void {
  update({ [field]: value } as Partial<AIContentForm>);
}
</script>

<template>
  <section class="ai-gen">
    <header class="ai-gen__head">
      <h2 class="ai-gen__title">{{ i18n.t('marketing.ai.title') }}</h2>
      <span v-if="hasDraft" class="ai-gen__chars">
        {{ i18n.t('marketing.ai.charHint', { n: charCount }) }}
      </span>
    </header>

    <div class="ai-gen__field">
      <label class="ai-gen__label" for="ai-prompt">{{ i18n.t('marketing.ai.prompt') }}</label>
      <textarea
        id="ai-prompt"
        class="ai-gen__textarea"
        rows="3"
        :value="form.prompt"
        :placeholder="i18n.t('marketing.ai.promptPlaceholder')"
        @input="onPromptInput"
      ></textarea>
    </div>

    <div class="ai-gen__field">
      <label class="ai-gen__label" for="ai-audience">{{ i18n.t('marketing.ai.audience') }}</label>
      <input
        id="ai-audience"
        class="ai-gen__input"
        :value="form.audience"
        :placeholder="i18n.t('marketing.ai.audiencePlaceholder')"
        @input="onField('audience', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="ai-gen__grid">
      <div class="ai-gen__field">
        <label class="ai-gen__label" for="ai-goal">{{ i18n.t('marketing.ai.goal') }}</label>
        <select
          id="ai-goal"
          class="ai-gen__select"
          :value="form.goal"
          @change="onField('goal', ($event.target as HTMLSelectElement).value as MarketingGoal)"
        >
          <option v-for="goal in MARKETING_GOALS" :key="goal" :value="goal">
            {{ i18n.t('marketing.goal.' + goal) }}
          </option>
        </select>
      </div>

      <div class="ai-gen__field">
        <label class="ai-gen__label" for="ai-language">{{ i18n.t('marketing.ai.language') }}</label>
        <select
          id="ai-language"
          class="ai-gen__select"
          :value="form.language"
          @change="onField('language', ($event.target as HTMLSelectElement).value as ContentLanguage)"
        >
          <option v-for="language in CONTENT_LANGUAGES" :key="language" :value="language">
            {{ i18n.t('marketing.language.' + language) }}
          </option>
        </select>
      </div>

      <div class="ai-gen__field">
        <label class="ai-gen__label" for="ai-tone">{{ i18n.t('marketing.ai.tone') }}</label>
        <select
          id="ai-tone"
          class="ai-gen__select"
          :value="form.tone"
          @change="onField('tone', ($event.target as HTMLSelectElement).value as ContentTone)"
        >
          <option v-for="tone in CONTENT_TONES" :key="tone" :value="tone">
            {{ i18n.t('marketing.tone.' + tone) }}
          </option>
        </select>
      </div>

      <div class="ai-gen__field">
        <label class="ai-gen__label" for="ai-length">{{ i18n.t('marketing.ai.length') }}</label>
        <select
          id="ai-length"
          class="ai-gen__select"
          :value="form.length"
          @change="onField('length', ($event.target as HTMLSelectElement).value as ContentLength)"
        >
          <option v-for="length in CONTENT_LENGTHS" :key="length" :value="length">
            {{ i18n.t('marketing.length.' + length) }}
          </option>
        </select>
      </div>
    </div>

    <div class="ai-gen__actions">
      <button
        class="ai-gen__btn ai-gen__btn--primary"
        type="button"
        :disabled="!canGenerate"
        @click="onGenerate"
      >
        {{ generating ? i18n.t('marketing.ai.generating') : i18n.t('marketing.ai.generate') }}
      </button>
      <button
        v-if="hasDraft"
        class="ai-gen__btn"
        type="button"
        :disabled="generating"
        @click="onRegenerate"
      >{{ i18n.t('marketing.ai.regenerate') }}</button>
    </div>

    <p v-if="cacheHit" class="ai-gen__notice ai-gen__notice--cache" role="status">
      <strong>{{ i18n.t('marketing.ai.cacheHit') }}</strong>
      {{ i18n.t('marketing.ai.cacheHint') }}
    </p>
    <p v-if="lastError" class="ai-gen__notice ai-gen__notice--error" role="alert">
      {{ i18n.t(lastError) }}
    </p>
    <p v-if="showHint" class="ai-gen__hint">{{ i18n.t('marketing.ai.empty') }}</p>

    <div v-if="hasDraft" class="ai-gen__refine">
      <label class="ai-gen__label" for="ai-feedback">{{ i18n.t('marketing.ai.refine') }}</label>
      <div class="ai-gen__refine-row">
        <input
          id="ai-feedback"
          class="ai-gen__input"
          :value="feedback"
          :placeholder="i18n.t('marketing.ai.refinePlaceholder')"
          @input="feedback = ($event.target as HTMLInputElement).value"
        />
        <button
          class="ai-gen__btn"
          type="button"
          :disabled="!canRefine"
          @click="onRefine"
        >{{ i18n.t('marketing.ai.refineAction') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-gen {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.ai-gen__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.ai-gen__title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.ai-gen__chars {
  margin-left: auto;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.ai-gen__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ai-gen__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.ai-gen__input,
.ai-gen__select,
.ai-gen__textarea {
  width: 100%;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-family: inherit;
  padding: 9px 12px;
  box-sizing: border-box;
}
.ai-gen__input,
.ai-gen__select {
  height: 40px;
}
.ai-gen__textarea {
  resize: vertical;
  line-height: 21px;
}
.ai-gen__input:focus-visible,
.ai-gen__select:focus-visible,
.ai-gen__textarea:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.ai-gen__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.ai-gen__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-gen__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.ai-gen__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.ai-gen__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ai-gen__btn--primary {
  border: none;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-weight: 700;
}
.ai-gen__btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
  background: var(--ks-grad-brand);
}
.ai-gen__notice {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--ks-radius-btn);
  font-size: 12px;
  line-height: 18px;
}
.ai-gen__notice--cache {
  color: var(--ks-primary-text);
  background: var(--ks-grad-soft);
  border: 1px solid var(--ks-primary-text);
}
.ai-gen__notice--error {
  color: var(--ks-error);
  background: rgba(180, 30, 30, 0.08);
  border: 1px solid rgba(180, 30, 30, 0.25);
}
.ai-gen__hint {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-tertiary);
}
.ai-gen__refine {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-gen__refine-row {
  display: flex;
  gap: 8px;
}
.ai-gen__refine-row .ai-gen__input {
  flex: 1;
  min-width: 0;
}
@media (max-width: 767px) {
  .ai-gen {
    padding: 14px;
  }
  .ai-gen__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .ai-gen__actions .ai-gen__btn {
    flex: 1;
  }
}
</style>
