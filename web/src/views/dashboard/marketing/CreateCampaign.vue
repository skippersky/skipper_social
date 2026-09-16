<script setup lang="ts">
/**
 * Three-step campaign wizard (Sprint 11).
 *
 * Content, audience, delivery - in that order, because each step constrains the
 * next: the channel choice in step three narrows the audience in step two, and
 * only a sendable draft can leave step one. The rate inputs are clamped by
 * lib/sendQueue before anything is queued, so the estimate the user confirms is
 * the estimate the delivery loop honours.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import AIContentGenerator from '../../../components/marketing/AIContentGenerator.vue';
import ChannelPreview from '../../../components/marketing/ChannelPreview.vue';
import ContentEditor from '../../../components/marketing/ContentEditor.vue';
import RecipientSelector from '../../../components/marketing/RecipientSelector.vue';
import SendProgressDialog from '../../../components/marketing/SendProgressDialog.vue';
import { useAIContent } from '../../../composables/useAIContent';
import { useBatchSend } from '../../../composables/useBatchSend';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useI18nStore } from '../../../i18n';
import {
  fromDateTimeLocal,
  toDateTimeLocal,
  validateCampaignDraft,
  validateCampaignName,
  validateContent,
  validateRecipients
} from '../../../lib/marketingValidation';
import type { CampaignDraft, ValidationErrors } from '../../../lib/marketingValidation';
import { useMarketingStore } from '../../../stores/marketing';
import { useTagStore } from '../../../stores/tag';
import { CHANNEL_PLATFORMS, DEFAULT_SEND_SETTINGS, RATE_LIMITS } from '../../../types';
import type {
  ChannelPlatform,
  MarketingContent,
  MarketingTemplate,
  RecipientFilters,
  SendMode,
  SendSettings
} from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const store = useMarketingStore();
const tagStore = useTagStore();

usePageMeta(i18n.t('marketing.wizard.title'), i18n.t('marketing.subtitle'));

const { content, previews, sendable, updateContent, applyTemplate, clear } = useAIContent();

/* Destructured so every slice unwraps in the template. */
const {
  progress: sendProgress,
  running: sendRunning,
  paused: sendPaused,
  failures: sendFailures,
  lastSummary: sendSummary,
  estimate: estimateSend,
  start: startSend,
  pause: pauseSend,
  resume: resumeSend,
  cancel: cancelSend,
  dismiss: dismissSend,
  rerunFailures
} = useBatchSend();

const step = ref(1);
const name = ref('');
const scheduleText = ref(toDateTimeLocal(Date.now()));
/* The field shows a default time, so the state has to carry the same value. */
const settings = ref<SendSettings>({
  ...DEFAULT_SEND_SETTINGS,
  channels: ['whatsapp'],
  scheduledAt: fromDateTimeLocal(scheduleText.value)
});
const errors = ref<ValidationErrors>({});
const dialogOpen = ref(false);
const templateId = ref('');
const createdId = ref<string | null>(null);

const steps = [1, 2, 3];
const platforms = CHANNEL_PLATFORMS;
const rateLimits = RATE_LIMITS;
const templates = computed(() => store.templates);
const tags = computed(() => tagStore.tags);
const channels = computed(() => store.previewPlatforms);
const selectedIds = computed(() => store.selectedIds);
const validCount = computed(() => store.validSelected.length);
const invalidCount = computed(() => store.invalidSelected.length);
const estimate = computed(() => estimateSend());
/** True when clamping moved the user's number, which the form then discloses. */
const rateClamped = computed(
  () =>
    estimate.value.rate.perMinute !== settings.value.perMinute ||
    estimate.value.rate.intervalMs !== settings.value.intervalMs
);
const canGoNext = computed(() => {
  if (step.value === 1) return sendable.value && validateCampaignName(name.value) === null;
  if (step.value === 2) return validateRecipients(selectedIds.value) === null;
  return true;
});

function draft(): CampaignDraft {
  return {
    name: name.value,
    content: content.value,
    recipientIds: selectedIds.value,
    settings: settings.value
  };
}

/** The campaign remembers which channels it targeted, not the whole filter UI. */
function filtersFor(): RecipientFilters {
  return {
    tagIds: [],
    channels: [...settings.value.channels],
    activity: 'all',
    query: ''
  };
}

function goStep(next: number): void {
  if (next < 1 || next > 3) return;
  /* Going back is always allowed; going forward runs the gate for this step. */
  if (next > step.value) {
    const found: ValidationErrors = {};
    if (step.value === 1) {
      const nameError = validateCampaignName(name.value);
      if (nameError) found.name = nameError;
      const contentError = validateContent(content.value);
      if (contentError) found.content = contentError;
    } else if (step.value === 2) {
      const recipientError = validateRecipients(selectedIds.value);
      if (recipientError) found.recipientIds = recipientError;
    }
    errors.value = found;
    if (Object.keys(found).length > 0) return;
  }
  step.value = next;
}

function setMode(mode: SendMode): void {
  settings.value = { ...settings.value, mode };
}

function onScheduleInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  scheduleText.value = value;
  settings.value = { ...settings.value, scheduledAt: fromDateTimeLocal(value) };
}

function onPerMinute(event: Event): void {
  const parsed = Number((event.target as HTMLInputElement).value);
  settings.value = { ...settings.value, perMinute: Number.isFinite(parsed) ? parsed : 0 };
}

function onInterval(event: Event): void {
  const parsed = Number((event.target as HTMLInputElement).value);
  settings.value = { ...settings.value, intervalMs: Number.isFinite(parsed) ? parsed : 0 };
}

function toggleChannel(platform: ChannelPlatform): void {
  const set = new Set(settings.value.channels);
  if (set.has(platform)) set.delete(platform);
  else set.add(platform);
  const next = Array.from(set);
  settings.value = { ...settings.value, channels: next };
  /* Previews follow the delivery targets, so the two can never disagree. */
  store.setPreviewPlatforms(next.length > 0 ? next : ['whatsapp']);
}

function onTemplatePick(event: Event): void {
  const id = (event.target as HTMLSelectElement).value;
  templateId.value = id;
  const template: MarketingTemplate | undefined = templates.value.find((item) => item.id === id);
  if (!template) return;
  applyTemplate(template);
  showToast(i18n.t('marketing.templates.appliedToast'));
}

function onContentUpdate(patch: Partial<MarketingContent>): void {
  updateContent(patch);
}

function onContentClear(): void {
  clear();
}

async function onSubmit(): Promise<void> {
  const now = Date.now();
  errors.value = validateCampaignDraft(draft(), now);
  if (Object.keys(errors.value).length > 0) return;
  const draftContent = content.value;
  if (!draftContent) return;

  const created = await store.createCampaign({
    name: name.value.trim(),
    content: draftContent,
    templateId: templateId.value || undefined,
    recipientIds: [...selectedIds.value],
    filters: filtersFor(),
    settings: { ...settings.value }
  });
  if (!created) return;
  createdId.value = created.id;
  showToast(i18n.t('marketing.createdToast'));

  if (settings.value.mode === 'scheduled') {
    void router.push('/dashboard/marketing/campaigns/' + created.id);
    return;
  }
  await startNow(created.id);
}

/** Immediate mode hands the audience to the throttled queue right away. */
async function startNow(campaignId: string): Promise<void> {
  if (invalidCount.value > 0) {
    showToast(i18n.t('marketing.invalidBlocked', { n: invalidCount.value }));
  }
  dialogOpen.value = true;
  const summary = await startSend(campaignId, {
    perMinute: settings.value.perMinute,
    intervalMs: settings.value.intervalMs
  });
  if (!summary) {
    dialogOpen.value = false;
    showToast(i18n.t('marketing.nothingToSend'));
    return;
  }
  await store.fetchCampaign(campaignId);
}

async function onRetry(): Promise<void> {
  if (!createdId.value) return;
  await rerunFailures(createdId.value);
}

function onDiscard(): void {
  clear();
  store.clearSelection();
  void router.push('/dashboard/marketing');
}

/* Closing the panel is the exit from the wizard, whatever the outcome was. */
watch(dialogOpen, (open) => {
  if (open) return;
  dismissSend();
  const target = createdId.value
    ? '/dashboard/marketing/campaigns/' + createdId.value
    : '/dashboard/marketing';
  void router.push(target);
});

watch(
  () => store.error,
  (value) => {
    if (value) showToast(i18n.t(value));
  }
);

onMounted(() => {
  void store.fetchChannels();
  void store.fetchTemplates();
  void tagStore.fetchTags();
});
</script>

<template>
  <section class="wiz">
    <header class="wiz__top">
      <button
        class="wiz__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/dashboard/marketing')"
      >&larr;</button>
      <div class="wiz__heading">
        <h1 class="wiz__title">{{ i18n.t('marketing.wizard.title') }}</h1>
        <p class="wiz__subtitle">{{ i18n.t('marketing.subtitle') }}</p>
      </div>
      <button class="wiz__btn is-ghost" type="button" @click="onDiscard">
        {{ i18n.t('marketing.wizard.cancel') }}
      </button>
    </header>

    <ol class="wiz__steps">
      <li v-for="item in steps" :key="item" class="wiz__step-wrap">
        <button
          class="wiz__step"
          :class="{ 'is-active': step === item, 'is-done': step > item }"
          type="button"
          :aria-current="step === item"
          @click="goStep(item)"
        >
          {{ i18n.t('marketing.wizard.step' + item) }}
        </button>
      </li>
    </ol>

    <div v-if="step === 1" class="wiz__body">
      <h2 class="wiz__section">{{ i18n.t('marketing.wizard.stepContentTitle') }}</h2>

      <div class="wiz__field">
        <label class="wiz__label" for="wiz-name">{{ i18n.t('marketing.wizard.name') }}</label>
        <input
          id="wiz-name"
          v-model="name"
          class="wiz__input"
          :placeholder="i18n.t('marketing.wizard.namePlaceholder')"
          :class="{ 'has-error': errors.name }"
        />
        <p v-if="errors.name" class="wiz__error">{{ i18n.t(errors.name) }}</p>
      </div>

      <div class="wiz__field">
        <label class="wiz__label" for="wiz-template">{{ i18n.t('marketing.ai.orTemplate') }}</label>
        <select id="wiz-template" class="wiz__input" :value="templateId" @change="onTemplatePick">
          <option value="">{{ i18n.t('marketing.templates.categoryAll') }}</option>
          <option v-for="template in templates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>
      </div>

      <AIContentGenerator />
      <p v-if="errors.content" class="wiz__error">{{ i18n.t(errors.content) }}</p>
      <ContentEditor :content="content" @update="onContentUpdate" @clear="onContentClear" />
      <ChannelPreview :previews="previews" />
    </div>

    <div v-else-if="step === 2" class="wiz__body">
      <h2 class="wiz__section">{{ i18n.t('marketing.wizard.stepAudienceTitle') }}</h2>
      <RecipientSelector :tags="tags" :channels="channels" />
      <p v-if="errors.recipientIds" class="wiz__error">{{ i18n.t(errors.recipientIds) }}</p>
    </div>

    <div v-else class="wiz__body">
      <h2 class="wiz__section">{{ i18n.t('marketing.wizard.stepSendTitle') }}</h2>

      <div class="wiz__field">
        <span class="wiz__label">{{ i18n.t('marketing.send.mode') }}</span>
        <div class="wiz__segmented" role="group">
          <button
            class="wiz__seg"
            :class="{ 'is-active': settings.mode === 'immediate' }"
            type="button"
            @click="setMode('immediate')"
          >
            {{ i18n.t('marketing.send.modeImmediate') }}
          </button>
          <button
            class="wiz__seg"
            :class="{ 'is-active': settings.mode === 'scheduled' }"
            type="button"
            @click="setMode('scheduled')"
          >
            {{ i18n.t('marketing.send.modeScheduled') }}
          </button>
        </div>
      </div>

      <div v-if="settings.mode === 'scheduled'" class="wiz__field">
        <label class="wiz__label" for="wiz-when">{{ i18n.t('marketing.send.scheduledAt') }}</label>
        <input
          id="wiz-when"
          class="wiz__input"
          type="datetime-local"
          :value="scheduleText"
          :class="{ 'has-error': errors.scheduledAt }"
          @input="onScheduleInput"
        />
        <p v-if="errors.scheduledAt" class="wiz__error">{{ i18n.t(errors.scheduledAt) }}</p>
      </div>

      <div class="wiz__grid2">
        <div class="wiz__field">
          <label class="wiz__label" for="wiz-rate">{{ i18n.t('marketing.send.perMinute') }}</label>
          <input
            id="wiz-rate"
            class="wiz__input"
            type="number"
            :min="rateLimits.minPerMinute"
            :max="rateLimits.maxPerMinute"
            :value="settings.perMinute"
            :class="{ 'has-error': errors.perMinute }"
            @input="onPerMinute"
          />
          <p v-if="errors.perMinute" class="wiz__error">{{ i18n.t(errors.perMinute) }}</p>
        </div>
        <div class="wiz__field">
          <label class="wiz__label" for="wiz-interval">{{ i18n.t('marketing.send.interval') }}</label>
          <input
            id="wiz-interval"
            class="wiz__input"
            type="number"
            step="500"
            :min="rateLimits.minIntervalMs"
            :max="rateLimits.maxIntervalMs"
            :value="settings.intervalMs"
            :class="{ 'has-error': errors.intervalMs }"
            @input="onInterval"
          />
          <p v-if="errors.intervalMs" class="wiz__error">{{ i18n.t(errors.intervalMs) }}</p>
        </div>
      </div>

      <p class="wiz__hint">
        {{ i18n.t('marketing.send.rateHint', { min: rateLimits.minPerMinute, max: rateLimits.maxPerMinute }) }}
      </p>
      <p v-if="rateClamped" class="wiz__warn">{{ i18n.t('marketing.send.clamped') }}</p>

      <div class="wiz__field">
        <span class="wiz__label">{{ i18n.t('marketing.send.channels') }}</span>
        <div class="wiz__chips">
          <button
            v-for="platform in platforms"
            :key="platform"
            class="wiz__chip"
            :class="{ 'is-active': settings.channels.includes(platform) }"
            type="button"
            :aria-pressed="settings.channels.includes(platform)"
            @click="toggleChannel(platform)"
          >
            {{ i18n.t('channels.platform.' + platform) }}
          </button>
        </div>
        <p v-if="errors.channels" class="wiz__error">{{ i18n.t(errors.channels) }}</p>
      </div>

      <ChannelPreview :previews="previews" />

      <section class="wiz__review">
        <h3 class="wiz__review-title">{{ i18n.t('marketing.send.reviewTitle') }}</h3>
        <dl class="wiz__review-list">
          <div class="wiz__review-row">
            <dt>{{ i18n.t('marketing.wizard.name') }}</dt>
            <dd>{{ name || '\u2014' }}</dd>
          </div>
          <div class="wiz__review-row">
            <dt>{{ i18n.t('marketing.recipients.selected', { n: selectedIds.length }) }}</dt>
            <dd>
              {{ i18n.t('marketing.recipients.valid', { n: validCount }) }}
              <span v-if="invalidCount > 0" class="wiz__review-bad">
                {{ i18n.t('marketing.recipients.invalid', { n: invalidCount }) }}
              </span>
            </dd>
          </div>
          <div class="wiz__review-row">
            <dt>{{ i18n.t('marketing.send.estimate', { text: estimate.text, n: estimate.count }) }}</dt>
            <dd>{{ i18n.t('marketing.progress.rate', { n: estimate.rate.perMinute }) }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <footer class="wiz__nav">
      <button
        v-if="step > 1"
        class="wiz__btn"
        type="button"
        @click="goStep(step - 1)"
      >
        {{ i18n.t('marketing.wizard.previous') }}
      </button>
      <span class="wiz__spacer"></span>
      <button
        v-if="step < 3"
        class="wiz__btn is-primary"
        type="button"
        :disabled="!canGoNext"
        @click="goStep(step + 1)"
      >
        {{ i18n.t('marketing.wizard.next') }}
      </button>
      <button
        v-else
        class="wiz__btn is-primary"
        type="button"
        :disabled="store.saving || sendRunning"
        @click="onSubmit"
      >
        {{ i18n.t('marketing.wizard.submit') }}
      </button>
    </footer>

    <SendProgressDialog
      v-model:open="dialogOpen"
      :progress="sendProgress"
      :summary="sendSummary"
      :failures="sendFailures"
      :paused="sendPaused"
      @pause="pauseSend"
      @resume="resumeSend"
      @cancel="cancelSend"
      @retry="onRetry"
    />
  </section>
</template>

<style scoped>
.wiz {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  box-sizing: border-box;
}
.wiz__top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.wiz__home {
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
.wiz__heading {
  flex: 1;
  min-width: 0;
}
.wiz__title {
  margin: 0;
  font-size: 24px;
  line-height: 30px;
  font-weight: 800;
  color: var(--ks-text-primary);
}
.wiz__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.wiz__steps {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.wiz__step-wrap {
  flex: 1;
  min-width: 0;
}
.wiz__step {
  width: 100%;
  height: 36px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}
.wiz__step.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.wiz__step.is-done {
  color: var(--ks-success);
}
.wiz__step:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wiz__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.wiz__section {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wiz__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wiz__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.wiz__input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.wiz__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.wiz__input.has-error {
  border-color: var(--ks-error);
}
.wiz__error {
  margin: 0;
  font-size: 12px;
  color: var(--ks-error);
}
.wiz__hint {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.wiz__warn {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--ks-warning);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-soft);
  font-size: 12px;
  color: var(--ks-text-primary);
}
.wiz__grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.wiz__segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-muted);
}
.wiz__seg {
  flex: 1;
  height: 32px;
  border: none;
  border-radius: calc(var(--ks-radius-btn) - 2px);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.wiz__seg.is-active {
  background: var(--ks-bg-surface);
  color: var(--ks-primary-text);
  box-shadow: var(--ks-shadow-card);
}
.wiz__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.wiz__chip {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.wiz__chip.is-active {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wiz__chip:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.wiz__review {
  padding: 14px 16px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.wiz__review-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.wiz__review-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wiz__review-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.wiz__review-row dt {
  color: var(--ks-text-tertiary);
}
.wiz__review-row dd {
  margin: 0;
  color: var(--ks-text-primary);
  font-weight: 600;
  text-align: right;
}
.wiz__review-bad {
  margin-left: 8px;
  color: var(--ks-error);
}
.wiz__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--ks-border-default);
}
.wiz__spacer {
  flex: 1;
}
.wiz__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.wiz__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wiz__btn.is-primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.wiz__btn.is-ghost {
  border-color: transparent;
  color: var(--ks-text-tertiary);
}
.wiz__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}

@media (max-width: 767px) {
  .wiz {
    padding: 16px 12px 40px;
  }
  .wiz__title {
    font-size: 20px;
    line-height: 26px;
  }
  .wiz__grid2 {
    grid-template-columns: minmax(0, 1fr);
  }
  .wiz__nav .wiz__btn {
    flex: 1 1 auto;
  }
  .wiz__review-row {
    flex-direction: column;
    gap: 2px;
  }
  .wiz__review-row dd {
    text-align: left;
  }
}
</style>
