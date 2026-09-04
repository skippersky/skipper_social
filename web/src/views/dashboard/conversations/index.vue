<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showToast } from 'vant';
import AIReplyCard from '../../../components/conversation/AIReplyCard.vue';
import ConnectionStatusBar from '../../../components/conversation/ConnectionStatusBar.vue';
import ConversationList from '../../../components/conversation/ConversationList.vue';
import MessageInput from '../../../components/conversation/MessageInput.vue';
import MessageList from '../../../components/conversation/MessageList.vue';
import QuickReplyPopup from '../../../components/conversation/QuickReplyPopup.vue';
import * as aiApi from '../../../api/ai';
import * as messageApi from '../../../api/message';
import { groupMessages } from '../../../composables/messageGrouping';
import { useConversation } from '../../../composables/useConversation';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useTypingIndicator } from '../../../composables/useTypingIndicator';
import { useI18nStore } from '../../../i18n';
import { useConversationStore } from '../../../stores/conversation';
import { useMessageStore } from '../../../stores/message';
import { useWebSocketStore } from '../../../stores/websocket';
import { CHANNEL_PLATFORMS, type QuickReplyTemplate } from '../../../types';

const i18n = useI18nStore();
const store = useConversationStore();
const messageStore = useMessageStore();
const ws = useWebSocketStore();

usePageMeta(i18n.t('inbox.metaTitle'), i18n.t('inbox.metaDescription'));

const selectedId = ref<string | null>(null);
const { messages, loading: messagesLoading, hasMore, loadMore, send, retry } =
  useConversation(selectedId);
const { remoteTyping, setTyping, stop: stopTyping } = useTypingIndicator(selectedId);

const items = computed(() => groupMessages(messages.value, i18n.locale));

const isMobile = ref(false);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(max-width: 767px)');
  isMobile.value = query.matches;
  query.addEventListener?.('change', (event: MediaQueryListEvent) => {
    isMobile.value = event.matches;
  });
}

// Sample-data disclosure shares the hotfix persistence key.
const DEMO_HIDDEN_KEY = 'ks-chat-demo-hidden';
const demoHidden = ref(false);
try {
  demoHidden.value = localStorage.getItem(DEMO_HIDDEN_KEY) === '1';
} catch {
  /* private mode */
}
const showDemoBar = computed(() => store.hasDemoData && !demoHidden.value);
const visibleConversations = computed(() =>
  store.hasDemoData && demoHidden.value ? [] : store.filteredConversations
);

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

function onSearchInput(event: Event): void {
  store.setFilters({ query: (event.target as HTMLInputElement).value });
}

const inputRef = ref<InstanceType<typeof MessageInput> | null>(null);

const aiVisible = ref(false);
const aiLoading = ref(false);
const aiText = ref('');

async function requestAi(): Promise<void> {
  if (!selectedId.value) return;
  aiVisible.value = true;
  aiLoading.value = true;
  try {
    const suggestion = await aiApi.generateReply(selectedId.value, aiText.value || undefined);
    aiText.value = suggestion.text;
  } catch {
    showToast(i18n.t('inbox.aiFailed'));
    aiVisible.value = false;
  } finally {
    aiLoading.value = false;
  }
}

function adoptAi(): void {
  inputRef.value?.setText(aiText.value);
  aiVisible.value = false;
}

const quickShow = ref(false);
const templates = ref<QuickReplyTemplate[]>([]);

async function openQuick(): Promise<void> {
  quickShow.value = true;
  try {
    templates.value = await aiApi.getQuickTemplates();
  } catch {
    templates.value = [];
  }
}

function pickTemplate(template: QuickReplyTemplate): void {
  quickShow.value = false;
  inputRef.value?.setText(template.text);
}

async function onSend(text: string): Promise<boolean> {
  const ok = await send(text);
  if (!ok && messageStore.error) showToast(i18n.t(messageStore.error));
  return ok;
}

async function onAttach(file: File): Promise<void> {
  if (!selectedId.value) return;
  try {
    const uploaded = await messageApi.uploadMedia(file);
    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'file';
    await send(file.name, type, uploaded.url);
  } catch {
    showToast(i18n.t('api.network'));
  }
}

async function onRetry(messageId: string): Promise<void> {
  const ok = await retry(messageId);
  if (!ok && messageStore.error) showToast(i18n.t(messageStore.error));
}

function onSelect(id: string): void {
  selectedId.value = id;
  aiVisible.value = false;
}

async function onArchive(id: string): Promise<void> {
  if (await store.archive(id)) showToast(i18n.t('inbox.archivedToast'));
  else if (store.error) showToast(i18n.t(store.error));
}

async function onUnarchiveCurrent(): Promise<void> {
  const current = store.currentConversation;
  if (!current) return;
  if (await store.unarchive(current.id)) showToast(i18n.t('inbox.unarchivedToast'));
}

async function onRead(id: string): Promise<void> {
  await store.markAsRead(id);
}

onMounted(() => {
  void store.fetchConversations();
  ws.connect();
});

onUnmounted(() => {
  stopTyping();
});
</script>
<template>
  <div class="inbox">
    <ConnectionStatusBar :status="ws.status" />
    <aside class="inbox__list" :class="{ 'is-hidden-mobile': selectedId && isMobile }">
      <div class="inbox__list-head">
        <button class="inbox__home" type="button" :aria-label="i18n.t('common.backHome')" @click="$router.push('/home')">←</button>
        <h1 class="inbox__title">{{ i18n.t('inbox.title') }}</h1>
        <span class="inbox__unread">{{ store.totalUnread }}</span>
      </div>
      <div class="inbox__filters">
        <input
          class="inbox__search"
          :value="store.filters.query"
          :placeholder="i18n.t('inbox.search')"
          @input="onSearchInput"
        />
        <div class="inbox__tabs">
          <button
            v-for="tab in (['all', 'unread', 'archived'] as const)"
            :key="tab"
            class="inbox__tab"
            :class="{ 'is-active': store.filters.status === tab }"
            type="button"
            @click="store.setFilters({ status: tab })"
          >
            {{ i18n.t(tab === 'all' ? 'inbox.filterAll' : tab === 'unread' ? 'inbox.filterUnread' : 'inbox.filterArchived') }}
          </button>
        </div>
        <div class="inbox__platforms">
          <button
            class="inbox__chip"
            :class="{ 'is-active': store.filters.platform === 'all' }"
            type="button"
            @click="store.setFilters({ platform: 'all' })"
          >
            {{ i18n.t('inbox.platformAll') }}
          </button>
          <button
            v-for="platform in CHANNEL_PLATFORMS"
            :key="platform"
            class="inbox__chip"
            :class="{ 'is-active': store.filters.platform === platform }"
            type="button"
            @click="store.setFilters({ platform })"
          >
            {{ i18n.t(`channels.platform.${platform}`) }}
          </button>
        </div>
      </div>
      <div v-if="showDemoBar" class="inbox__demo" role="note">
        <span>{{ i18n.t('chat.demoNotice') }}</span>
        <button type="button" :aria-label="i18n.t('chat.demoHide')" @click="hideDemo">×</button>
      </div>
      <div v-if="store.loading" class="inbox__loading">…</div>
      <div v-else-if="visibleConversations.length === 0" class="inbox__empty">
        <van-empty :description="i18n.t('chat.noData')">
          <p class="inbox__empty-hint">{{ i18n.t('chat.noDataHint') }}</p>
          <button class="inbox__empty-cta" type="button" @click="$router.push('/dashboard/channels')">
            {{ i18n.t('chat.connectCta') }}
          </button>
        </van-empty>
      </div>
      <ConversationList
        v-else
        :conversations="visibleConversations"
        :selected-id="selectedId"
        @select="onSelect"
        @archive="onArchive"
        @read="onRead"
      />
    </aside>
    <main class="inbox__main" :class="{ 'is-hidden-mobile': !selectedId && isMobile }">
      <template v-if="store.currentConversation">
        <header class="inbox__main-head">
          <button v-if="isMobile" class="inbox__back" type="button" @click="selectedId = null">←</button>
          <h2 class="inbox__contact">{{ store.currentConversation.contactName }}</h2>
          <span v-if="store.currentConversation.platform" class="inbox__platform-tag">
            {{ i18n.t(`channels.platform.${store.currentConversation.platform}`) }}
          </span>
          <button
            v-if="store.currentConversation.archived"
            class="inbox__head-btn"
            type="button"
            @click="onUnarchiveCurrent"
          >
            {{ i18n.t('inbox.unarchive') }}
          </button>
          <button
            v-else
            class="inbox__head-btn"
            type="button"
            @click="onArchive(store.currentConversation.id)"
          >
            {{ i18n.t('inbox.archive') }}
          </button>
        </header>
        <MessageList
          :items="items"
          :loading="messagesLoading"
          :has-more="hasMore"
          :remote-typing="remoteTyping"
          @load-more="loadMore"
          @retry="onRetry"
        />
        <AIReplyCard
          v-if="aiVisible"
          :text="aiText"
          :loading="aiLoading"
          @adopt="adoptAi"
          @regenerate="requestAi"
          @close="aiVisible = false"
        />
        <MessageInput
          ref="inputRef"
          @send="onSend"
          @attach="onAttach"
          @ai="requestAi"
          @quick="openQuick"
          @typing="setTyping"
        />
      </template>
      <div v-else class="inbox__placeholder">
        <p>{{ i18n.t('chat.emptyTitle') }}</p>
      </div>
      <QuickReplyPopup v-model:show="quickShow" :templates="templates" @select="pickTemplate" />
    </main>
  </div>
</template>

<style scoped>
.inbox {
  flex: 1;
  display: flex;
  min-height: 0;
  height: calc(100dvh - 57px);
  background: var(--ks-bg-base);
}
.inbox__list {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ks-bg-surface);
  border-right: 1px solid var(--ks-border-default);
}
.inbox__list-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
}
.inbox__home {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  cursor: pointer;
}
.inbox__home:hover {
  background: var(--ks-bg-muted);
}
.inbox__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.inbox__unread {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 2px 10px;
}
.inbox__filters {
  padding: 0 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--ks-border-default);
}
.inbox__search {
  height: 36px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-base);
  color: var(--ks-text-primary);
  font-size: 13px;
  padding: 0 12px;
  box-sizing: border-box;
  font-family: inherit;
}
.inbox__search:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.inbox__tabs {
  display: flex;
  gap: 6px;
}
.inbox__tab {
  flex: 1;
  height: 30px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.inbox__tab.is-active {
  background: var(--ks-grad-brand);
  border-color: transparent;
  color: var(--ks-ink-on-grad);
}
.inbox__platforms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.inbox__chip {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.inbox__chip.is-active {
  background: var(--ks-grad-soft);
  border-color: var(--ks-primary-text);
  color: var(--ks-primary-text);
}
.inbox__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border-bottom: 1px solid rgba(180, 83, 9, 0.2);
}
.inbox__demo button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ks-warning);
  font-size: 14px;
  cursor: pointer;
}
.inbox__demo button:hover {
  background: rgba(180, 83, 9, 0.15);
}
.inbox__loading {
  padding: 24px 16px;
  text-align: center;
  color: var(--ks-text-tertiary);
}
.inbox__empty {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.inbox__empty-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.inbox__empty-cta {
  height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.inbox__empty-cta:hover {
  filter: brightness(1.05);
}
.inbox__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.inbox__main-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
}
.inbox__back {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  padding: 4px 8px;
  cursor: pointer;
}
.inbox__contact {
  font-size: 16px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.inbox__platform-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
.inbox__head-btn {
  margin-left: auto;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.inbox__head-btn:hover {
  background: var(--ks-bg-muted);
}
.inbox__placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ks-text-tertiary);
  font-size: 14px;
}
@media (min-width: 768px) and (max-width: 1024px) {
  .inbox__list {
    width: 280px;
  }
}
@media (max-width: 767px) {
  .inbox__list {
    width: 100%;
  }
  .is-hidden-mobile {
    display: none;
  }
}
</style>
