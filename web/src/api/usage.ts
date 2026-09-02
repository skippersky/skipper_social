import { apiGet } from './http';
import { demoUsage, demoUsageHistory, isMissingBackend, readDemoSubscriptionRecord } from './demo';
import type { UsageRecord, UsageSnapshot } from '../types';

const USAGE = '/api/v1/usage';

export async function getUsage(): Promise<UsageSnapshot> {
  try {
    return await apiGet<UsageSnapshot>(USAGE);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUsage(readDemoSubscriptionRecord().planId);
  }
}

export async function getUsageHistory(period = '14d'): Promise<UsageRecord[]> {
  try {
    return await apiGet<UsageRecord[]>(`${USAGE}/history?period=${encodeURIComponent(period)}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUsageHistory(readDemoSubscriptionRecord().planId);
  }
}