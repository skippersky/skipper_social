import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showToast } from 'vant';
import NotificationsView from '../views/dashboard/notifications/index.vue';
import type { AppNotification } from '../types';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () =>
      Promise.resolve({
        success: ok,
        code: ok ? 'OK' : 'HTTP_' + status,
        message: ok ? '' : 'boom',
        data
      })
  } as Response;
}

/** No backend at all: every call rejects, so the demo fallback takes over. */
function offline(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

/** A backend that answers with a hard 5xx, which the demo fallback must not swallow. */
function hardFailure(status = 500): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, status)));
}

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

function manyRows(count: number): AppNotification[] {
  return Array.from({ length: count }, (_, index) =>
    row('n-' + index, { createdAt: 1700000000000 - index })
  );
}

interface LiveOptions {
  unread?: number;
  nextPage?: AppNotification[];
  hasMore?: boolean;
}

/** Backend mode: routes each notification endpoint by URL shape. */
function liveBackend(page: AppNotification[], options: LiveOptions = {}) {
  const total = page.length + (options.nextPage?.length ?? 0);
  const hasMore = options.hasMore ?? Boolean(options.nextPage);
  const fetchMock = vi.fn().mockImplementation((url: unknown) => {
    const text = String(url);
    if (text.includes('/unread-count')) {
      return Promise.resolve(jsonResponse({ count: options.unread ?? 0 }));
    }
    if (text.includes('/read-all')) return Promise.resolve(jsonResponse({ updated: page.length }));
    if (text.includes('/notifications/read')) return Promise.resolve(jsonResponse({ deleted: 1 }));
    if (/\/notifications\/[^/]+\/read/.test(text)) {
      const id = decodeURIComponent(text.split('/notifications/')[1].split('/read')[0]);
      return Promise.resolve(jsonResponse(row(id, { read: true })));
    }
    if (text.includes('offset=0')) {
      return Promise.resolve(jsonResponse({ notifications: page, hasMore, total }));
    }
    return Promise.resolve(
      jsonResponse({ notifications: options.nextPage ?? [], hasMore, total })
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
      { path: '/home', component: stub },
      { path: '/dashboard/notifications', component: NotificationsView },
      { path: '/dashboard/notifications/preferences', component: stub },
      { path: '/dashboard/conversations', component: stub },
      { path: '/dashboard/customers/:id', component: stub },
      { path: '/dashboard/channels', component: stub },
      { path: '/dashboard/analytics', component: stub }
    ]
  });
}

async function mountView(seed: Record<string, string> = {}) {
  localStorage.clear();
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  pinia = createPinia();
  router = buildRouter();
  await router.push('/dashboard/notifications');
  await router.isReady();
  const wrapper = mount(NotificationsView, {
    global: { plugins: [pinia, router, Vant] }
  });
  liveWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function rows(wrapper: VueWrapper) {
  return wrapper.findAll('.ntf-item');
}

function ids(wrapper: VueWrapper): string[] {
  return rows(wrapper).map((node) => String(node.attributes('data-id')));
}

function chip(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('.notifications__chip').find((node) => node.text() === label);
  if (!found) throw new Error('chip not found: ' + label);
  return found;
}

function actionButton(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('.notifications__btn').find((node) => node.text() === label);
  if (!found) throw new Error('button not found: ' + label);
  return found;
}

function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  offline();
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('NotificationsView chrome', () => {
  it('renders the sample feed with totals, chips and page meta', async () => {
    const wrapper = await mountView();

    expect(rows(wrapper)).toHaveLength(11);
    expect(wrapper.find('.notifications__title').text()).toBe('Notifications');
    expect(wrapper.find('.notifications__count').text()).toBe('11');
    expect(wrapper.find('.notifications__live').text()).toBe('Offline updates');
    expect(wrapper.find('.notifications__live').attributes('data-status')).toBe('disconnected');
    expect(wrapper.find('.notifications__subtitle strong').text()).toBe('4 unread');
    expect(wrapper.find('.notifications__subtitle strong').classes()).not.toContain('is-zero');
    expect(wrapper.findAll('.notifications__chip')).toHaveLength(8);
    expect(wrapper.find('.notifications__more').exists()).toBe(false);
    expect(document.title).toBe('Notifications - KiliSocial');
  });

  it('navigates home and exposes the preferences link', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('.notifications__btn--primary').attributes('href')).toBe(
      '/dashboard/notifications/preferences'
    );

    await wrapper.find('.notifications__home').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('reflects the live connection status in the header pill', async () => {
    liveBackend([row('srv-1')], { unread: 1 });
    const wrapper = await mountView();

    expect(rows(wrapper)).toHaveLength(1);
    expect(wrapper.find('.notifications__live').attributes('data-status')).toBe('disconnected');
    expect(wrapper.find('.notifications__subtitle strong').text()).toBe('1 unread');
  });
});

describe('NotificationsView filtering', () => {
  it('narrows the feed through the type and status chips', async () => {
    const wrapper = await mountView();

    await chip(wrapper, 'System').trigger('click');
    await flushPromises();
    expect(ids(wrapper)).toEqual(['ntf-5', 'ntf-7', 'ntf-9']);
    expect(wrapper.find('.notifications__count').text()).toBe('3');
    expect(chip(wrapper, 'System').classes()).toContain('is-active');

    await chip(wrapper, 'All').trigger('click');
    await flushPromises();
    expect(rows(wrapper)).toHaveLength(11);
    expect(wrapper.find('.notifications__count').text()).toBe('11');

    await chip(wrapper, 'Unread').trigger('click');
    await flushPromises();
    expect(rows(wrapper)).toHaveLength(4);
    expect(wrapper.find('.notifications__count').text()).toBe('4');
    expect(ids(wrapper)).toContain('ntf-3');

    await chip(wrapper, 'Customers').trigger('click');
    await flushPromises();
    expect(ids(wrapper)).toEqual(['ntf-3']);
    expect(wrapper.find('.notifications__count').text()).toBe('1');

    await chip(wrapper, 'Read').trigger('click');
    await flushPromises();
    expect(ids(wrapper)).toEqual(['ntf-4', 'ntf-10']);
    expect(wrapper.find('.notifications__count').text()).toBe('2');
    expect(chip(wrapper, 'Read').classes()).toContain('is-active');
  });

  it('explains a filtered empty result without the onboarding CTA', async () => {
    const wrapper = await mountView();

    await chip(wrapper, 'System').trigger('click');
    await flushPromises();
    await chip(wrapper, 'Unread').trigger('click');
    await flushPromises();

    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.notifications__empty').exists()).toBe(true);
    expect(wrapper.find('.notifications__empty').text()).toContain('Nothing matches these filters');
    expect(wrapper.find('.notifications__empty-hint').exists()).toBe(false);
    expect(wrapper.find('.notifications__empty-cta').exists()).toBe(false);
  });
});

describe('NotificationsView bulk actions', () => {
  it('marks every row read and reports the cleared badge', async () => {
    const wrapper = await mountView();

    await actionButton(wrapper, 'Mark all read').trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('All notifications marked as read');
    const strong = wrapper.find('.notifications__subtitle strong');
    expect(strong.text()).toBe('All caught up');
    expect(strong.classes()).toContain('is-zero');
    expect(wrapper.findAll('.ntf-item--unread')).toHaveLength(0);
    expect(rows(wrapper)).toHaveLength(11);
  });

  it('clears the read rows and keeps the unread ones', async () => {
    const wrapper = await mountView();

    await actionButton(wrapper, 'Clear read').trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('Read notifications cleared');
    expect(rows(wrapper)).toHaveLength(4);
    expect(wrapper.find('.notifications__count').text()).toBe('4');
    expect(wrapper.findAll('.ntf-item--unread')).toHaveLength(4);
  });
});

describe('NotificationsView sample data', () => {
  it('discloses the sample feed and hides it on request', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('.notifications__demo').text()).toContain('Sample data shown below');
    const hide = wrapper.find('.notifications__demo button');
    expect(hide.attributes('aria-label')).toBe('Hide sample data');

    await hide.trigger('click');
    await flushPromises();

    expect(wrapper.find('.notifications__demo').exists()).toBe(false);
    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.notifications__empty').exists()).toBe(true);
    expect(localStorage.getItem('ks-notifications-demo-hidden')).toBe('1');
  });

  it('remembers the hidden choice and routes the empty CTA to channels', async () => {
    const wrapper = await mountView({ 'ks-notifications-demo-hidden': '1' });

    expect(wrapper.find('.notifications__demo').exists()).toBe(false);
    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.notifications__empty').text()).toContain('No notifications yet');
    expect(wrapper.find('.notifications__empty-hint').text()).toContain('Connect a channel');

    await wrapper.find('.notifications__empty-cta').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/channels');
  });
});

describe('NotificationsView row actions', () => {
  it('marks a single row read from its own action button', async () => {
    const wrapper = await mountView();

    await wrapper.find('[data-id="ntf-3"] .ntf-item__action').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-id="ntf-3"]').attributes('data-read')).toBe('true');
    expect(wrapper.findAll('.ntf-item--unread')).toHaveLength(3);
    expect(wrapper.find('.notifications__subtitle strong').text()).toBe('3 unread');
  });

  it('deletes a row, toasts and updates the total', async () => {
    const wrapper = await mountView();

    await wrapper.find('[data-id="ntf-5"] .ntf-item__action--warn').trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('Notification deleted');
    expect(rows(wrapper)).toHaveLength(10);
    expect(wrapper.find('.notifications__count').text()).toBe('10');
    expect(ids(wrapper)).not.toContain('ntf-5');
  });

  it('routes a customer row to its detail page', async () => {
    const wrapper = await mountView();

    await wrapper.find('[data-id="ntf-3"] .ntf-item__main').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/customers/u-8');
  });

  it('keeps informational rows on the notification centre', async () => {
    const wrapper = await mountView();

    await wrapper.find('[data-id="ntf-9"] .ntf-item__main').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/notifications');
    expect(rows(wrapper)).toHaveLength(11);
  });
});

describe('NotificationsView states', () => {
  it('shows the onboarding empty state when the backend has no rows', async () => {
    liveBackend([], { unread: 0 });
    const wrapper = await mountView();

    expect(wrapper.find('.notifications__demo').exists()).toBe(false);
    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.notifications__empty').text()).toContain('No notifications yet');
    expect(wrapper.find('.notifications__empty-hint').exists()).toBe(true);
    expect(wrapper.find('.notifications__empty-cta').text()).toBe('Connect a channel');
    expect(wrapper.find('.notifications__subtitle strong').classes()).toContain('is-zero');
  });

  it('surfaces a hard server error with a retry action', async () => {
    hardFailure(500);
    const wrapper = await mountView();

    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.find('.notifications__error').exists()).toBe(true);
    expect(wrapper.find('.notifications__error').text()).toContain(
      'Server error, showing sample data'
    );
    expect(actionButton(wrapper, 'Retry').exists()).toBe(true);
  });

  it('recovers the feed when the retry succeeds', async () => {
    let calls = 0;
    const fetchMock = vi.fn().mockImplementation((url: unknown) => {
      calls += 1;
      if (calls <= 4) return Promise.resolve(jsonResponse(null, false, 500));
      const text = String(url);
      if (text.includes('/unread-count')) {
        return Promise.resolve(jsonResponse({ count: 1 }));
      }
      return Promise.resolve(
        jsonResponse({ notifications: [row('srv-9')], hasMore: false, total: 1 })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = await mountView();
    expect(wrapper.find('.notifications__error').exists()).toBe(true);

    await actionButton(wrapper, 'Retry').trigger('click');
    await flushPromises();

    expect(calls).toBeGreaterThan(4);
    expect(wrapper.find('.notifications__error').exists()).toBe(false);
    expect(ids(wrapper)).toEqual(['srv-9']);
    expect(wrapper.find('.notifications__subtitle strong').text()).toBe('1 unread');
  });
});

describe('NotificationsView windowing', () => {
  it('windows a long feed and pages in more rows on demand', async () => {
    const fetchMock = liveBackend(manyRows(120), { unread: 5, hasMore: true });
    const wrapper = await mountView();

    expect(rows(wrapper)).toHaveLength(14);
    expect(ids(wrapper)[0]).toBe('n-0');
    expect(wrapper.find('.notifications__virtual').text()).toBe('120');
    expect(wrapper.find('.notifications__count').text()).toBe('120');
    expect(wrapper.find('.notifications__more').text()).toBe('Load more');

    await wrapper.find('.notifications__more').trigger('click');
    await flushPromises();

    expect(calledUrls(fetchMock).some((url) => url.includes('offset=120'))).toBe(true);
    expect(wrapper.find('.notifications__more').exists()).toBe(true);
  });

  it('moves the rendered slice as the list scrolls', async () => {
    liveBackend(manyRows(120), { unread: 5, hasMore: true });
    const wrapper = await mountView();
    const scroller = wrapper.find('.notifications__scroll');
    const el = scroller.element as HTMLElement;
    Object.defineProperty(el, 'scrollHeight', { value: 120 * 76, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(el, 'scrollTop', { value: 760, configurable: true });

    await scroller.trigger('scroll');
    await flushPromises();

    expect(rows(wrapper)).toHaveLength(20);
    expect(ids(wrapper)[0]).toBe('n-4');
    expect(ids(wrapper)[19]).toBe('n-23');
    expect(wrapper.find('.notifications__virtual').text()).toBe('120');
  });
});
