import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Vant from 'vant';
import App from '../App.vue';
import { DEMO_CREDENTIALS } from '../api/auth';
import { resetWebSocketForTests } from '../composables/useWebSocket';
import { useAuthStore } from '../stores/auth';

const stub = { template: '<div />' };
const liveWrappers: VueWrapper[] = [];

/**
 * jsdom has no transport, so the authenticated shell gets an inert stand-in.
 * It never fires onopen/onclose, which keeps reconnect timers out of the suite.
 */
class FakeWebSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {}
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
}

async function mountAt(path: string, options: { authenticated?: boolean } = {}) {
  const pinia = createPinia();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/editor', component: stub },
      { path: '/drafts', component: stub },
      { path: '/chat', component: stub },
      { path: '/login', component: stub },
      { path: '/settings/profile', component: stub },
      { path: '/settings/security', component: stub },
      { path: '/dashboard/notifications', component: stub },
      { path: '/dashboard/notifications/preferences', component: stub }
    ]
  });
  await router.push(path);
  await router.isReady();
  if (options.authenticated) {
    await useAuthStore(pinia).login(DEMO_CREDENTIALS);
  }
  const wrapper = mount(App, { global: { plugins: [pinia, router, Vant] } });
  liveWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  vi.stubGlobal('WebSocket', FakeWebSocket);
  resetWebSocketForTests();
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  resetWebSocketForTests();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('App', () => {
  it('shows the global header with brand and language switcher on workspace pages', async () => {
    const wrapper = await mountAt('/home');

    expect(wrapper.text()).toContain('KiliSocial');
    expect(wrapper.findAll('.lang-switch__option').length).toBe(3);
  });

  it('hides the global header on landing pages', async () => {
    const wrapper = await mountAt('/');

    expect(wrapper.find('.app-header').exists()).toBe(false);
  });

  it('shows the tabbar on editor and drafts', async () => {
    for (const path of ['/editor', '/drafts']) {
      const wrapper = await mountAt(path);
      expect(wrapper.text()).toContain('Drafts');
    }
  });

  it('hides the tabbar on home and chat', async () => {
    for (const path of ['/home', '/chat']) {
      const wrapper = await mountAt(path);
      expect(wrapper.find('.van-tabbar').exists()).toBe(false);
    }
  });

  it('shows the notification bell only to signed-in sessions', async () => {
    const anonymous = await mountAt('/home');
    expect(anonymous.find('.ntf-bell').exists()).toBe(false);
    expect(anonymous.find('.ntf-toasts').exists()).toBe(true);

    const signedIn = await mountAt('/home', { authenticated: true });
    expect(signedIn.find('.ntf-bell').exists()).toBe(true);
    expect(signedIn.find('.ntf-toasts').exists()).toBe(true);
  });
});