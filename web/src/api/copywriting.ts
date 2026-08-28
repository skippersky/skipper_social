import { apiPost } from './http';

export const CONTENT_UNAVAILABLE = '[CONTENT_UNAVAILABLE]';

export interface CopywritingRequest {
  locale: string;
  contentType: string;
  variables: Record<string, string>;
}

export function generateCopywriting(request: CopywritingRequest): Promise<string> {
  return apiPost<string>('/api/v1/ai/copywriting', request);
}
