import { apiDelete, apiGet, apiPost, apiPut } from './http';
import {
  demoCreateCustomer,
  demoCustomerById,
  demoCustomerConversations,
  demoCustomers,
  demoCustomerStats,
  demoDeleteCustomer,
  demoUpdateCustomer,
  isMissingBackend
} from './demo';
import type {
  Conversation,
  Customer,
  CustomerInput,
  CustomerStats,
  PagedCustomers
} from '../types';

const CUSTOMERS = '/api/v1/customers';

export interface CustomerListParams {
  query?: string;
  tagId?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

function toQuery(params?: CustomerListParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.tagId && params.tagId !== 'all') search.set('tag', params.tagId);
  if (params.channel && params.channel !== 'all') search.set('channel', params.channel);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function getCustomers(params?: CustomerListParams): Promise<PagedCustomers> {
  try {
    return await apiGet<PagedCustomers>(`${CUSTOMERS}${toQuery(params)}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCustomers(params);
  }
}

export async function getCustomerById(id: string): Promise<Customer> {
  try {
    return await apiGet<Customer>(`${CUSTOMERS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCustomerById(id);
  }
}

export async function createCustomer(data: CustomerInput): Promise<Customer> {
  try {
    return await apiPost<Customer>(CUSTOMERS, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateCustomer(data);
  }
}

export async function updateCustomer(id: string, data: CustomerInput): Promise<Customer> {
  try {
    return await apiPut<Customer>(`${CUSTOMERS}/${id}`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateCustomer(id, data);
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  try {
    await apiDelete<void>(`${CUSTOMERS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    demoDeleteCustomer(id);
  }
}

export async function getCustomerConversations(
  id: string,
  params?: CustomerListParams
): Promise<Conversation[]> {
  try {
    return await apiGet<Conversation[]>(`${CUSTOMERS}/${id}/conversations${toQuery(params)}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCustomerConversations(id);
  }
}

export async function getCustomerStats(id: string): Promise<CustomerStats> {
  try {
    return await apiGet<CustomerStats>(`${CUSTOMERS}/${id}/stats`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCustomerStats(id);
  }
}