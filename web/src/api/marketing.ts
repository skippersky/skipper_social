/**
 * AI marketing endpoints (Sprint 11).
 *
 * Same contract as every other api module: try the real backend, and degrade to
 * api/demoMarketing on a missing backend so the module stays usable offline.
 * Nothing here talks to Qwen directly; the copy comes from the backend or from
 * the deterministic offline composer, which keeps real API keys out of the
 * browser bundle and keeps the demo honest about being a demo.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './http';
import { isMissingBackend } from './demo';
import {
  demoCampaignById,
  demoCampaignRecords,
  demoCampaigns,
  demoCancelCampaign,
  demoCreateCampaign,
  demoCreateTemplate,
  demoDeleteTemplate,
  demoGenerateContent,
  demoMarketingChannels,
  demoMarketingOverview,
  demoPauseCampaign,
  demoPreviewContent,
  demoRecipients,
  demoRecordSend,
  demoRetryFailed,
  demoSendHistory,
  demoStartCampaign,
  demoTemplates,
  demoUpdateTemplate,
  demoUseTemplate,
  demoValidateRecipients
} from './demoMarketing';
import type { RecipientValidation } from './demoMarketing';
import type {
  AIContentRequest,
  Campaign,
  CampaignInput,
  CampaignListParams,
  CampaignStats,
  ChannelPlatform,
  ContentPreview,
  MarketingContent,
  MarketingOverview,
  MarketingTemplate,
  PagedCampaigns,
  PagedSendHistory,
  Recipient,
  RecipientFilters,
  SendHistoryParams,
  SendRecord,
  SendStatus,
  TemplateInput
} from '../types';

const MARKETING = '/api/v1/marketing';

export type { RecipientValidation };

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? '?' + text : '';
}

function id(value: string): string {
  return encodeURIComponent(value);
}

/* ------------------------------------------------------------------ content */

export async function generateAIContent(request: AIContentRequest): Promise<MarketingContent> {
  try {
    return await apiPost<MarketingContent>(MARKETING + '/content/generate', request);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoGenerateContent(request);
  }
}

export interface PreviewRequest {
  content: MarketingContent;
  platforms: ChannelPlatform[];
}

export async function previewContent(request: PreviewRequest): Promise<ContentPreview[]> {
  try {
    return await apiPost<ContentPreview[]>(MARKETING + '/content/preview', request);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoPreviewContent(request.content, request.platforms);
  }
}

/* ---------------------------------------------------------------- templates */

export async function getTemplates(
  category?: MarketingTemplate['category']
): Promise<MarketingTemplate[]> {
  try {
    return await apiGet<MarketingTemplate[]>(MARKETING + '/templates' + toQuery({ category }));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoTemplates(category);
  }
}

export async function createTemplate(input: TemplateInput): Promise<MarketingTemplate> {
  try {
    return await apiPost<MarketingTemplate>(MARKETING + '/templates', input);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateTemplate(input);
  }
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<TemplateInput>
): Promise<MarketingTemplate> {
  try {
    return await apiPut<MarketingTemplate>(MARKETING + '/templates/' + id(templateId), patch);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateTemplate(templateId, patch);
  }
}

export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    await apiDelete<void>(MARKETING + '/templates/' + id(templateId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDeleteTemplate(templateId);
  }
}

/** Bumps the usage counter, which is what orders the template picker. */
export async function useTemplate(templateId: string): Promise<MarketingTemplate> {
  try {
    return await apiPost<MarketingTemplate>(
      MARKETING + '/templates/' + id(templateId) + '/use',
      {}
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUseTemplate(templateId);
  }
}

/* --------------------------------------------------------------- recipients */

export async function getRecipients(filters?: Partial<RecipientFilters>): Promise<Recipient[]> {
  try {
    return await apiPost<Recipient[]>(MARKETING + '/recipients/query', filters ?? {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRecipients(filters);
  }
}

export async function validateRecipients(recipients: Recipient[]): Promise<RecipientValidation> {
  try {
    return await apiPost<RecipientValidation>(MARKETING + '/recipients/validate', { recipients });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoValidateRecipients(recipients);
  }
}

/** Channels the merchant can actually send through, from the Sprint 10 registry. */
export async function getMarketingChannels(): Promise<ChannelPlatform[]> {
  try {
    return await apiGet<ChannelPlatform[]>(MARKETING + '/channels');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMarketingChannels();
  }
}

/* ---------------------------------------------------------------- campaigns */

export async function getCampaigns(params?: CampaignListParams): Promise<PagedCampaigns> {
  try {
    return await apiGet<PagedCampaigns>(
      MARKETING +
        '/campaigns' +
        toQuery({
          query: params?.query,
          status: params?.status,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCampaigns(params);
  }
}

export async function getCampaignDetail(campaignId: string): Promise<Campaign> {
  try {
    return await apiGet<Campaign>(MARKETING + '/campaigns/' + id(campaignId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCampaignById(campaignId);
  }
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  try {
    return await apiPost<Campaign>(MARKETING + '/campaigns', input);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateCampaign(input);
  }
}

export async function startCampaign(campaignId: string): Promise<Campaign> {
  try {
    return await apiPost<Campaign>(MARKETING + '/campaigns/' + id(campaignId) + '/start', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoStartCampaign(campaignId);
  }
}

export async function pauseCampaign(campaignId: string): Promise<Campaign> {
  try {
    return await apiPost<Campaign>(MARKETING + '/campaigns/' + id(campaignId) + '/pause', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoPauseCampaign(campaignId);
  }
}

export async function cancelCampaign(campaignId: string): Promise<Campaign> {
  try {
    return await apiPost<Campaign>(MARKETING + '/campaigns/' + id(campaignId) + '/cancel', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCancelCampaign(campaignId);
  }
}

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  try {
    return await apiGet<CampaignStats>(MARKETING + '/campaigns/' + id(campaignId) + '/stats');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCampaignById(campaignId).stats;
  }
}

export async function getCampaignRecords(campaignId: string, limit = 50): Promise<SendRecord[]> {
  try {
    return await apiGet<SendRecord[]>(
      MARKETING + '/campaigns/' + id(campaignId) + '/records' + toQuery({ limit })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCampaignRecords(campaignId, limit);
  }
}

/** One delivery reported by the throttled loop; keeps the detail page live. */
export async function recordSend(
  campaignId: string,
  recipient: Recipient,
  status: SendStatus,
  failureReason?: string
): Promise<SendRecord> {
  const payload = { recipient, status, failureReason };
  try {
    return await apiPost<SendRecord>(
      MARKETING + '/campaigns/' + id(campaignId) + '/records',
      payload
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRecordSend(campaignId, recipient, status, failureReason);
  }
}

export async function retryFailed(campaignId: string): Promise<number> {
  try {
    const result = await apiPost<{ retried: number }>(
      MARKETING + '/campaigns/' + id(campaignId) + '/retry',
      {}
    );
    return result.retried;
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRetryFailed(campaignId);
  }
}

/* ------------------------------------------------------------------ history */

export async function getSendHistory(params?: SendHistoryParams): Promise<PagedSendHistory> {
  try {
    return await apiGet<PagedSendHistory>(
      MARKETING +
        '/history' +
        toQuery({
          from: params?.from,
          to: params?.to,
          campaignId: params?.campaignId,
          limit: params?.limit,
          offset: params?.offset
        })
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSendHistory(params);
  }
}

export async function getMarketingOverview(): Promise<MarketingOverview> {
  try {
    return await apiGet<MarketingOverview>(MARKETING + '/overview');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMarketingOverview();
  }
}
