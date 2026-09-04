import { apiGet, apiPost } from './http';
import { demoApplyTemplate, demoGenerateReply, demoQuickTemplates, isMissingBackend } from './demo';
import type { AiReplySuggestion, QuickReplyTemplate } from '../types';

export async function generateReply(
  conversationId: string,
  context?: string
): Promise<AiReplySuggestion> {
  try {
    return await apiPost<AiReplySuggestion>('/api/v1/ai/reply', { conversationId, context });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoGenerateReply(conversationId);
  }
}

export async function getQuickTemplates(): Promise<QuickReplyTemplate[]> {
  try {
    return await apiGet<QuickReplyTemplate[]>('/api/v1/ai/templates');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoQuickTemplates();
  }
}

export async function applyTemplate(templateId: string): Promise<{ text: string }> {
  try {
    return await apiPost<{ text: string }>(`/api/v1/ai/templates/${templateId}/apply`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoApplyTemplate(templateId);
  }
}