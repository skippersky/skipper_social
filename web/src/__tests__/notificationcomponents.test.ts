import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showToast } from 'vant';
import NotificationBell from '../components/notification/NotificationBell.vue';
import NotificationDropdown from '../components/notification/NotificationDropdown.vue';
import NotificationItem from '../components/notification/NotificationItem.vue';
import NotificationToast from '../components/notification/NotificationToast.vue';
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead as markAllReadApi,
  markAsRead as markAsReadApi
} from '../api/notification';
import { resetNotificationAlerts } from '../lib/notificationAlerts';
import { TOAST_TTL_MS, useNotificationStore } from '../stores/notification';
import { NOTIFICATION_TYPES, type AppNotification } from '../types';

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

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

function row(id: string, extra: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: 'message',
    title: 'Title ' + id,
    body: 'Body ' + id,
    read: false,
    createdAt: 1700000000000,
    ...extra
  };
}

function page(rows: AppNotification[], total = rows.length) {
  return { notifications: rows, hasMore: false, total };
}

const stub = { template: '<div />' };
const liveWrappers: VueWrapper[] = [];
let pinia: Pinia;
let router: Router;

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/dashboard/notifications', component: stub },
      { path: '/dashboard/notifications/preferences', component: stub },
      { path: '/dashboard/channels', component: stub }
    ]
  });
}

async function mountComponent<C>(component: C, props: Record<string, unknown> = {}) {
  const wrapper = mount(component as never, {
    props: props as never,
    global: { plugins: [pinia, router, Vant] }
  });
  liveWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  pinia = createPinia();
  router = buildRouter();
  await router.push('/');
  await router.isReady();
  vi.mocked(getNotifications).mockResolvedValue(page([]));
  vi.mocked(getUnreadCount).mockResolvedValue(0);
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  resetNotificationAlerts();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('NotificationItem', () => {
  it('renders an unread row with its accent, dot and both actions', async () => {
    const wrapper = await mountComponent(NotificationItem, { notification: row('i1') });
    const item = wrapper.find('.ntf-item');

    expect(item.classes()).toContain('ntf-item--unread');
    expect(item.attributes('data-id')).toBe('i1');
    expect(item.attributes('data-type')).toBe('message');
    expect(item.attributes('data-read')).toBe('false');
    expect(wrapper.find('.ntf-item__title').text()).toBe('Title i1');
    expect(wrapper.find('.ntf-item__text').text()).toBe('Body i1');
    expect(wrapper.find('.ntf-item__time').text().length).toBeGreaterThan(0);
    expect(wrapper.find('.ntf-item__dot').exists()).toBe(true);
    expect(wrapper.findAll('.ntf-item__action')).toHaveLength(2);
  });

  it('drops the unread affordances and the read action for a read row', async () => {
    const wrapper = await mountComponent(NotificationItem, {
      notification: row('i2', { read: true })
    });
    const item = wrapper.find('.ntf-item');

    expect(item.classes()).not.toContain('ntf-item--unread');
    expect(item.attributes('data-read')).toBe('true');
    expect(wrapper.find('.ntf-item__dot').exists()).toBe(false);
    const actions = wrapper.findAll('.ntf-item__action');
    expect(actions).toHaveLength(1);
    expect(actions[0].classes()).toContain('ntf-item__action--warn');
  });

  it('hides the per-row actions in the compact dropdown variant', async () => {
    const wrapper = await mountComponent(NotificationItem, {
      notification: row('i3'),
      compact: true
    });

    expect(wrapper.find('.ntf-item').classes()).toContain('ntf-item--compact');
    expect(wrapper.find('.ntf-item__actions').exists()).toBe(false);
  });

  it('disables the actions while a row request is in flight', async () => {
    const wrapper = await mountComponent(NotificationItem, {
      notification: row('i4'),
      busy: true
    });

    const actions = wrapper.findAll('.ntf-item__action');
    expect(actions).toHaveLength(2);
    for (const action of actions) expect(action.attributes('disabled')).toBeDefined();
  });

  it('emits select, read and delete for the row', async () => {
    const wrapper = await mountComponent(NotificationItem, { notification: row('i5') });

    await wrapper.find('.ntf-item__main').trigger('click');
    await wrapper.findAll('.ntf-item__action')[0].trigger('click');
    await wrapper.find('.ntf-item__action--warn').trigger('click');

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'i5' });
    expect(wrapper.emitted('read')?.[0]).toEqual(['i5']);
    expect(wrapper.emitted('delete')?.[0]).toEqual(['i5']);
  });

  it('labels every notification type from the i18n table', async () => {
    const labels: string[] = [];

    for (const type of NOTIFICATION_TYPES) {
      const wrapper = await mountComponent(NotificationItem, {
        notification: row('type-' + type, { type })
      });
      labels.push(String(wrapper.find('.ntf-item__icon').attributes('aria-label')));
      expect(wrapper.find('.ntf-item').attributes('data-type')).toBe(type);
    }

    expect(labels).toEqual(['Messages', 'Conversations', 'Customers', 'System']);
  });
});

describe('NotificationDropdown', () => {
  it('shows the unread badge, the recent rows and an enabled mark all', async () => {
    const wrapper = await mountComponent(NotificationDropdown, {
      notifications: [row('d1'), row('d2', { read: true })],
      unreadCount: 1
    });

    expect(wrapper.find('.ntf-drop__title').text()).toBe('Recent');
    expect(wrapper.find('.ntf-drop__badge').text()).toBe('1 unread');
    expect(wrapper.find('.ntf-drop__badge--clear').exists()).toBe(false);
    expect(wrapper.find('.ntf-drop__mark').attributes('disabled')).toBeUndefined();
    expect(wrapper.findAll('.ntf-item')).toHaveLength(2);
    expect(wrapper.findAll('.ntf-item--compact')).toHaveLength(2);
  });

  it('shows the caught-up state and disables mark all at zero unread', async () => {
    const wrapper = await mountComponent(NotificationDropdown, {
      notifications: [row('d3', { read: true })],
      unreadCount: 0
    });
    const badge = wrapper.find('.ntf-drop__badge');

    expect(badge.text()).toBe('All caught up');
    expect(badge.classes()).toContain('ntf-drop__badge--clear');
    expect(wrapper.find('.ntf-drop__mark').attributes('disabled')).toBeDefined();
  });

  it('shows the loading hint while the recent page is in flight', async () => {
    const wrapper = await mountComponent(NotificationDropdown, {
      notifications: [],
      unreadCount: 0,
      loading: true
    });

    expect(wrapper.find('.ntf-drop__hint').exists()).toBe(true);
    expect(wrapper.findAll('.ntf-item')).toHaveLength(0);
  });

  it('shows the empty hint when nothing recent arrived', async () => {
    const wrapper = await mountComponent(NotificationDropdown, {
      notifications: [],
      unreadCount: 0
    });

    expect(wrapper.find('.ntf-drop__hint').text()).toBe('No recent notifications');
  });

  it('forwards row selection and the footer actions', async () => {
    const wrapper = await mountComponent(NotificationDropdown, {
      notifications: [row('d4')],
      unreadCount: 1
    });

    await wrapper.find('.ntf-item__main').trigger('click');
    await wrapper.find('.ntf-drop__mark').trigger('click');
    await wrapper.find('.ntf-drop__all').trigger('click');
    await wrapper.find('.ntf-drop__prefs').trigger('click');

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'd4' });
    expect(wrapper.emitted('markAll')).toHaveLength(1);
    expect(wrapper.emitted('viewAll')).toHaveLength(1);
    expect(wrapper.emitted('preferences')).toHaveLength(1);
  });
});

describe('NotificationBell', () => {
  it('caps the badge at 99+ and loads only the recent page', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page([row('b1'), row('b2'), row('b3'), row('b4'), row('b5'), row('b6')], 6)
    );
    vi.mocked(getUnreadCount).mockResolvedValue(120);

    const wrapper = await mountComponent(NotificationBell);

    expect(wrapper.find('.ntf-bell__badge').text()).toBe('99+');
    expect(wrapper.find('.ntf-bell__trigger').attributes('aria-label')).toBe('Notifications');
    expect(getNotifications).toHaveBeenCalledWith({ limit: 5 });
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(false);
  });

  it('hides the badge once everything is read', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(0);

    const wrapper = await mountComponent(NotificationBell);

    expect(wrapper.find('.ntf-bell__badge').exists()).toBe(false);
  });

  it('opens the panel with the five most recent rows', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page([row('b1'), row('b2'), row('b3'), row('b4'), row('b5'), row('b6')], 6)
    );
    vi.mocked(getUnreadCount).mockResolvedValue(6);

    const wrapper = await mountComponent(NotificationBell);
    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await flushPromises();

    expect(wrapper.find('.ntf-bell__trigger').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(true);
    expect(wrapper.findAll('.ntf-item')).toHaveLength(5);
    expect(wrapper.find('.ntf-bell__badge').text()).toBe('6');
  });

  it('routes a selected row to its link and closes the panel', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page([row('b7', { link: '/dashboard/channels' })], 1)
    );
    vi.mocked(markAsReadApi).mockResolvedValue(row('b7', { read: true }));

    const wrapper = await mountComponent(NotificationBell);
    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await flushPromises();
    await wrapper.find('.ntf-item__main').trigger('click');
    await flushPromises();

    expect(markAsReadApi).toHaveBeenCalledWith('b7');
    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(false);
  });

  it('routes the footer actions to the centre and the preferences page', async () => {
    const wrapper = await mountComponent(NotificationBell);

    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await wrapper.find('.ntf-drop__all').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/notifications');

    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await wrapper.find('.ntf-drop__prefs').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/notifications/preferences');
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(false);
  });

  it('marks everything read and toasts the confirmation', async () => {
    vi.mocked(getNotifications).mockResolvedValue(page([row('b8')], 1));
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(markAllReadApi).mockResolvedValue(1);

    const wrapper = await mountComponent(NotificationBell);
    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await flushPromises();
    await wrapper.find('.ntf-drop__mark').trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('All notifications marked as read');
  });

  it('closes on Escape and on a pointerdown outside the panel', async () => {
    const wrapper = await mountComponent(NotificationBell);

    await wrapper.find('.ntf-bell__trigger').trigger('click');
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(false);

    await wrapper.find('.ntf-bell__trigger').trigger('click');
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(true);
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextTick();
    expect(wrapper.find('.ntf-bell__panel').exists()).toBe(false);
  });

  it('clears the recent page when the feed request fails', async () => {
    vi.mocked(getNotifications).mockRejectedValue(new Error('boom'));

    const wrapper = await mountComponent(NotificationBell);
    await wrapper.find('.ntf-bell__trigger').trigger('click');
    await flushPromises();

    expect(wrapper.find('.ntf-drop__hint').text()).toBe('No recent notifications');
  });
});

describe('NotificationToast', () => {
  it('renders queued toasts with their type marker and ttl', async () => {
    const store = useNotificationStore(pinia);
    store.addRealtimeNotification(row('t1'));
    store.addRealtimeNotification(row('t2', { type: 'system' }));

    const wrapper = await mountComponent(NotificationToast);
    const toasts = wrapper.findAll('.ntf-toast');

    expect(toasts).toHaveLength(2);
    expect(toasts[0].attributes('data-id')).toBe('t1');
    expect(toasts[0].attributes('data-type')).toBe('message');
    expect(toasts[1].attributes('data-type')).toBe('system');
    expect(toasts[0].find('.ntf-toast__title').text()).toBe('Title t1');
    expect(toasts[0].find('.ntf-toast__type').text()).toBe('Messages');
    expect(toasts[1].find('.ntf-toast__type').text()).toBe('System');
    expect(toasts[0].attributes('style')).toContain('--ntf-ttl: ' + TOAST_TTL_MS + 'ms');
    expect(wrapper.find('.ntf-toasts').attributes('aria-live')).toBe('polite');
  });

  it('keeps the queue at the ceiling and drops the oldest toast', async () => {
    const store = useNotificationStore(pinia);
    store.addRealtimeNotification(row('q1'));

    const wrapper = await mountComponent(NotificationToast);
    store.addRealtimeNotification(row('q2'));
    store.addRealtimeNotification(row('q3'));
    store.addRealtimeNotification(row('q4'));
    await nextTick();

    expect(store.toasts.map((item) => item.id)).toEqual(['q2', 'q3', 'q4']);
    expect(wrapper.findAll('.ntf-toast')).toHaveLength(3);
  });

  it('routes to the target and dismisses on click', async () => {
    const store = useNotificationStore(pinia);
    store.addRealtimeNotification(row('c1', { link: '/dashboard/channels' }));

    const wrapper = await mountComponent(NotificationToast);
    await wrapper.find('.ntf-toast__body').trigger('click');
    await flushPromises();

    expect(store.toasts).toHaveLength(0);
    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
  });

  it('dismisses without navigating from the close control', async () => {
    const store = useNotificationStore(pinia);
    store.addRealtimeNotification(row('c2', { link: '/dashboard/channels' }));

    const wrapper = await mountComponent(NotificationToast);
    expect(wrapper.find('.ntf-toast__close').attributes('aria-label')).toBe('Dismiss');

    await wrapper.find('.ntf-toast__close').trigger('click');
    await nextTick();

    expect(store.toasts).toHaveLength(0);
    expect(wrapper.findAll('.ntf-toast__close')).toHaveLength(0);
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('auto-dismisses a toast once the ttl elapses', async () => {
    vi.useFakeTimers();
    const store = useNotificationStore(pinia);
    store.addRealtimeNotification(row('ttl-1'));
    const wrapper = mount(NotificationToast, { global: { plugins: [pinia, router, Vant] } });
    liveWrappers.push(wrapper);
    await nextTick();
    expect(wrapper.findAll('.ntf-toast')).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_TTL_MS);
    await nextTick();
    vi.useRealTimers();
    await flushPromises();

    expect(store.toasts).toHaveLength(0);
    expect(wrapper.findAll('.ntf-toast')).toHaveLength(0);
  });

  it('mirrors to the browser tray and plays the cue when allowed', async () => {
    const tray = vi.fn();
    vi.stubGlobal(
      'Notification',
      Object.assign(tray, { permission: 'granted' }) as unknown as typeof Notification
    );
    const start = vi.fn();
    const stop = vi.fn();
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ frequency: { value: 0 }, connect: vi.fn(), start, stop }),
      createGain: () => ({ gain: { value: 0 }, connect: vi.fn() })
    };
    vi.stubGlobal('AudioContext', vi.fn(() => context) as unknown as typeof AudioContext);

    const store = useNotificationStore(pinia);
    store.preferences.browserPush = true;
    store.preferences.sound = true;
    store.addRealtimeNotification(row('push-1'));
    await mountComponent(NotificationToast);

    expect(tray).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the delivery preferences are off', async () => {
    const tray = vi.fn();
    vi.stubGlobal(
      'Notification',
      Object.assign(tray, { permission: 'granted' }) as unknown as typeof Notification
    );
    const audio = vi.fn();
    vi.stubGlobal('AudioContext', audio as unknown as typeof AudioContext);

    const store = useNotificationStore(pinia);
    store.preferences.browserPush = false;
    store.preferences.sound = false;
    store.addRealtimeNotification(row('quiet-1'));
    const wrapper = await mountComponent(NotificationToast);

    expect(wrapper.findAll('.ntf-toast')).toHaveLength(1);
    expect(tray).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
  });

  it('suppresses the toast for a category the user muted', async () => {
    const store = useNotificationStore(pinia);
    store.preferences.system = false;

    const wrapper = await mountComponent(NotificationToast);
    store.addRealtimeNotification(row('muted', { type: 'system' }));
    await nextTick();

    expect(store.notifications).toHaveLength(1);
    expect(store.toasts).toHaveLength(0);
    expect(wrapper.findAll('.ntf-toast')).toHaveLength(0);
  });
});
