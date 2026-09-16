/**
 * Marketing store (Sprint 11).
 *
 * Single source of truth for campaigns, templates, the generated draft, the
 * selected audience and the live send progress. Views and composables never
 * import api/marketing directly, so swapping the demo backend for the real one
 * needs no UI change. Errors are stored as i18n keys, never as raw text.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiErrorI18nKey } from '../api/http';
import * as marketingApi from '../api/marketing';
import type { RecipientValidation } from '../api/marketing';
import { demoRecipientSummary } from '../api/demoMarketing';
import type { RecipientSummary } from '../api/demoMarketing';
import { renderPreviews } from '../lib/marketingContent';
import { clampRate } from '../lib/sendQueue';
import type { QueueRate } from '../lib/sendQueue';
import type {
  AIContentRequest,
  BatchSendProgress,
  Campaign,
  CampaignInput,
  CampaignListParams,
  CampaignStats,
  ChannelPlatform,
  ContentPreview,
  MarketingContent,
  MarketingOverview,
  MarketingTemplate,
  Recipient,
  RecipientFilters,
  SendHistoryParams,
  SendRecord,
  SendStatus,
  TemplateInput
} from '../types';
import { DEFAULT_SEND_SETTINGS } from '../types';

const EMPTY_OVERVIEW: MarketingOverview = {
  monthSent: 0,
  monthOpenRate: 0,
  monthConversionRate: 0,
  activeCampaigns: 0
};

export const HISTORY_PAGE_SIZE = 20;
export const CAMPAIGN_PAGE_SIZE = 20;

export const useMarketingStore = defineStore('marketing', () => {
  const overview = ref<MarketingOverview>({ ...EMPTY_OVERVIEW });
  const campaigns = ref<Campaign[]>([]);
  const campaignsTotal = ref(0);
  const campaignsHasMore = ref(false);
  const currentCampaign = ref<Campaign | null>(null);
  const records = ref<SendRecord[]>([]);
  const templates = ref<MarketingTemplate[]>([]);
  const generatedContent = ref<MarketingContent | null>(null);
  const previews = ref<ContentPreview[]>([]);
  const previewPlatforms = ref<ChannelPlatform[]>([...DEFAULT_SEND_SETTINGS.channels]);
  const recipients = ref<Recipient[]>([]);
  const selectedIds = ref<string[]>([]);
  const history = ref<SendRecord[]>([]);
  const historyTotal = ref(0);
  const historyHasMore = ref(false);
  const progress = ref<BatchSendProgress | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const sending = ref(false);
  const error = ref<string | null>(null);

  const activeCampaigns = computed(() =>
    campaigns.value.filter((item) => item.status === 'running' || item.status === 'paused')
  );
  const draftCampaigns = computed(() =>
    campaigns.value.filter((item) => item.status === 'draft')
  );
  const completedCampaigns = computed(() =>
    campaigns.value.filter((item) => item.status === 'completed' || item.status === 'cancelled')
  );
  const hasDemoData = computed(() => campaigns.value.some((item) => item.demo === true));
  const templateCategories = computed(() => {
    const seen = new Set<string>();
    const out: MarketingTemplate['category'][] = [];
    for (const item of templates.value) {
      if (seen.has(item.category)) continue;
      seen.add(item.category);
      out.push(item.category);
    }
    return out;
  });

  const selectedRecipients = computed(() => {
    const wanted = new Set(selectedIds.value);
    return recipients.value.filter((item) => wanted.has(item.id));
  });
  const validSelected = computed(() => selectedRecipients.value.filter((item) => item.valid));
  const invalidSelected = computed(() => selectedRecipients.value.filter((item) => !item.valid));
  const recipientSummary = computed<RecipientSummary>(() =>
    demoRecipientSummary(selectedRecipients.value)
  );
  /** The rate the queue will actually run at, clamped to the product limits. */
  const sendRate = computed<QueueRate>(() =>
    clampRate(
      currentCampaign.value?.settings.perMinute ?? DEFAULT_SEND_SETTINGS.perMinute,
      currentCampaign.value?.settings.intervalMs ?? DEFAULT_SEND_SETTINGS.intervalMs
    )
  );
  const stats = computed<CampaignStats | null>(() => currentCampaign.value?.stats ?? null);

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function resetError(): void {
    error.value = null;
  }

  /* ------------------------------------------------------------- overview */

  async function fetchOverview(): Promise<MarketingOverview> {
    loading.value = true;
    resetError();
    try {
      overview.value = await marketingApi.getMarketingOverview();
      return overview.value;
    } catch (err) {
      fail(err);
      return { ...EMPTY_OVERVIEW };
    } finally {
      loading.value = false;
    }
  }

  /* ------------------------------------------------------------ campaigns */

  async function fetchCampaigns(params?: CampaignListParams): Promise<Campaign[]> {
    loading.value = true;
    resetError();
    try {
      const page = await marketingApi.getCampaigns({
        limit: CAMPAIGN_PAGE_SIZE,
        ...params
      });
      if (params?.offset && params.offset > 0) {
        const known = new Set(campaigns.value.map((item) => item.id));
        campaigns.value = campaigns.value.concat(page.campaigns.filter((item) => !known.has(item.id)));
      } else {
        campaigns.value = page.campaigns;
      }
      campaignsTotal.value = page.total;
      campaignsHasMore.value = page.hasMore;
      return campaigns.value;
    } catch (err) {
      fail(err);
      return campaigns.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCampaign(campaignId: string): Promise<Campaign | null> {
    loading.value = true;
    resetError();
    try {
      currentCampaign.value = await marketingApi.getCampaignDetail(campaignId);
      return currentCampaign.value;
    } catch (err) {
      fail(err);
      currentCampaign.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createCampaign(input: CampaignInput): Promise<Campaign | null> {
    saving.value = true;
    resetError();
    try {
      const created = await marketingApi.createCampaign(input);
      campaigns.value = [created, ...campaigns.value];
      campaignsTotal.value += 1;
      currentCampaign.value = created;
      return created;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function runTransition(
    campaignId: string,
    action: 'start' | 'pause' | 'cancel'
  ): Promise<Campaign | null> {
    saving.value = true;
    resetError();
    try {
      const call =
        action === 'start'
          ? marketingApi.startCampaign
          : action === 'pause'
            ? marketingApi.pauseCampaign
            : marketingApi.cancelCampaign;
      const next = await call(campaignId);
      applyCampaign(next);
      return next;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  function applyCampaign(next: Campaign): void {
    const index = campaigns.value.findIndex((item) => item.id === next.id);
    if (index >= 0) campaigns.value[index] = next;
    if (currentCampaign.value?.id === next.id) currentCampaign.value = next;
  }

  async function fetchRecords(campaignId: string, limit = 50): Promise<SendRecord[]> {
    resetError();
    try {
      records.value = await marketingApi.getCampaignRecords(campaignId, limit);
      return records.value;
    } catch (err) {
      fail(err);
      return [];
    }
  }

  async function recordSend(
    campaignId: string,
    recipient: Recipient,
    status: SendStatus,
    failureReason?: string
  ): Promise<SendRecord | null> {
    try {
      const record = await marketingApi.recordSend(campaignId, recipient, status, failureReason);
      records.value = [record, ...records.value].slice(0, 200);
      return record;
    } catch {
      /* A dropped telemetry row must never abort a running batch. */
      return null;
    }
  }

  async function retryFailed(campaignId: string): Promise<number> {
    saving.value = true;
    resetError();
    try {
      const count = await marketingApi.retryFailed(campaignId);
      await fetchCampaign(campaignId);
      return count;
    } catch (err) {
      fail(err);
      return 0;
    } finally {
      saving.value = false;
    }
  }

  /* ------------------------------------------------------------ templates */

  async function fetchTemplates(category?: MarketingTemplate['category']): Promise<MarketingTemplate[]> {
    loading.value = true;
    resetError();
    try {
      templates.value = await marketingApi.getTemplates(category);
      return templates.value;
    } catch (err) {
      fail(err);
      return templates.value;
    } finally {
      loading.value = false;
    }
  }

  async function createTemplate(input: TemplateInput): Promise<MarketingTemplate | null> {
    saving.value = true;
    resetError();
    try {
      const created = await marketingApi.createTemplate(input);
      templates.value = [created, ...templates.value];
      return created;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function updateTemplate(
    templateId: string,
    patch: Partial<TemplateInput>
  ): Promise<MarketingTemplate | null> {
    saving.value = true;
    resetError();
    try {
      const next = await marketingApi.updateTemplate(templateId, patch);
      const index = templates.value.findIndex((item) => item.id === templateId);
      if (index >= 0) templates.value[index] = next;
      return next;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function deleteTemplate(templateId: string): Promise<boolean> {
    saving.value = true;
    resetError();
    try {
      await marketingApi.deleteTemplate(templateId);
      templates.value = templates.value.filter((item) => item.id !== templateId);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function useTemplate(templateId: string): Promise<MarketingTemplate | null> {
    resetError();
    try {
      const next = await marketingApi.useTemplate(templateId);
      const index = templates.value.findIndex((item) => item.id === templateId);
      if (index >= 0) templates.value[index] = next;
      return next;
    } catch (err) {
      fail(err);
      return null;
    }
  }

  /* -------------------------------------------------------------- content */

  async function generateContent(request: AIContentRequest): Promise<MarketingContent | null> {
    saving.value = true;
    resetError();
    try {
      generatedContent.value = await marketingApi.generateAIContent(request);
      refreshPreviews();
      return generatedContent.value;
    } catch (err) {
      fail(err);
      return null;
    } finally {
      saving.value = false;
    }
  }

  /** The editor mutates the draft in place, so previews follow it locally. */
  function setContent(content: MarketingContent): void {
    generatedContent.value = { ...content };
    refreshPreviews();
  }

  function setPreviewPlatforms(platforms: ChannelPlatform[]): void {
    previewPlatforms.value = platforms.length > 0 ? [...platforms] : ['whatsapp'];
    refreshPreviews();
  }

  function refreshPreviews(): void {
    if (!generatedContent.value) {
      previews.value = [];
      return;
    }
    previews.value = renderPreviews(previewPlatforms.value, generatedContent.value);
  }

  function clearContent(): void {
    generatedContent.value = null;
    previews.value = [];
  }

  /* ----------------------------------------------------------- recipients */

  async function fetchRecipients(filters?: Partial<RecipientFilters>): Promise<Recipient[]> {
    loading.value = true;
    resetError();
    try {
      recipients.value = await marketingApi.getRecipients(filters);
      const known = new Set(recipients.value.map((item) => item.id));
      selectedIds.value = selectedIds.value.filter((itemId) => known.has(itemId));
      return recipients.value;
    } catch (err) {
      fail(err);
      return recipients.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchChannels(): Promise<ChannelPlatform[]> {
    resetError();
    try {
      const channels = await marketingApi.getMarketingChannels();
      previewPlatforms.value = channels.length > 0 ? channels : ['whatsapp'];
      refreshPreviews();
      return previewPlatforms.value;
    } catch (err) {
      fail(err);
      return previewPlatforms.value;
    }
  }

  function toggleRecipient(recipientId: string): void {
    const set = new Set(selectedIds.value);
    if (set.has(recipientId)) set.delete(recipientId);
    else set.add(recipientId);
    selectedIds.value = Array.from(set);
  }

  function selectRecipients(ids: string[]): void {
    selectedIds.value = Array.from(new Set(ids));
  }

  function selectAllVisible(onlyValid = true): void {
    const ids = recipients.value
      .filter((item) => (onlyValid ? item.valid : true))
      .map((item) => item.id);
    selectedIds.value = Array.from(new Set(selectedIds.value.concat(ids)));
  }

  function clearSelection(): void {
    selectedIds.value = [];
  }

  async function validateSelection(): Promise<RecipientValidation> {
    resetError();
    try {
      return await marketingApi.validateRecipients(selectedRecipients.value);
    } catch (err) {
      fail(err);
      return { valid: validSelected.value, invalid: invalidSelected.value };
    }
  }

  /* -------------------------------------------------------------- history */

  async function fetchHistory(params?: SendHistoryParams): Promise<SendRecord[]> {
    loading.value = true;
    resetError();
    try {
      const page = await marketingApi.getSendHistory({ limit: HISTORY_PAGE_SIZE, ...params });
      if (params?.offset && params.offset > 0) {
        const known = new Set(history.value.map((item) => item.id));
        history.value = history.value.concat(page.records.filter((item) => !known.has(item.id)));
      } else {
        history.value = page.records;
      }
      historyTotal.value = page.total;
      historyHasMore.value = page.hasMore;
      return history.value;
    } catch (err) {
      fail(err);
      return history.value;
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreHistory(params?: SendHistoryParams): Promise<void> {
    if (!historyHasMore.value || loading.value) return;
    await fetchHistory({ ...params, offset: history.value.length, limit: HISTORY_PAGE_SIZE });
  }

  /* ------------------------------------------------------------- progress */

  function setProgress(next: BatchSendProgress | null): void {
    progress.value = next;
    sending.value = next !== null && next.running;
  }

  function $reset(): void {
    overview.value = { ...EMPTY_OVERVIEW };
    campaigns.value = [];
    campaignsTotal.value = 0;
    campaignsHasMore.value = false;
    currentCampaign.value = null;
    records.value = [];
    templates.value = [];
    generatedContent.value = null;
    previews.value = [];
    previewPlatforms.value = [...DEFAULT_SEND_SETTINGS.channels];
    recipients.value = [];
    selectedIds.value = [];
    history.value = [];
    historyTotal.value = 0;
    historyHasMore.value = false;
    progress.value = null;
    loading.value = false;
    saving.value = false;
    sending.value = false;
    error.value = null;
  }

  return {
    overview,
    campaigns,
    campaignsTotal,
    campaignsHasMore,
    currentCampaign,
    records,
    templates,
    generatedContent,
    previews,
    previewPlatforms,
    recipients,
    selectedIds,
    history,
    historyTotal,
    historyHasMore,
    progress,
    loading,
    saving,
    sending,
    error,
    activeCampaigns,
    draftCampaigns,
    completedCampaigns,
    hasDemoData,
    templateCategories,
    selectedRecipients,
    validSelected,
    invalidSelected,
    recipientSummary,
    sendRate,
    stats,
    resetError,
    fetchOverview,
    fetchCampaigns,
    fetchCampaign,
    createCampaign,
    runTransition,
    applyCampaign,
    fetchRecords,
    recordSend,
    retryFailed,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    generateContent,
    setContent,
    setPreviewPlatforms,
    refreshPreviews,
    clearContent,
    fetchRecipients,
    fetchChannels,
    toggleRecipient,
    selectRecipients,
    selectAllVisible,
    clearSelection,
    validateSelection,
    fetchHistory,
    loadMoreHistory,
    setProgress,
    $reset
  };
});
