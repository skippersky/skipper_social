import { computed } from 'vue';
import { useCustomerStore } from '../stores/customer';
import type { ChannelPlatform, Customer, CustomerFilters } from '../types';

/** Customer directory browsing: search, tag/channel filters and paging. */
export function useCustomerList() {
  const store = useCustomerStore();

  const customers = computed(() => store.filteredCustomers);
  const loading = computed(() => store.loading);
  const hasMore = computed(() => store.hasMore);
  const total = computed(() => store.customerCount);
  const filters = computed(() => store.filters);

  async function applyFilters(patch: Partial<CustomerFilters>): Promise<void> {
    store.setFilters(patch);
    await store.fetchCustomers();
  }

  async function search(query: string): Promise<void> {
    await applyFilters({ query });
  }

  async function filterByTag(tagId: string | 'all'): Promise<void> {
    await applyFilters({ tagId });
  }

  async function filterByChannel(channel: 'all' | ChannelPlatform): Promise<void> {
    await applyFilters({ channel });
  }

  async function loadMore(): Promise<void> {
    await store.loadMoreCustomers();
  }

  async function refresh(): Promise<void> {
    await store.fetchCustomers();
  }

  function findCustomer(id: string): Customer | null {
    return store.customers.find((customer) => customer.id === id) ?? null;
  }

  return { customers, loading, hasMore, total, filters, search, filterByTag, filterByChannel, loadMore, refresh, findCustomer };
}