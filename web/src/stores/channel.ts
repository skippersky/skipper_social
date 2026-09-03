import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as channelApi from '../api/channel';
import { apiErrorI18nKey } from '../api/http';
import {
  CHANNEL_CONNECTED,
  CHANNEL_DISCONNECTED,
  CHANNEL_STATUS_CHANGED,
  CHANNEL_TOKEN_REFRESHED,
  channelBus
} from '../events/channel';
import { getChannelProvider } from '../providers/ChannelProviderFactory';
import type { Channel, ChannelPlatform } from '../types';
import { useSubscriptionStore } from './subscription';

export type ConnectionStatus = 'idle' | 'connecting' | 'success' | 'error';

export const useChannelStore = defineStore('channel', () => {
  const channels = ref<Channel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const connectionStatus = ref<ConnectionStatus>('idle');

  const connectedCount = computed(() => channels.value.filter((c) => c.status === 'connected').length);

  /** Remaining connectable slots for the current plan (-1 quota means unlimited). */
  const availableSlots = computed(() => {
    const quota = useSubscriptionStore().currentPlan?.quotas.channels ?? 1;
    if (quota === -1) return Number.POSITIVE_INFINITY;
    return Math.max(0, quota - channels.value.length);
  });

  function getChannelByPlatform(platform: ChannelPlatform): Channel | null {
    return channels.value.find((c) => c.platform === platform) ?? null;
  }

  function isChannelConnected(platform: ChannelPlatform): boolean {
    return getChannelByPlatform(platform)?.status === 'connected';
  }

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  async function fetchChannels(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      channels.value = await channelApi.getChannels();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  /** Starts OAuth via the platform provider; returns the authorization URL. */
  async function connect(platform: ChannelPlatform): Promise<string | null> {
    connectionStatus.value = 'connecting';
    error.value = null;
    try {
      const result = await getChannelProvider(platform).connect();
      return result.authUrl;
    } catch (err) {
      connectionStatus.value = 'error';
      fail(err);
      return null;
    }
  }

  /** Finalizes OAuth from the callback page. */
  async function completeConnect(
    platform: ChannelPlatform,
    params: { code?: string; state?: string }
  ): Promise<Channel | null> {
    connectionStatus.value = 'connecting';
    error.value = null;
    try {
      const result = await channelApi.connectChannel(platform, params);
      if (!result.channel) throw new Error('missing channel in connect response');
      channels.value = [...channels.value.filter((c) => c.platform !== platform), result.channel];
      connectionStatus.value = 'success';
      channelBus.emit({ type: CHANNEL_CONNECTED, platform, channel: result.channel });
      return result.channel;
    } catch (err) {
      connectionStatus.value = 'error';
      fail(err);
      return null;
    }
  }

  async function disconnectChannel(channelId: string): Promise<boolean> {
    const channel = channels.value.find((c) => c.id === channelId);
    if (!channel) return false;
    loading.value = true;
    error.value = null;
    try {
      await getChannelProvider(channel.platform).disconnect(channelId);
      channels.value = channels.value.filter((c) => c.id !== channelId);
      channelBus.emit({ type: CHANNEL_DISCONNECTED, platform: channel.platform, channel });
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** Refreshes every channel token; failures mark the channel as needing re-auth. */
  async function refreshAllTokens(): Promise<void> {
    error.value = null;
    for (const channel of channels.value) {
      try {
        const result = await getChannelProvider(channel.platform).refreshToken(channel.id);
        channels.value = channels.value.map((c) =>
          c.id === channel.id ? { ...c, status: 'connected', tokenExpiresAt: result.tokenExpiresAt } : c
        );
        channelBus.emit({ type: CHANNEL_TOKEN_REFRESHED, platform: channel.platform });
      } catch (err) {
        channels.value = channels.value.map((c) =>
          c.id === channel.id ? { ...c, status: 'needs_reauth' } : c
        );
        channelBus.emit({ type: CHANNEL_STATUS_CHANGED, platform: channel.platform });
        fail(err);
      }
    }
  }

  return {
    channels,
    loading,
    error,
    connectionStatus,
    connectedCount,
    availableSlots,
    getChannelByPlatform,
    isChannelConnected,
    fetchChannels,
    connect,
    completeConnect,
    disconnectChannel,
    refreshAllTokens
  };
});