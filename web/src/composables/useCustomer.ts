import { computed, ref, type Ref } from 'vue';
import * as customerApi from '../api/customer';
import { useCustomerStore } from '../stores/customer';
import type { Customer, CustomerInput, CustomerStats } from '../types';

/** Single-customer operations: detail, stats, conversation history, edit, delete. */
export function useCustomer(customerId: Ref<string | null>) {
  const store = useCustomerStore();

  const customer = computed(() => store.currentCustomer);
  const conversations = computed(() =>
    customerId.value ? store.conversationsByCustomer[customerId.value] ?? [] : []
  );
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);
  const stats = ref<CustomerStats | null>(null);

  async function loadCustomer(): Promise<Customer | null> {
    if (!customerId.value) return null;
    return store.fetchCustomer(customerId.value);
  }

  async function loadCustomerStats(): Promise<void> {
    if (!customerId.value) return;
    try {
      stats.value = await customerApi.getCustomerStats(customerId.value);
    } catch {
      stats.value = null;
    }
  }

  async function loadCustomerConversations(): Promise<void> {
    if (!customerId.value) return;
    await store.loadCustomerConversations(customerId.value);
  }

  async function loadAll(): Promise<void> {
    await Promise.all([loadCustomer(), loadCustomerStats(), loadCustomerConversations()]);
  }

  async function updateCustomer(input: CustomerInput): Promise<boolean> {
    if (!customer.value) return false;
    return store.updateCustomer(customer.value.id, input);
  }

  async function deleteCustomer(): Promise<boolean> {
    if (!customer.value) return false;
    return store.deleteCustomer(customer.value.id);
  }

  return {
    customer,
    stats,
    conversations,
    loading,
    error,
    loadCustomer,
    loadCustomerStats,
    loadCustomerConversations,
    loadAll,
    updateCustomer,
    deleteCustomer
  };
}