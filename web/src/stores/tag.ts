import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as tagApi from '../api/tag';
import { apiErrorI18nKey } from '../api/http';
import { useCustomerStore } from './customer';
import type { Customer, Tag } from '../types';

export const useTagStore = defineStore('tag', () => {
  const tags = ref<Tag[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const tagsByColor = computed(() => {
    const map: Record<string, Tag[]> = {};
    for (const tag of tags.value) {
      map[tag.color] = [...(map[tag.color] ?? []), tag];
    }
    return map;
  });

  const tagCount = computed(() => tags.value.length);

  function fail(err: unknown): void {
    error.value = apiErrorI18nKey(err);
  }

  function findCustomer(customerId: string): Customer | null {
    const customerStore = useCustomerStore();
    return (
      customerStore.customers.find((customer) => customer.id === customerId) ??
      (customerStore.currentCustomer?.id === customerId ? customerStore.currentCustomer : null)
    );
  }

  function syncCustomerTags(customerId: string, next: Tag[]): void {
    useCustomerStore().patchCustomerTags(customerId, next);
  }

  async function fetchTags(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      tags.value = await tagApi.getTags();
    } catch (err) {
      fail(err);
    } finally {
      loading.value = false;
    }
  }

  async function createTag(name: string, color: string): Promise<Tag | null> {
    error.value = null;
    try {
      const tag = await tagApi.createTag({ name, color });
      tags.value = [...tags.value, tag];
      return tag;
    } catch (err) {
      fail(err);
      return null;
    }
  }

  async function updateTag(id: string, patch: { name?: string; color?: string }): Promise<boolean> {
    error.value = null;
    try {
      const saved = await tagApi.updateTag(id, patch);
      tags.value = tags.value.map((tag) => (tag.id === id ? saved : tag));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function deleteTag(id: string): Promise<boolean> {
    error.value = null;
    try {
      await tagApi.deleteTag(id);
      tags.value = tags.value.filter((tag) => tag.id !== id);
      // Customers lose this tag locally as well.
      const customerStore = useCustomerStore();
      customerStore.customers = customerStore.customers.map((customer) => ({
        ...customer,
        tags: customer.tags.filter((tag) => tag.id !== id)
      }));
      if (customerStore.currentCustomer) {
        customerStore.currentCustomer = {
          ...customerStore.currentCustomer,
          tags: customerStore.currentCustomer.tags.filter((tag) => tag.id !== id)
        };
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function assignTag(customerId: string, tagId: string): Promise<boolean> {
    error.value = null;
    try {
      await tagApi.assignTag(customerId, tagId);
      const tag = tags.value.find((candidate) => candidate.id === tagId);
      const customer = findCustomer(customerId);
      if (tag && customer && !customer.tags.some((t) => t.id === tagId)) {
        syncCustomerTags(customerId, [...customer.tags, tag]);
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  async function removeTag(customerId: string, tagId: string): Promise<boolean> {
    error.value = null;
    try {
      await tagApi.removeTag(customerId, tagId);
      const customer = findCustomer(customerId);
      if (customer) {
        syncCustomerTags(customerId, customer.tags.filter((tag) => tag.id !== tagId));
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  return {
    tags,
    loading,
    error,
    tagsByColor,
    tagCount,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    assignTag,
    removeTag
  };
});