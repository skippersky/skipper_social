import type { ChannelPlatform } from '../types';
import { FacebookProvider } from './FacebookProvider';
import { InstagramProvider } from './InstagramProvider';
import { TikTokProvider } from './TikTokProvider';
import { WhatsAppProvider } from './WhatsAppProvider';
import type { ChannelProvider } from './types';

const registry = new Map<ChannelPlatform, ChannelProvider>();

/** Registers (or replaces) the provider for a platform; enables custom providers. */
export function registerChannelProvider(provider: ChannelProvider): void {
  registry.set(provider.platform, provider);
}

export function getChannelProvider(platform: ChannelPlatform): ChannelProvider {
  const provider = registry.get(platform);
  if (!provider) {
    throw new Error(`No channel provider registered for platform: ${platform}`);
  }
  return provider;
}

export const ChannelProviderFactory = {
  get: getChannelProvider,
  register: registerChannelProvider
};

registerChannelProvider(new WhatsAppProvider());
registerChannelProvider(new FacebookProvider());
registerChannelProvider(new InstagramProvider());
registerChannelProvider(new TikTokProvider());