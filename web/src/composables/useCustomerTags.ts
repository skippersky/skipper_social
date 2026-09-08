import { computed } from 'vue';
import { useTagStore } from '../stores/tag';
import type { Tag } from '../types';

/** Tag catalogue management plus customer tag assignment. */
export function useCustomerTags() {
  const store = useTagStore();

  const tags = computed(() => store.tags);
  const loading = computed(() => store.loading);
  const error = computed(() => store.error);

  async function loadTags(): Promise<void> {
    await store.fetchTags();
  }

  async function createTag(name: string, color: string): Promise<Tag | null> {
    return store.createTag(name, color);
  }

  async function updateTag(id: string, patch: { name?: string; color?: string }): Promise<boolean> {
    return store.updateTag(id, patch);
  }

  async function deleteTag(id: string): Promise<boolean> {
    return store.deleteTag(id);
  }

  async function assignTag(customerId: string, tagId: string): Promise<boolean> {
    return store.assignTag(customerId, tagId);
  }

  async function removeTag(customerId: string, tagId: string): Promise<boolean> {
    return store.removeTag(customerId, tagId);
  }

  return { tags, loading, error, loadTags, createTag, updateTag, deleteTag, assignTag, removeTag };
}