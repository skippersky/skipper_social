import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import { createMemoryHistory, createRouter } from 'vue-router';
import { resetWebSocketForTests } from '../composables/useWebSocket';
import { socketBus } from '../events/socket';
import InboxView from '../views/dashboard/conversations/index.vue';

async function mountInboxAt(path: string) {
  localStorage.clear();
  socketBus.clear();
  resetWebSocketForTests();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal('WebSocket', undefined);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } },
      { path: '/dashboard/customers/:id', component: { template: '<div />' } },
      { path: '/dashboard/conversations', component: InboxView }
    ]
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(InboxView, { global: { plugins: [createPinia(), router, Vant] } });
  await flushPromises();
  return { wrapper, router };
}

afterEach(() => {
  vi.unstubAllGlobals();
  socketBus.clear();
  resetWebSocketForTests();
});

describe('InboxView deep link from the customer profile', () => {
  it('preselects the thread named by the open query parameter', async () => {
    const { wrapper } = await mountInboxAt('/dashboard/conversations?open=i-3');

    expect(wrapper.find('.inbox__contact').text()).toBe('Grace Adeyemi');
    expect(wrapper.findAll('.msg').length).toBeGreaterThan(0);
    expect(wrapper.find('.inbox__placeholder').exists()).toBe(false);
  });

  it('marks the deep linked row as selected in the list', async () => {
    const { wrapper } = await mountInboxAt('/dashboard/conversations?open=i-2');

    const selected = wrapper.findAll('.conv-item.is-selected');
    expect(selected).toHaveLength(1);
    expect(selected[0].find('.conv-item__name').text()).toBe('Neema Wanjiru');
  });

  it('ignores an empty open parameter', async () => {
    const { wrapper } = await mountInboxAt('/dashboard/conversations?open=');

    expect(wrapper.find('.inbox__placeholder').exists()).toBe(true);
    expect(wrapper.findAll('.conv-item.is-selected')).toHaveLength(0);
  });

  it('keeps the placeholder without any query parameter', async () => {
    const { wrapper } = await mountInboxAt('/dashboard/conversations');

    expect(wrapper.find('.inbox__placeholder').exists()).toBe(true);
    expect(wrapper.find('.inbox__contact').exists()).toBe(false);
  });
});