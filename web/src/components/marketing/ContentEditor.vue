<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { isContentSendable } from '../../lib/marketingContent';
import type { MarketingContent } from '../../types';

const props = defineProps<{ content: MarketingContent | null }>();

const emit = defineEmits<{
  (e: 'update', patch: Partial<MarketingContent>): void;
  (e: 'clear'): void;
}>();

const i18n = useI18nStore();

const sendable = computed(() => isContentSendable(props.content));
const hashtags = computed(() => (props.content?.hashtags ?? []).join(' '));

function patch(field: keyof MarketingContent, value: string): void {
  emit('update', { [field]: value } as Partial<MarketingContent>);
}

/** Hashtags are typed as a single string and split on whitespace. */
function onHashtags(event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  const list = raw
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  emit('update', { hashtags: list });
}
</script>

<template>
  <section v-if="content" class="c-edit">
    <header class="c-edit__head">
      <h2 class="c-edit__title">{{ i18n.t('marketing.editor.title') }}</h2>
      <span class="c-edit__badge" :class="sendable ? 'is-ok' : 'is-bad'">
        {{ sendable ? i18n.t('marketing.editor.sendable') : i18n.t('marketing.editor.notSendable') }}
      </span>
    </header>

    <div class="c-edit__field">
      <label class="c-edit__label" for="ce-title">{{ i18n.t('marketing.editor.bodyTitle') }}</label>
      <input
        id="ce-title"
        class="c-edit__input"
        :value="content.title"
        @input="patch('title', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="c-edit__field">
      <label class="c-edit__label" for="ce-body">{{ i18n.t('marketing.editor.body') }}</label>
      <textarea
        id="ce-body"
        class="c-edit__textarea"
        rows="6"
        :value="content.body"
        @input="patch('body', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

    <div class="c-edit__grid">
      <div class="c-edit__field">
        <label class="c-edit__label" for="ce-cta">{{ i18n.t('marketing.editor.cta') }}</label>
        <input
          id="ce-cta"
          class="c-edit__input"
          :value="content.cta"
          @input="patch('cta', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="c-edit__field">
        <label class="c-edit__label" for="ce-tags">{{ i18n.t('marketing.editor.hashtags') }}</label>
        <input
          id="ce-tags"
          class="c-edit__input"
          :value="hashtags"
          @input="onHashtags"
        />
      </div>
    </div>

    <p v-if="content.imageSuggestion" class="c-edit__image">
      <span class="c-edit__label">{{ i18n.t('marketing.editor.imageSuggestion') }}</span>
      {{ content.imageSuggestion }}
    </p>

    <div class="c-edit__actions">
      <button class="c-edit__btn" type="button" @click="emit('clear')">
        {{ i18n.t('marketing.editor.clear') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.c-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.c-edit__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.c-edit__title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.c-edit__badge {
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.c-edit__badge.is-ok {
  color: var(--ks-success);
  background: rgba(22, 101, 52, 0.1);
  border: 1px solid rgba(22, 101, 52, 0.25);
}
.c-edit__badge.is-bad {
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid rgba(180, 83, 9, 0.2);
}
.c-edit__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.c-edit__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.c-edit__input,
.c-edit__textarea {
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
.c-edit__input {
  height: 40px;
}
.c-edit__textarea {
  resize: vertical;
  line-height: 21px;
}
.c-edit__input:focus-visible,
.c-edit__textarea:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.c-edit__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.c-edit__image {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-secondary);
  background: var(--ks-bg-muted);
  border-radius: var(--ks-radius-btn);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.c-edit__actions {
  display: flex;
  justify-content: flex-end;
}
.c-edit__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.c-edit__btn:hover {
  background: var(--ks-bg-muted);
}
@media (max-width: 767px) {
  .c-edit {
    padding: 14px;
  }
  .c-edit__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
