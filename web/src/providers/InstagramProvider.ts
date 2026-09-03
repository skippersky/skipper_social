import * as channelApi from '../api/channel';
import type { AuthResult, ChannelStatus, TokenResult } from '../types';
import type { ChannelProvider, CredentialField } from './types';

export class InstagramProvider implements ChannelProvider {
  readonly platform = 'instagram' as const;

  getRequiredCredentials(): CredentialField[] {
    return [
      { key: 'instagram_business_account_id', label: 'Business Account ID', type: 'text', placeholder: 'e.g. 17841400000000000', required: true },
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAAB...', required: true }
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