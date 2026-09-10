import { apiGet } from './http';
import {
  demoAgentPerformance,
  demoAnalyticsOverview,
  demoChannelDistribution,
  demoConversationTrend,
  demoMessageTrend,
  demoResponseTime,
  demoTopCustomers,
  isMissingBackend
} from './demo';
import type {
  AgentPerformance,
  ChannelSlice,
  DateRange,
  OverviewStats,
  ResponseTimeStats,
  TopCustomer,
  TrendGranularity,
  TrendPoint
} from '../types';

const ANALYTICS = '/api/v1/analytics';
const DAY_MS = 86_400_000;

export interface AnalyticsParams {
  range?: DateRange;
  granularity?: TrendGranularity;
  limit?: number;
}

/** Trailing 30 days, used when a caller does not pass an explicit window. */
export function fallbackRange(now = Date.now()): DateRange {
  return { from: now - 29 * DAY_MS, to: now, preset: '30d' };
}

function toQuery(params?: AnalyticsParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  const range = params.range;
  if (range) {
    search.set('from', String(range.from));
    search.set('to', String(range.to));
  }
  if (params.granularity) search.set('granularity', params.granularity);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function getOverviewStats(params?: AnalyticsParams): Promise<OverviewStats> {
  const range = params?.range ?? fallbackRange();
  try {
    return await apiGet<OverviewStats>(`${ANALYTICS}/overview${toQuery({ ...params, range })}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoAnalyticsOverview(range);
  }
}

export async function getConversationTrend(params: AnalyticsParams): Promise<TrendPoint[]> {
  const range = params.range ?? fallbackRange();
  const granularity = params.granularity ?? 'day';
  try {
    return await apiGet<TrendPoint[]>(
      `${ANALYTICS}/conversations/trend${toQuery({ ...params, range, granularity })}`
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoConversationTrend(range, granularity);
  }
}

export async function getMessageTrend(params: AnalyticsParams): Promise<TrendPoint[]> {
  const range = params.range ?? fallbackRange();
  const granularity = params.granularity ?? 'day';
  try {
    return await apiGet<TrendPoint[]>(
      `${ANALYTICS}/messages/trend${toQuery({ ...params, range, granularity })}`
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoMessageTrend(range, granularity);
  }
}

export async function getChannelDistribution(params?: AnalyticsParams): Promise<ChannelSlice[]> {
  const range = params?.range ?? fallbackRange();
  try {
    return await apiGet<ChannelSlice[]>(`${ANALYTICS}/channels/distribution${toQuery({ ...params, range })}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoChannelDistribution(range);
  }
}

export async function getResponseTimeStats(params?: AnalyticsParams): Promise<ResponseTimeStats> {
  const range = params?.range ?? fallbackRange();
  try {
    return await apiGet<ResponseTimeStats>(`${ANALYTICS}/response-time${toQuery({ ...params, range })}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoResponseTime(range);
  }
}

export async function getAgentPerformance(params?: AnalyticsParams): Promise<AgentPerformance[]> {
  const range = params?.range ?? fallbackRange();
  try {
    return await apiGet<AgentPerformance[]>(`${ANALYTICS}/agents/performance${toQuery({ ...params, range })}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoAgentPerformance(range);
  }
}

export async function getTopCustomers(params?: AnalyticsParams): Promise<TopCustomer[]> {
  const range = params?.range ?? fallbackRange();
  const limit = params?.limit ?? 5;
  try {
    return await apiGet<TopCustomer[]>(`${ANALYTICS}/customers/top${toQuery({ ...params, range, limit })}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoTopCustomers(range, limit);
  }
}
