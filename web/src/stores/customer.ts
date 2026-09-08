import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as customerApi from '../api/customer';
import type { CustomerListParams } from '../api/customer';
import { apiErrorI18nKey } from '../api/http';
import type {
  ChannelPlatform,
  Conversation,
  Customer,
  CustomerFilters,
  CustomerInput,
  Tag
} from '../types';

const DEFAULT_FILTERS: CustomerFilters = { query: '', tagId: 'all', channel: 'all' };
const PAGE_LIMIT = 20;

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref<Customer[]>([]);
  const currentCustomer = ref<Customer | null>(null);
  const conversationsByCustomer = ref<Record<string, Conversation[]>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<CustomerFilters>({ ...DEFAULT_FILTERS });
  const total = ref(0);
  const hasMore = ref(false);
  const offset = ref(0);

  const filteredCustomers = computed(() => {
    const query = filters.value.query.trim().toLowerCase();
    return customers.value.filter((customer) => {
      if (filters.value.tagId !== 'all' && !customer.tags.some((tag) => tag.id === filters.value.tagId)) {
        return false;
      }
      if (filters.value.channel !== 'all' && !customer.channels.includes(filters.value.channel as ChannelPlatform)) {
        return false;
      }
      if (query) {
        const haystack = `${customer.name} ${customer.phone ?? ''} ${customer.email ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  });

  const customerCount = computed(() => total.value || customers.value.length);

  const currentCustomerConversations = computed(() =>
    currentCustomer.value ? conversationsByCustomer.value[currentCustomer.value.id] ?? [] : []
  );

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function listParams(offset = 0): CustomerListParams {
    const params: CustomerListParams = { limit: PAGE_LIMIT, offset };
    if (filters.value.query) params.query = filters.value.query;
    if (filters.value.tagId !== 'all') params.tagId = filters.value.tagId;
    if (filters.value.channel !== 'all') params.channel = filters.value.channel;
    return params;
  }

  async function fetchCustomers(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await customerApi.getCustomers(listParams());
      customers.value = page.customers;
      total.value = page.total;
      hasMore.value = page.hasMore;
      offset.value = page.customers.length;
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreCustomers(): Promise<void> {
    if (!hasMore.value || loading.value) return;
    loading.value = true;
    try {
      const page = await customerApi.getCustomers(listParams(offset.value));
      const known = new Set(customers.value.map((customer) => customer.id));
      customers.value = [
        ...customers.value,
        ...page.customers.filter((customer) => !known.has(customer.id))
      ];
      total.value = page.total;
      hasMore.value = page.hasMore;
      offset.value += page.customers.length;
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchCustomer(id: string): Promise<Customer | null> {
    loading.value = true;
    error.value = null;
    try {
      currentCustomer.value = await customerApi.getCustomerById(id);
      return currentCustomer.value;
    } catch (err) {
      currentCustomer.value = null;
      fail(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createCustomer(input: CustomerInput): Promise<boolean> {
    error.value = null;
    try {
      const created = await customerApi.createCustomer(input);
      customers.value = [created, ...customers.value];
      total.value += 1;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function updateCustomer(id: string, input: CustomerInput): Promise<boolean> {
    error.value = null;
    try {
      const saved = await customerApi.updateCustomer(id, input);
      customers.value = customers.value.map((customer) => (customer.id === id ? saved : customer));
      if (currentCustomer.value?.id === id) currentCustomer.value = saved;
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function deleteCustomer(id: string): Promise<boolean> {
    error.value = null;
    try {
      await customerApi.deleteCustomer(id);
      customers.value = customers.value.filter((customer) => customer.id !== id);
      if (currentCustomer.value?.id === id) currentCustomer.value = null;
      total.value = Math.max(0, total.value - 1);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function loadCustomerConversations(id: string): Promise<Conversation[]> {
    try {
      const list = await customerApi.getCustomerConversations(id);
      conversationsByCustomer.value = { ...conversationsByCustomer.value, [id]: list };
      return list;
    } catch (err) {
      fail(err);
      return [];
    }
  }

  function setFilters(patch: Partial<CustomerFilters>): void {
    filters.value = { ...filters.value, ...patch };
  }

  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS };
  }

  /** Keeps a customer's embedded tag list in sync after tag operations. */
  function patchCustomerTags(id: string, tags: Tag[]): void {
    customers.value = customers.value.map((customer) =>
      customer.id === id ? { ...customer, tags } : customer
    );
    if (currentCustomer.value?.id === id) {
      currentCustomer.value = { ...currentCustomer.value, tags };
    }
  }

  return {
    customers,
    currentCustomer,
    conversationsByCustomer,
    loading,
    error,
    filters,
    total,
    hasMore,
    filteredCustomers,
    customerCount,
    currentCustomerConversations,
    fetchCustomers,
    loadMoreCustomers,
    fetchCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    loadCustomerConversations,
    setFilters,
    resetFilters,
    patchCustomerTags
  };
});