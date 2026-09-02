import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import EditorView from '../views/EditorView.vue';
import { useDraftsStore } from '../stores/drafts';
vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/editor', component: EditorView },
      { path: '/drafts', component: { template: '<div />' } }
    ]
  });
}

async function mountEditor() {
  const router = makeRouter();
  router.push('/editor');
  await router.isReady();
  const pinia = createPinia();
  const wrapper = mount(EditorView, { global: { plugins: [pinia, router, Vant] } });
  return { wrapper, pinia, router };
}

function stubAi(data: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, code: 'OK', message: 'ok', data })
  }));
}

describe('EditorView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ai success replaces the body', async () => {
    stubAi('generated copy');
    const { wrapper } = await mountEditor();
    await wrapper.find('textarea').setValue('tea');

    await wrapper.findAll('button').filter((b) => b.text().includes('AI')).at(0)!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('generated copy');
  });

  it('ai unavailable keeps the body', async () => {
    stubAi('[CONTENT_UNAVAILABLE]');
    const { wrapper } = await mountEditor();
    await wrapper.find('textarea').setValue('tea');

    await wrapper.findAll('button').filter((b) => b.text().includes('AI')).at(0)!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('tea');
  });

  it('saves a draft into the store', async () => {
    const { wrapper, pinia } = await mountEditor();
    await wrapper.find('textarea').setValue('my draft');

    await wrapper.findAll('button').filter((b) => b.text().includes('Save')).at(0)!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useDraftsStore(pinia).drafts).toHaveLength(1);
  });

  it('back button returns to home', async () => {
    const { wrapper, router } = await mountEditor();

    await wrapper.find('.page__home').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/');
  });
});
