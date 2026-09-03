import * as channelApi from '../api/channel';
import type { AuthResult, ChannelStatus, TokenResult } from '../types';
import type { ChannelProvider } from './types';

export class WhatsAppProvider implements ChannelProvider {
  readonly platform = 'whatsapp' as const;

  connect(): Promise<AuthResult> {
    return channelApi.connectChannel(this.platform).then((result) => ({
      authUrl: result.authUrl ?? '',
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