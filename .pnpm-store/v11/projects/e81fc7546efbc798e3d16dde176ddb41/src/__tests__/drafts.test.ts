import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDraftsStore } from '../stores/drafts';

describe('drafts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('saves and lists drafts sorted by updatedAt desc', async () => {
    const store = useDraftsStore();
    await store.save({ id: 'a', body: 'first', locale: 'en', contentType: 'social_post', updatedAt: 1 });
    await store.save({ id: 'b', body: 'second', locale: 'sw', contentType: 'social_post', updatedAt: 2 });

    expect(store.drafts.map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('persists across load', async () => {
    const store = useDraftsStore();
    await store.save({ id: 'a', body: 'x', locale: 'en', contentType: 'social_post', updatedAt: 1 });

    await store.load();
    expect(store.get('a')?.body).toBe('x');
  });

  it('removes a draft', async () => {
    const store = useDraftsStore();
    await store.save({ id: 'a', body: 'x', locale: 'en', contentType: 'social_post', updatedAt: 1 });

    await store.remove('a');
    expect(store.get('a')).toBeUndefined();
  });
});
