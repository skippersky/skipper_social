/**
 * Campaign list, detail and send history navigation (Sprint 11).
 *
 * The views stay declarative: this composable owns the filter state, the
 * paging offsets and the CSV export, and every mutation goes through the
 * marketing store so the demo/real api switch keeps working unchanged.
 */
import { computed, ref } from 'vue';
import { useMarketingStore, CAMPAIGN_PAGE_SIZE, HISTORY_PAGE_SIZE } from '../stores/marketing';
import { buildCsvFilename, downloadCsv, toCsv } from '../lib/csv';
import type { CsvCell, CsvDownloadEnv } from '../lib/csv';
import type {
  Campaign,
  CampaignListParams,
  CampaignStats,
  CampaignStatus,
  SendHistoryParams,
  SendRecord
} from '../types';

export type StatusFilter = CampaignStatus | 'all';

export const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled'
];

/** Column order of the exported file; also the header row. */
export const HISTORY_CSV_HEADERS = [
  'record_id',
  'campaign',
  'recipient',
  'channel',
  'status',
  'sent_at',
  'opened',
  'clicked',
  'replied',
  'failure_reason'
];

export const HISTORY_CSV_PREFIX = 'kili-social-send-history';

function defaultStamp(ms: number | null): string {
  return ms === null ? '' : new Date(ms).toISOString();
}

/** Rows for the export, in the same order as HISTORY_CSV_HEADERS. */
export function historyCsvRows(
  records: readonly SendRecord[],
  stampFn: (ms: number | null) => string = defaultStamp
): CsvCell[][] {
  return records.map((record) => [
    record.id,
    record.campaignName,
    record.recipientName,
    record.channel,
    record.status,
    record.sentAt === null ? '' : stampFn(record.sentAt),
    record.opened,
    record.clicked,
    record.replied,
    record.failureReason ?? ''
  ]);
}

export interface ExportHistoryOptions {
  headers?: string[];
  prefix?: string;
  now?: number;
  env?: CsvDownloadEnv;
  stampFn?: (ms: number | null) => string;
}

export interface ExportResult {
  filename: string;
  csv: string;
  rows: number;
  /** False when the host cannot trigger a download; the view shows a toast. */
  downloaded: boolean;
}

/** Builds the document, then asks the browser to save it. */
export function exportHistory(
  records: readonly SendRecord[],
  options: ExportHistoryOptions = {}
): ExportResult {
  const headers = options.headers ?? HISTORY_CSV_HEADERS;
  const stampFn = options.stampFn ?? defaultStamp;
  const now = options.now ?? Date.now();
  const csv = toCsv(headers, historyCsvRows(records, stampFn));
  const filename = buildCsvFilename(options.prefix ?? HISTORY_CSV_PREFIX, now);
  return {
    filename,
    csv,
    rows: records.length,
    downloaded: downloadCsv(filename, csv, options.env)
  };
}

export function useMarketing() {
  const store = useMarketingStore();
  const statusFilter = ref<StatusFilter>('all');
  const query = ref('');
  const historyFrom = ref<number | null>(null);
  const historyTo = ref<number | null>(null);
  const historyCampaignId = ref<string | null>(null);

  const campaigns = computed(() => store.campaigns);
  const campaignsTotal = computed(() => store.campaignsTotal);
  const hasMore = computed(() => store.campaignsHasMore);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const sending = computed(() => store.sending);
  const error = computed(() => store.error);
  const detail = computed(() => store.currentCampaign);
  const records = computed(() => store.records);
  const stats = computed<CampaignStats | null>(() => store.stats);
  const history = computed(() => store.history);
  const historyTotal = computed(() => store.historyTotal);
  const historyHasMore = computed(() => store.historyHasMore);
  const overview = computed(() => store.overview);
  const progress = computed(() => store.progress);

  function listParams(offset = 0): CampaignListParams {
    const params: CampaignListParams = { limit: CAMPAIGN_PAGE_SIZE, offset };
    const text = query.value.trim();
    if (text) params.query = text;
    if (statusFilter.value !== 'all') params.status = statusFilter.value;
    return params;
  }

  function historyParams(offset = 0): SendHistoryParams {
    const params: SendHistoryParams = { limit: HISTORY_PAGE_SIZE, offset };
    if (historyFrom.value !== null) params.from = historyFrom.value;
    if (historyTo.value !== null) params.to = historyTo.value;
    if (historyCampaignId.value) params.campaignId = historyCampaignId.value;
    return params;
  }

  async function refresh(): Promise<Campaign[]> {
    return store.fetchCampaigns(listParams(0));
  }

  async function search(text: string): Promise<Campaign[]> {
    query.value = text;
    return refresh();
  }

  async function filterStatus(next: StatusFilter): Promise<Campaign[]> {
    statusFilter.value = next;
    return refresh();
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || loading.value) return;
    await store.fetchCampaigns(listParams(campaigns.value.length));
  }

  /** Detail page entry: one campaign plus its delivery records. */
  async function open(campaignId: string): Promise<Campaign | null> {
    const campaign = await store.fetchCampaign(campaignId);
    if (campaign) await store.fetchRecords(campaignId);
    return campaign;
  }

  async function transition(
    campaignId: string,
    action: 'start' | 'pause' | 'cancel'
  ): Promise<Campaign | null> {
    return store.runTransition(campaignId, action);
  }

  function setHistoryRange(from: number | null, to: number | null): void {
    historyFrom.value = from;
    historyTo.value = to;
  }

  function setHistoryCampaign(campaignId: string | null): void {
    historyCampaignId.value = campaignId;
  }

  async function loadHistory(): Promise<SendRecord[]> {
    return store.fetchHistory(historyParams(0));
  }

  async function loadMoreHistory(): Promise<void> {
    await store.loadMoreHistory(historyParams(0));
  }

  /** Exports whatever is on screen, so a filtered view exports its filter. */
  function exportCsv(source?: readonly SendRecord[], options: ExportHistoryOptions = {}): ExportResult {
    return exportHistory(source ?? history.value, options);
  }

  return {
    campaigns,
    campaignsTotal,
    hasMore,
    loading,
    saving,
    sending,
    error,
    detail,
    records,
    stats,
    history,
    historyTotal,
    historyHasMore,
    overview,
    progress,
    statusFilter,
    query,
    historyFrom,
    historyTo,
    historyCampaignId,
    listParams,
    historyParams,
    refresh,
    search,
    filterStatus,
    loadMore,
    open,
    transition,
    setHistoryRange,
    setHistoryCampaign,
    loadHistory,
    loadMoreHistory,
    exportCsv
  };
}
