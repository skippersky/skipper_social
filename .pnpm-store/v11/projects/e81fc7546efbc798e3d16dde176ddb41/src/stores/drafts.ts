import localforage from 'localforage';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type DraftLocale = 'en' | 'sw';

export interface Draft {
  id: string;
  body: string;
  locale: DraftLocale;
  contentType: string;
  updatedAt: number;
}

const STORAGE_KEY = 'drafts';

export const useDraftsStore = defineStore('drafts', () => {
  const drafts = ref<Draft[]>([]);
  const store = localforage.createInstance({ name: 'kili-social' });

  const sorted = computed(() => [...drafts.value].sort((a, b) => b.updatedAt - a.updatedAt));

  async function load(): Promise<void> {
    const saved = await store.getItem<Record<string, Draft>>(STORAGE_KEY);
    drafts.value = Object.values(saved ?? {});
  }

  async function persist(map: Record<string, Draft>): Promise<void> {
    await store.setItem(STORAGE_KEY, map);
  }

  async function save(draft: Draft): Promise<void> {
    await load();
    const map: Record<string, Draft> = Object.fromEntries(drafts.value.map((d) => [d.id, d]));
    map[draft.id] = { ...draft };
    drafts.value = Object.values(map);
    await persist(map);
  }

  async function remove(id: string): Promise<void> {
    await load();
    const map: Record<string, Draft> = Object.fromEntries(drafts.value.map((d) => [d.id, d]));
    delete map[id];
    drafts.value = Object.values(map);
    await persist(map);
  }

  function get(id: string): Draft | undefined {
    return drafts.value.find((d) => d.id === id);
  }

  return { drafts: sorted, load, save, remove, get };
});
