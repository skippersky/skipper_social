import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import DraftsView from '../views/DraftsView.vue';
import { useDraftsStore } from '../stores/drafts';

describe('DraftsView', () => {
  it('lists drafts and deletes them', async () => {
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/editor', component: { template: '<div />' } },
        { path: '/drafts', component: DraftsView }
      ]
    });
    router.push('/drafts');
    await router.isReady();

    const store = useDraftsStore(pinia);
    await store.save({ id: 'a', body: 'hello draft', locale: 'en', contentType: 'social_post', updatedAt: 1 });

    const wrapper = mount(DraftsView, { global: { plugins: [pinia, router, Vant] } });
    await store.load();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('hello draft');

    await wrapper.findAll('button').filter((b) => b.text().includes('Delete')).at(0)!.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain('hello draft');
  });

  it('back button returns to home', async () => {
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/drafts', component: DraftsView }
      ]
    });
    router.push('/drafts');
    await router.isReady();

    const wrapper = mount(DraftsView, { global: { plugins: [pinia, router, Vant] } });
    await wrapper.vm.$nextTick();

    await wrapper.find('.page__home').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe('/');
  });
});
