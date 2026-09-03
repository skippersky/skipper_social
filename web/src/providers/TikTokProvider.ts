import * as channelApi from '../api/channel';
import type { AuthResult, ChannelStatus, TokenResult } from '../types';
import type { ChannelProvider, CredentialField } from './types';

export class TikTokProvider implements ChannelProvider {
  readonly platform = 'tiktok' as const;

  getRequiredCredentials(): CredentialField[] {
    return [
      { key: 'client_key', label: 'Client Key', type: 'text', placeholder: 'e.g. awxxxxxxxxxxxx', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '********', required: true }
    ];
  }

  connect(credentials?: Record<string, string>): Promise<AuthResult> {
    return channelApi
      .connectChannel(this.platform, credentials ? { credentials } : {})
      .then((result) => ({
        authUrl: result.authUrl ?? '',
        channel: result.channel,
        demo: result.channel === undefined && result.authUrl?.startsWith('/')
      }));
  }

  disconnect(channelId: string): Promise<void> {
    return channelApi.disconnectChannel(channelId);
  }

  refreshToken(channelId: string): Promise<TokenResult> {
    return channelApi.refreshChannelToken(channelId);
  }

  async getStatus(channelId: string): Promise<ChannelStatus> {
    const channel = await channelApi.getChannelById(channelId);
    return channel.status;
  }
}