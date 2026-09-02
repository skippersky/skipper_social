import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { apiErrorI18nKey } from '../api/http';
import * as usageApi from '../api/usage';
import type { UsageRecord, UsageSnapshot } from '../types';
import { useSubscriptionStore } from './subscription';

type UsageMetric = 'aiGenerations' | 'messages' | 'scheduledPosts';

export const useUsageStore = defineStore('usage', () => {
  const usage = ref<UsageSnapshot | null>(null);
  const history = ref<UsageRecord[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function quotaOf(metric: UsageMetric): number {
    return useSubscriptionStore().currentPlan?.quotas[metric] ?? 0;
  }

  function percentOf(metric: UsageMetric): number {
    const limit = quotaOf(metric);
    if (limit <= 0) return 0;
    const used = usage.value?.[metric] ?? 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  const aiUsagePercent = computed(() => percentOf('aiGenerations'));
  const messageUsagePercent = computed(() => percentOf('messages'));
  const distributeUsagePercent = computed(() => percentOf('scheduledPosts'));
  const isNearLimit = computed(
    () => [aiUsagePercent.value, messageUsagePercent.value, distributeUsagePercent.value].some((p) => p >= 80)
  );
  const isOverLimit = computed(
    () => [aiUsagePercent.value, messageUsagePercent.value, distributeUsagePercent.value].some((p) => p >= 100)
  );

  async function fetchUsage(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      usage.value = await usageApi.getUsage();
    } catch (err) {
      error.value = apiErrorI18nKey(err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchUsageHistory(period = '14d'): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      history.value = await usageApi.getUsageHistory(period);
    } catch (err) {
      error.value = apiErrorI18nKey(err);
    } finally {
      loading.value = false;
    }
  }

  return {
    usage,
    history,
    loading,
    error,
    aiUsagePercent,
    messageUsagePercent,
    distributeUsagePercent,
    isNearLimit,
    isOverLimit,
    fetchUsage,
    fetchUsageHistory
  };
});