import { apiGet, apiPost } from './http';
import { demoRegisterWebhook, demoWebhookStatus, isMissingBackend } from './demo';
import type { ChannelPlatform, WebhookStatus } from '../types';

const WEBHOOKS = '/api/v1/webhooks';

export async function getWebhookStatus(platform: ChannelPlatform): Promise<WebhookStatus> {
  try {
    return await apiGet<WebhookStatus>(`${WEBHOOKS}/${platform}/status`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoWebhookStatus(platform);
  }
}

export async function registerWebhook(platform: ChannelPlatform, url: string): Promise<WebhookStatus> {
  try {
    return await apiPost<WebhookStatus>(`${WEBHOOKS}/${platform}`, { url });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRegisterWebhook(platform, url);
  }
}