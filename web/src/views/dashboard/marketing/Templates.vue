<script setup lang="ts">
/**
 * Template library (Sprint 11).
 *
 * Browsing, filtering and CRUD for reusable marketing copy. Search runs
 * client-side over the fetched list (small by design) while every mutation goes
 * through useTemplates -> store -> api, so the demo fallback and the real
 * backend behave identically. "Use" hands the template to the AI composable and
 * opens the campaign wizard with the copy already loaded.
 */
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import TemplateCard from '../../../components/marketing/TemplateCard.vue';
import { TEMPLATE_CATEGORIES, useTemplates } from '../../../composables/useTemplates';
import { useAIContent } from '../../../composables/useAIContent';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import type { MarketingTemplate, TemplateCategory, TemplateInput } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();

usePageMeta(i18n.t('marketing.templates.title'), i18n.t('marketing.templates.subtitle'));

const {
  templates,
  filtered,
  loading,
  saving,
  error,
  query,
  category,
  dialogOpen,
  draft,
  errors,
  isEditing,
  canSave,
  limits,
  refresh,
  filterByCategory,
  openCreate,
  openEdit,
  closeDialog,
  updateDraft,
  validate,
  save,
  remove
} = useTemplates();

const { applyTemplate } = useAIContent();

const categories = TEMPLATE_CATEGORIES;
const dialogTitle = computed(() =>
  isEditing.value ? i18n.t('marketing.templates.edit') : i18n.t('marketing.templates.new')
);
const goals = computed(() => categories.filter((item) => item !== 'all'));

function categoryLabel(value: TemplateCategory | 'all'): string {
  return value === 'all'
    ? i18n.t('marketing.templates.categoryAll')
    : i18n.t('marketing.goal.' + value);
}
function textOf(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
function errorText(field: keyof TemplateInput): string {
  const key = errors.value[field];
  return key ? i18n.t(key) : '';
}

async function onSave(): Promise<void> {
  const wasEditing = isEditing.value;
  const saved = await save();
  if (!saved) return;
  showToast(
    i18n.t(wasEditing ? 'marketing.templates.updatedToast' : 'marketing.templates.savedToast')
  );
}

async function onUse(templateId: string): Promise<void> {
  const template: MarketingTemplate | undefined = templates.value.find(
    (item) => item.id === templateId
  );
  if (!template) return;
  applyTemplate(template);
  showToast(i18n.t('marketing.templates.appliedToast'));
  void router.push('/dashboard/marketing/create');
}

function onEdit(templateId: string): void {
  const template = templates.value.find((item) => item.id === templateId);
  if (template) openEdit(template);
}

async function onDelete(templateId: string): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('marketing.templates.deleteTitle'),
      message: i18n.t('marketing.templates.deleteText'),
      confirmButtonText: i18n.t('marketing.templates.delete'),
      cancelButtonText: i18n.t('common.cancel')
    });
  } catch {
    return;
  }
  if (await remove(templateId)) showToast(i18n.t('marketing.templates.deletedToast'));
}

watch(error, (value) => {
  if (value) showToast(i18n.t(value));
});

onMounted(() => {
  void refresh();
});
</script>

<template>
  <section class="tpl">
    <header class="tpl__top">
      <button
        class="tpl__home"
        type="button"
        :aria-label="i18n.t('marketing.detail.backToList')"
        @click="router.push('/dashboard/marketing')"
      >&larr;</button>
      <div class="tpl__heading">
        <h1 class="tpl__title">{{ i18n.t('marketing.templates.title') }}</h1>
        <p class="tpl__subtitle">{{ i18n.t('marketing.templates.subtitle') }}</p>
      </div>
      <button class="tpl__btn is-primary" type="button" @click="openCreate()">
        {{ i18n.t('marketing.templates.new') }}
      </button>
    </header>

    <div class="tpl__toolbar">
      <label class="tpl__search">
        <span class="tpl__sr-only">{{ i18n.t('marketing.templates.searchPlaceholder') }}</span>
        <input
          v-model="query"
          class="tpl__input"
          type="search"
          :placeholder="i18n.t('marketing.templates.searchPlaceholder')"
        />
      </label>
      <span class="tpl__count">
        {{ i18n.t('marketing.templates.count', { n: filtered.length }) }}
      </span>
    </div>

    <div class="tpl__tabs" role="tablist">
      <button
        v-for="item in categories"
        :key="item"
        class="tpl__tab"
        :class="{ 'is-active': category === item }"
        type="button"
        role="tab"
        :aria-selected="category === item"
        @click="filterByCategory(item)"
      >
        {{ categoryLabel(item) }}
      </button>
    </div>

    <p v-if="error" class="tpl__error">{{ i18n.t(error) }}</p>

    <div v-if="filtered.length > 0" class="tpl__grid">
      <TemplateCard
        v-for="item in filtered"
        :key="item.id"
        :item="item"
        @use="onUse"
        @edit="onEdit"
        @delete="onDelete"
      />
    </div>

    <div v-else-if="!loading" class="tpl__empty">
      <h2 class="tpl__empty-title">{{ i18n.t('marketing.templates.empty') }}</h2>
      <button class="tpl__btn is-primary" type="button" @click="openCreate()">
        {{ i18n.t('marketing.templates.new') }}
      </button>
    </div>

    <p v-else class="tpl__loading">{{ i18n.t('common.loading') }}</p>

    <div
      v-if="dialogOpen"
      class="tpl-overlay"
      role="dialog"
      aria-modal="true"
      @click.self="closeDialog"
    >
      <form class="tpl-dialog" @submit.prevent="onSave">
        <header class="tpl-dialog__head">
          <h2 class="tpl-dialog__title">{{ dialogTitle }}</h2>
          <button
            class="tpl-dialog__close"
            type="button"
            :aria-label="i18n.t('common.close')"
            @click="closeDialog"
          >&times;</button>
        </header>

        <label class="tpl-field">
          <span class="tpl-field__label">{{ i18n.t('marketing.templates.name') }}</span>
          <input
            class="tpl-field__input"
            :class="{ 'is-invalid': errors.name }"
            type="text"
            :value="draft.name"
            :maxlength="limits.name"
            @input="updateDraft({ name: textOf($event) })"
          />
          <span v-if="errors.name" class="tpl-field__error">{{ errorText('name') }}</span>
          <span v-else class="tpl-field__hint">
            {{ i18n.t('marketing.templates.limitName', { n: limits.name }) }}
          </span>
        </label>

        <label class="tpl-field">
          <span class="tpl-field__label">{{ i18n.t('marketing.templates.category') }}</span>
          <select
            class="tpl-field__input"
            :value="draft.category"
            @change="updateDraft({ category: textOf($event) as TemplateCategory })"
          >
            <option v-for="goal in goals" :key="goal" :value="goal">
              {{ categoryLabel(goal) }}
            </option>
          </select>
        </label>

        <label class="tpl-field">
          <span class="tpl-field__label">{{ i18n.t('marketing.templates.bodyTitle') }}</span>
          <input
            class="tpl-field__input"
            :class="{ 'is-invalid': errors.title }"
            type="text"
            :value="draft.title"
            :maxlength="limits.title"
            @input="updateDraft({ title: textOf($event) })"
          />
          <span v-if="errors.title" class="tpl-field__error">{{ errorText('title') }}</span>
        </label>

        <label class="tpl-field">
          <span class="tpl-field__label">{{ i18n.t('marketing.templates.body') }}</span>
          <textarea
            class="tpl-field__input tpl-field__textarea"
            :class="{ 'is-invalid': errors.content }"
            rows="6"
            :value="draft.content"
            @input="updateDraft({ content: textOf($event) })"
          ></textarea>
          <span v-if="errors.content" class="tpl-field__error">{{ errorText('content') }}</span>
          <span v-else class="tpl-field__hint">
            {{ i18n.t('marketing.templates.limitBody', { n: limits.body }) }}
          </span>
        </label>

        <label class="tpl-field">
          <span class="tpl-field__label">{{ i18n.t('marketing.templates.cta') }}</span>
          <input
            class="tpl-field__input"
            type="text"
            :value="draft.cta"
            @input="updateDraft({ cta: textOf($event) })"
          />
        </label>

        <footer class="tpl-dialog__actions">
          <button class="tpl__btn" type="button" @click="closeDialog">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            class="tpl__btn is-primary"
            type="submit"
            :disabled="saving || !canSave"
            @click="validate"
          >
            {{ i18n.t('common.save') }}
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>

<style scoped>
.tpl {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  box-sizing: border-box;
}
.tpl__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.tpl__home {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.tpl__home:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.tpl__heading {
  flex: 1 1 260px;
  min-width: 0;
}
.tpl__title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--ks-text-primary);
}
.tpl__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--ks-text-tertiary);
}
.tpl__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.tpl__search {
  display: flex;
  flex: 1 1 320px;
  min-width: 0;
}
.tpl__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.tpl__input {
  flex: 1;
  min-width: 160px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.tpl__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.tpl__count {
  font-size: 12px;
  color: var(--ks-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.tpl__tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.tpl__tab {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease),
    color var(--ks-motion-fast) var(--ks-ease);
}
.tpl__tab:hover {
  color: var(--ks-text-primary);
}
.tpl__tab.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.tpl__tab:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.tpl__error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--ks-error);
  border-radius: var(--ks-radius-btn);
  color: var(--ks-error);
  font-size: 13px;
}
.tpl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.tpl__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  text-align: center;
}
.tpl__empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tpl__loading {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.tpl__btn {
  height: 38px;
  padding: 0 16px;
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
.tpl__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.tpl__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tpl__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.tpl__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tpl__btn.is-primary:hover:not(:disabled) {
  filter: brightness(1.04);
}
.tpl-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(23 16 12 / 52%);
  backdrop-filter: blur(2px);
}
.tpl-dialog {
  width: 100%;
  max-width: 560px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-float);
  box-sizing: border-box;
}
.tpl-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tpl-dialog__title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tpl-dialog__close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.tpl-dialog__close:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.tpl-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--ks-border-default);
}
.tpl-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tpl-field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.tpl-field__input {
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.tpl-field__textarea {
  resize: vertical;
  line-height: 20px;
}
.tpl-field__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.tpl-field__input.is-invalid {
  border-color: var(--ks-error);
}
.tpl-field__error {
  font-size: 12px;
  color: var(--ks-error);
}
.tpl-field__hint {
  font-size: 11px;
  color: var(--ks-text-tertiary);
}

@media (max-width: 767px) {
  .tpl {
    padding: 16px 12px 40px;
  }
  .tpl__title {
    font-size: 20px;
    line-height: 26px;
  }
  .tpl__top .tpl__btn.is-primary {
    flex: 1 1 auto;
  }
  .tpl__search {
    flex: 1 1 100%;
  }
  .tpl__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .tpl__tab {
    flex: 1 1 auto;
  }
  .tpl-dialog__actions .tpl__btn {
    flex: 1 1 auto;
  }
}
</style>
