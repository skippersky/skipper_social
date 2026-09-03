import { apiDelete, apiGet, apiPost, ApiError } from './http';
import {
  demoChannelById,
  demoChannels,
  demoConnect,
  demoDisconnect,
  demoRefreshToken,
  isMissingBackend
} from './demo';
import type {
  Channel,
  ChannelPlatform,
  ConnectResult,
  OAuthCallbackParams,
  TokenResult
} from '../types';

const CHANNELS = '/api/v1/channels';

export async function getChannels(): Promise<Channel[]> {
  try {
    return await apiGet<Channel[]>(CHANNELS);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoChannels();
  }
}

export async function getChannelById(id: string): Promise<Channel> {
  try {
    return await apiGet<Channel>(`${CHANNELS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    const channel = demoChannelById(id);
    if (!channel) throw new ApiError('NOT_FOUND', 'channel not found');
    return channel;
  }
}

/**
 * Without `params.code` this starts OAuth and returns the authorization URL;
 * with a code it finalizes the authorization and returns the channel.
 */
export async function connectChannel(
  platform: ChannelPlatform,
  params: OAuthCallbackParams = {}
): Promise<ConnectResult> {
  try {
    return await apiPost<ConnectResult>(`${CHANNELS}/${platform}/connect`, params);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoConnect(platform, params);
  }
}

export async function disconnectChannel(id: string): Promise<void> {
  try {
    await apiDelete<void>(`${CHANNELS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDisconnect(id);
  }
}

export async function refreshChannelToken(id: string): Promise<TokenResult> {
  try {
    return await apiPost<TokenResult>(`${CHANNELS}/${id}/refresh`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoRefreshToken(id);
  }
}