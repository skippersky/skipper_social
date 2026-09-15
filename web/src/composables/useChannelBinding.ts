import { computed, ref } from 'vue';
import { getChannelProvider } from '../providers';
import { useSettingsStore } from '../stores/settings';
import { validateCredentials } from '../lib/settingsValidation';
import type { ValidationErrors } from '../lib/settingsValidation';
import type { CredentialField } from '../providers/types';
import { CHANNEL_PLATFORMS } from '../types';
import type {
  BindChannelRequest,
  ChannelAccount,
  ChannelPlatform,
  ChannelTestResult
} from '../types';

/**
 * Channel tab state. Rows come from the shared Sprint 5b registry, so binding
 * here and connecting on /dashboard/channels always show the same account.
 */
export function useChannelBinding() {
  const store = useSettingsStore();
  const selectedPlatform = ref<ChannelPlatform | null>(null);

  const channels = computed(() => store.channelAccounts);
  const testResults = computed(() => store.channelTests);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const boundPlatforms = computed(() => channels.value.map((channel) => channel.platform));
  const availablePlatforms = computed(() =>
    CHANNEL_PLATFORMS.filter((platform) => !boundPlatforms.value.includes(platform))
  );

  function credentialFields(platform: ChannelPlatform | null): CredentialField[] {
    return platform ? getChannelProvider(platform).getRequiredCredentials() : [];
  }

  function validate(
    fields: CredentialField[],
    values: Record<string, string>
  ): ValidationErrors {
    return validateCredentials(fields, values);
  }

  function getChannel(channelId: string): ChannelAccount | null {
    return store.getChannelAccount(channelId);
  }

  function testResult(channelId: string): ChannelTestResult | null {
    return testResults.value[channelId] ?? null;
  }

  async function loadChannelAccounts(): Promise<ChannelAccount[]> {
    return store.fetchChannelAccounts();
  }

  async function bindChannel(data: BindChannelRequest): Promise<ChannelAccount | null> {
    const bound = await store.bindChannel(data);
    if (bound) selectedPlatform.value = null;
    return bound;
  }

  async function unbindChannel(channelId: string): Promise<boolean> {
    return store.unbindChannel(channelId);
  }

  async function testConnection(channelId: string): Promise<ChannelTestResult | null> {
    return store.testChannelConnection(channelId);
  }

  return {
    store,
    selectedPlatform,
    channels,
    testResults,
    loading,
    saving,
    error,
    boundPlatforms,
    availablePlatforms,
    credentialFields,
    validate,
    getChannel,
    testResult,
    loadChannelAccounts,
    bindChannel,
    unbindChannel,
    testConnection
  };
}
