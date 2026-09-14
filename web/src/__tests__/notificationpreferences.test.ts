import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showToast } from 'vant';
import { ApiError } from '../api/http';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../api/demo';
import * as notificationApi from '../api/notification';
import { requestBrowserPushPermission } from '../lib/notificationAlerts';
import { useNotificationStore } from '../stores/notification';
import NotificationPreferencesView from '../views/dashboard/notifications/preferences.vue';
import type { NotificationPreferences } from '../types';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

vi.mock('../api/notification', () => ({
  PAGE_LIMIT: 20,
  getNotifications: vi.fn(),
  getNotificationById: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  deleteReadNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn()
}));

vi.mock('../lib/notificationAlerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/notificationAlerts')>();
  return { ...actual, requestBrowserPushPermission: vi.fn() };
});

/** The API layer is mocked, so preferences only ever come from these defaults. */
function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides };
}

const stub = { template: '<div />' };
const liveWrappers: VueWrapper[] = [];
let pinia: Pinia;
let router: Router;

async function mountView() {
  localStorage.clear();
  pinia = createPinia();
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/dashboard/notifications', component: stub },
      {
        path: '/dashboard/notifications/preferences',
        component: NotificationPreferencesView
      }
    ]
  });
  await router.push('/dashboard/notifications/preferences');
  await router.isReady();
  const wrapper = mount(NotificationPreferencesView, {
    global: { plugins: [pinia, router, Vant] }
  });
  liveWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function switches(wrapper: VueWrapper) {
  return wrapper.findAll('.van-switch');
}

function switchOn(node: DOMWrapper<Element>): boolean {
  return (
    node.classes().includes('van-switch--on') || node.attributes('aria-checked') === 'true'
  );
}

function labels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.prefs__row-label').map((node) => node.text());
}

function saveButton(wrapper: VueWrapper) {
  return wrapper.find('.prefs__btn--primary');
}

function testButton(wrapper: VueWrapper) {
  return wrapper.find('.prefs__row--actions .prefs__btn');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(notificationApi.getNotificationPreferences).mockResolvedValue(prefs());
  vi.mocked(notificationApi.updateNotificationPreferences).mockImplementation((patch) =>
    Promise.resolve(prefs(patch))
  );
  vi.mocked(notificationApi.getUnreadCount).mockResolvedValue(0);
  vi.mocked(notificationApi.getNotifications).mockResolvedValue({
    notifications: [],
    hasMore: false,
    total: 0
  });
  vi.mocked(requestBrowserPushPermission).mockResolvedValue('granted');
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  vi.useRealTimers();
  localStorage.clear();
});

describe('NotificationPreferencesView', () => {
  it('renders one switch per notification type plus the delivery options', async () => {
    const wrapper = await mountView();
    expect(switches(wrapper)).toHaveLength(6);
    expect(labels(wrapper)).toEqual([
      'Messages',
      'Conversations',
      'Customers',
      'System',
      'Browser push',
      'Sound'
    ]);
    expect(wrapper.findAll('.prefs__row-hint')).toHaveLength(6);
    expect(wrapper.find('.prefs__title').text()).toBe('Notification preferences');
    expect(document.title).toBe('Notification preferences - KiliSocial');
  });

  it('loads the stored preferences into the draft on mount', async () => {
    vi.mocked(notificationApi.getNotificationPreferences).mockResolvedValue(
      prefs({ message: false, sound: false, browserPush: true })
    );
    const wrapper = await mountView();
    const nodes = switches(wrapper);
    expect(switchOn(nodes[0])).toBe(false);
    expect(switchOn(nodes[1])).toBe(true);
    expect(switchOn(nodes[3])).toBe(true);
    expect(switchOn(nodes[4])).toBe(true);
    expect(switchOn(nodes[5])).toBe(false);
  });

  it('keeps toggles local until the user saves', async () => {
    const wrapper = await mountView();
    const store = useNotificationStore(pinia);
    await switches(wrapper)[5].trigger('click');
    expect(switchOn(switches(wrapper)[5])).toBe(false);
    expect(store.preferences.sound).toBe(true);
    expect(notificationApi.updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('persists the draft and confirms with a toast', async () => {
    const wrapper = await mountView();
    const store = useNotificationStore(pinia);
    await switches(wrapper)[3].trigger('click');
    await saveButton(wrapper).trigger('click');
    await flushPromises();
    expect(notificationApi.updateNotificationPreferences).toHaveBeenCalledWith(
      prefs({ system: false })
    );
    expect(showToast).toHaveBeenCalledWith('Preferences saved');
    expect(store.preferences.system).toBe(false);
    expect(switchOn(switches(wrapper)[3])).toBe(false);
  });

  it('reverts the draft when the save request fails', async () => {
    vi.mocked(notificationApi.updateNotificationPreferences).mockRejectedValue(
      new ApiError('HTTP_500', 'boom')
    );
    const wrapper = await mountView();
    const store = useNotificationStore(pinia);
    await switches(wrapper)[3].trigger('click');
    await saveButton(wrapper).trigger('click');
    await flushPromises();
    expect(showToast).toHaveBeenCalledWith('Server error, showing sample data');
    expect(store.preferences.system).toBe(true);
    expect(switchOn(switches(wrapper)[3])).toBe(true);
  });

  it('asks the browser for permission before enabling push', async () => {
    const wrapper = await mountView();
    await switches(wrapper)[4].trigger('click');
    await flushPromises();
    expect(requestBrowserPushPermission).toHaveBeenCalledTimes(1);
    expect(switchOn(switches(wrapper)[4])).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Browser push enabled');
  });

  it('reverts push when the browser denies permission', async () => {
    vi.mocked(requestBrowserPushPermission).mockResolvedValue('denied');
    const wrapper = await mountView();
    await switches(wrapper)[4].trigger('click');
    await flushPromises();
    expect(switchOn(switches(wrapper)[4])).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      'Browser blocked notifications. Allow them in site settings.'
    );
  });

  it('explains unsupported browsers instead of leaving a dead switch', async () => {
    vi.mocked(requestBrowserPushPermission).mockResolvedValue('unsupported');
    const wrapper = await mountView();
    await switches(wrapper)[4].trigger('click');
    await flushPromises();
    expect(switchOn(switches(wrapper)[4])).toBe(false);
    expect(showToast).toHaveBeenCalledWith('This browser does not support notifications');
  });

  it('never prompts again when push is already enabled', async () => {
    vi.mocked(notificationApi.getNotificationPreferences).mockResolvedValue(
      prefs({ browserPush: true })
    );
    const wrapper = await mountView();
    expect(switchOn(switches(wrapper)[4])).toBe(true);
    await switches(wrapper)[4].trigger('click');
    await flushPromises();
    expect(requestBrowserPushPermission).not.toHaveBeenCalled();
    expect(switchOn(switches(wrapper)[4])).toBe(false);
  });

  it('pushes a preview notification through the offline test button', async () => {
    const wrapper = await mountView();
    const store = useNotificationStore(pinia);
    await testButton(wrapper).trigger('click');
    expect(showToast).toHaveBeenCalledWith('Test notification sent');
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].type).toBe('system');
    expect(store.toasts[0].demo).toBe(true);
    expect(store.notifications).toHaveLength(1);
    expect(store.unreadCount).toBe(1);
  });

  it('mirrors the live connection state and navigates back to the inbox', async () => {
    const wrapper = await mountView();
    const store = useNotificationStore(pinia);
    const live = wrapper.find('.prefs__live');
    expect(live.attributes('data-status')).toBe('disconnected');
    expect(live.text()).toContain('Live connection');
    store.setConnectionStatus('connected');
    await nextTick();
    expect(wrapper.find('.prefs__live').attributes('data-status')).toBe('connected');
    await wrapper.find('.prefs__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/notifications');
  });
});
