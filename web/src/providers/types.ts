import type { AuthResult, ChannelPlatform, ChannelStatus, TokenResult } from '../types';

/**
 * Strategy interface: one implementation per platform.
 * `refreshToken` / `getStatus` take the channel id because a single provider
 * instance serves every connected channel of its platform.
 */
export interface ChannelProvider {
  readonly platform: ChannelPlatform;
  /** Starts OAuth; resolves with the authorization URL to open. */
  connect(): Promise<AuthResult>;
  /** Disconnects a channel and clears its tokens server-side. */
  disconnect(channelId: string): Promise<void>;
  /** Refreshes the channel token; rejects when re-authorization is required. */
  refreshToken(channelId: string): Promise<TokenResult>;
  /** Reads the current channel status. */
  getStatus(channelId: string): Promise<ChannelStatus>;
}