import type { AuthResult, ChannelPlatform, ChannelStatus, TokenResult } from '../types';

/** One input of the manual credential form for a platform. */
export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  required: boolean;
  helpText?: string;
}

/**
 * Strategy interface: one implementation per platform.
 * `refreshToken` / `getStatus` take the channel id because a single provider
 * instance serves every connected channel of its platform.
 */
export interface ChannelProvider {
  readonly platform: ChannelPlatform;
  /** Fields the user must fill for manual (credential) connection. */
  getRequiredCredentials(): CredentialField[];
  /**
   * Without credentials starts OAuth; with credentials connects manually.
   * Resolves with the authorization URL, or the channel when the backend
   * accepted the credentials directly.
   */
  connect(credentials?: Record<string, string>): Promise<AuthResult>;
  /** Disconnects a channel and clears its tokens server-side. */
  disconnect(channelId: string): Promise<void>;
  /** Refreshes the channel token; rejects when re-authorization is required. */
  refreshToken(channelId: string): Promise<TokenResult>;
  /** Reads the current channel status. */
  getStatus(channelId: string): Promise<ChannelStatus>;
}