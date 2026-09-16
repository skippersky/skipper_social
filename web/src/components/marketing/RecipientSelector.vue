<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18nStore } from '../../i18n';
import { useMarketingStore } from '../../stores/marketing';
import { CHANNEL_PLATFORMS } from '../../types';
import type { ChannelPlatform, RecipientActivity, RecipientFilters, Tag } from '../../types';

const props = defineProps<{ tags: Tag[]; channels: ChannelPlatform[] }>();

const i18n = useI18nStore();
const store = useMarketingStore();

const filters = ref<RecipientFilters>({
  tagIds: [],
  channels: props.channels.length > 0 ? [...props.channels] : ['whatsapp'],
  activity: 'all',
  query: ''
});
const validated = ref(false);

const recipients = computed(() => store.recipients);
const loading = computed(() => store.loading);
const selectedIds = computed(() => store.selectedIds);
const summary = computed(() => store.recipientSummary);
const selectedSet = computed(() => new Set(selectedIds.value));
const activities: RecipientActivity[] = ['all', 'active', 'inactive'];

/** Keeps the audience aligned with the channels chosen in the send step. */
watch(
  () => props.channels,
  (next) => {
    if (next.length === 0) return;
    filters.value = { ...filters.value, channels: [...next] };
    void reload();
  }
);

onMounted(() => {
  void reload();
});

async function reload(): Promise<void> {
  validated.value = false;
  await store.fetchRecipients(filters.value);
}

function toggleTag(tagId: string): void {
  const set = new Set(filters.value.tagIds);
  if (set.has(tagId)) set.delete(tagId);
  else set.add(tagId);
  filters.value = { ...filters.value, tagIds: Array.from(set) };
  void reload();
}

function toggleChannel(platform: ChannelPlatform): void {
  const set = new Set(filters.value.channels);
  if (set.has(platform)) set.delete(platform);
  else set.add(platform);
  filters.value = { ...filters.value, channels: Array.from(set) };
  void reload();
}

function setActivity(activity: RecipientActivity): void {
  filters.value = { ...filters.value, activity };
  void reload();
}

function clearTags(): void {
  filters.value = { ...filters.value, tagIds: [] };
  void reload();
}

function onQueryInput(event: Event): void {
  filters.value = { ...filters.value, query: (event.target as HTMLInputElement).value };
}

async function onValidate(): Promise<void> {
  await store.validateSelection();
  validated.value = true;
}

const reasonKeys = computed(() => Object.keys(summary.value.byReason));
const channelKeys = computed(() => Object.keys(summary.value.byChannel));

function activityLabel(activity: RecipientActivity): string {
  const suffix = activity.charAt(0).toUpperCase() + activity.slice(1);
  return i18n.t('marketing.recipients.activity' + suffix);
}
</script>

<template>
  <section class="r-sel">
    <header class="r-sel__head">
      <h2 class="r-sel__title">{{ i18n.t('marketing.recipients.title') }}</h2>
      <p class="r-sel__hint">{{ i18n.t('marketing.recipients.hint') }}</p>
    </header>

    <div class="r-sel__toolbar">
      <form class="r-sel__search" @submit.prevent="reload">
        <input
          class="r-sel__input"
          :value="filters.query"
          :placeholder="i18n.t('marketing.recipients.searchPlaceholder')"
          :aria-label="i18n.t('marketing.recipients.searchPlaceholder')"
          @input="onQueryInput"
        />
      </form>
      <div class="r-sel__actions">
        <button class="r-sel__btn" type="button" @click="store.selectAllVisible(true)">
          {{ i18n.t('marketing.recipients.selectAll') }}
        </button>
        <button class="r-sel__btn" type="button" @click="store.clearSelection()">
          {{ i18n.t('marketing.recipients.clear') }}
        </button>
        <button class="r-sel__btn" type="button" @click="onValidate">
          {{ i18n.t('marketing.recipients.validate') }}
        </button>
      </div>
    </div>

    <div class="r-sel__filters">
      <div class="r-sel__chips">
        <span class="r-sel__chip-label">{{ i18n.t('marketing.recipients.filterTags') }}</span>
        <button
          class="r-sel__chip"
          :class="{ 'is-active': filters.tagIds.length === 0 }"
          type="button"
          @click="clearTags"
        >{{ i18n.t('marketing.recipients.allTags') }}</button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          class="r-sel__chip"
          :class="{ 'is-active': filters.tagIds.includes(tag.id) }"
          type="button"
          @click="toggleTag(tag.id)"
        >{{ tag.name }}</button>
      </div>

      <div class="r-sel__chips">
        <span class="r-sel__chip-label">{{ i18n.t('marketing.recipients.filterChannels') }}</span>
        <button
          v-for="platform in CHANNEL_PLATFORMS"
          :key="platform"
          class="r-sel__chip"
          :class="{ 'is-active': filters.channels.includes(platform) }"
          type="button"
          @click="toggleChannel(platform)"
        >{{ i18n.t('channels.platform.' + platform) }}</button>
      </div>

      <div class="r-sel__chips">
        <span class="r-sel__chip-label">{{ i18n.t('marketing.recipients.filterActivity') }}</span>
        <button
          v-for="activity in activities"
          :key="activity"
          class="r-sel__chip"
          :class="{ 'is-active': filters.activity === activity }"
          type="button"
          @click="setActivity(activity)"
        >{{ activityLabel(activity) }}</button>
      </div>
    </div>

    <div class="r-sel__summary" role="status">
      <span>{{ i18n.t('marketing.recipients.selected', { n: summary.total }) }}</span>
      <span class="r-sel__ok">{{ i18n.t('marketing.recipients.valid', { n: summary.valid }) }}</span>
      <span v-if="summary.invalid > 0" class="r-sel__bad">
        {{ i18n.t('marketing.recipients.invalid', { n: summary.invalid }) }}
      </span>
      <span v-for="key in channelKeys" :key="key" class="r-sel__meta">
        {{ i18n.t('channels.platform.' + key) }}: {{ summary.byChannel[key] }}
      </span>
    </div>

    <p v-if="validated && summary.invalid > 0" class="r-sel__notice" role="note">
      <span>{{ i18n.t('marketing.recipients.invalidNotice', { n: summary.invalid }) }}</span>
      <span v-for="reason in reasonKeys" :key="reason" class="r-sel__reason">
        {{ i18n.t('marketing.recipients.reason.' + reason) }} ({{ summary.byReason[reason] }})
      </span>
    </p>

    <div v-if="loading && recipients.length === 0" class="r-sel__loading">
      {{ i18n.t('common.loading') }}
    </div>
    <p v-else-if="recipients.length === 0" class="r-sel__empty">
      {{ i18n.t('marketing.recipients.empty') }}
    </p>
    <ul v-else class="r-sel__list">
      <li v-for="recipient in recipients" :key="recipient.id" class="r-sel__row">
        <label class="r-sel__check">
          <input
            type="checkbox"
            :checked="selectedSet.has(recipient.id)"
            :aria-label="recipient.name"
            @change="store.toggleRecipient(recipient.id)"
          />
          <span class="r-sel__name">{{ recipient.name }}</span>
        </label>
        <span class="r-sel__handle">{{ recipient.handle }}</span>
        <span v-for="tag in recipient.tags" :key="tag" class="r-sel__tag">{{ tag }}</span>
        <span v-if="!recipient.valid && recipient.invalidReason" class="r-sel__bad">
          {{ i18n.t('marketing.recipients.reason.' + recipient.invalidReason) }}
        </span>
        <span class="r-sel__channel">
          {{ i18n.t('channels.platform.' + recipient.channel) }}
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.r-sel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.r-sel__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.r-sel__title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.r-sel__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.r-sel__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.r-sel__search {
  flex: 1;
  min-width: 220px;
}
.r-sel__input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 14px;
  font-family: inherit;
  padding: 0 12px;
  box-sizing: border-box;
}
.r-sel__input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.r-sel__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.r-sel__btn {
  height: 40px;
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
.r-sel__btn:hover {
  background: var(--ks-bg-muted);
}
.r-sel__filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.r-sel__chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.r-sel__chip-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ks-text-tertiary);
  margin-right: 2px;
}
.r-sel__chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-base);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.r-sel__chip.is-active {
  background: var(--ks-grad-soft);
  border-color: var(--ks-primary-text);
  color: var(--ks-primary-text);
}
.r-sel__summary {
  display: flex;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--ks-bg-muted);
  border-radius: var(--ks-radius-btn);
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.r-sel__ok {
  color: var(--ks-success);
}
.r-sel__bad {
  color: var(--ks-warning);
}
.r-sel__meta {
  color: var(--ks-text-tertiary);
  font-weight: 500;
}
.r-sel__notice {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 19px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid rgba(180, 83, 9, 0.2);
  border-radius: var(--ks-radius-btn);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.r-sel__reason {
  color: var(--ks-text-secondary);
}
.r-sel__loading,
.r-sel__empty {
  margin: 0;
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.r-sel__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
}
.r-sel__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--ks-border-default);
  font-size: 13px;
  flex-wrap: wrap;
}
.r-sel__row:last-child {
  border-bottom: none;
}
.r-sel__check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
}
.r-sel__name {
  font-weight: 600;
  color: var(--ks-text-primary);
}
.r-sel__handle {
  color: var(--ks-text-secondary);
  overflow-wrap: anywhere;
}
.r-sel__channel {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--ks-primary-text);
}
.r-sel__tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ks-grad-soft);
  color: var(--ks-primary-text);
  font-size: 11px;
  font-weight: 600;
}
@media (max-width: 767px) {
  .r-sel {
    padding: 14px;
  }
  .r-sel__search {
    min-width: 100%;
  }
  .r-sel__actions {
    width: 100%;
  }
  .r-sel__actions .r-sel__btn {
    flex: 1;
  }
  .r-sel__channel {
    margin-left: 0;
  }
}
</style>
