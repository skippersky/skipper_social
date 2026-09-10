import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import { h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showToast } from 'vant';
import AnalyticsView from '../views/dashboard/analytics/index.vue';
import { useAnalyticsStore } from '../stores/analytics';

/* jsdom has no canvas, so charts render as an inspectable stub. */
vi.mock('../lib/echarts', async () => {
  const vue = await import('vue');
  return {
    asChartOption: (option: Record<string, unknown>) => option,
    VChart: vue.defineComponent({
      name: 'VChart',
      props: {
        option: { type: Object, required: true },
        autoresize: { type: Boolean, default: false }
      },
      setup() {
        return () => vue.h('div', { class: 'chart-stub' });
      }
    })
  };
});

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

const DEMO_HIDDEN_KEY = 'ks-analytics-demo-hidden';
const stub = { render: () => h('div') };

/** Every mounted view, torn down after each test so no debounce timer outlives the file. */
const liveWrappers: VueWrapper[] = [];

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/dashboard/analytics', component: AnalyticsView },
      { path: '/dashboard/customers/:id', component: stub }
    ]
  });
}

/** Offline backend: every slice falls back to the demo aggregator. */
function offlineFetch() {
  return vi.fn().mockRejectedValue(new Error('offline'));
}

/** Hard failure: the api answers 5xx so no demo fallback is allowed. */
function errorFetch(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ success: false, code: 'HTTP_' + status, message: '', data: null })
  } as Response);
}

function urls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function countUrls(fetchMock: ReturnType<typeof vi.fn>, fragment: string): number {
  return urls(fetchMock).filter((url) => url.includes(fragment)).length;
}

/** Lets the 300ms range debounce fire so no timer leaks into the next test. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flushPromises();
}

async function mountAnalytics(fetchMock: ReturnType<typeof vi.fn>, seed: Record<string, string> = {}) {
  localStorage.clear();
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  vi.stubGlobal('fetch', fetchMock);
  const pinia: Pinia = createPinia();
  const router = buildRouter();
  await router.push('/dashboard/analytics');
  await router.isReady();
  const wrapper = mount(AnalyticsView, { global: { plugins: [pinia, router, Vant] } });
  liveWrappers.push(wrapper);
  await flushPromises();
  return { wrapper, router, pinia, store: useAnalyticsStore(pinia) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('AnalyticsView layout', () => {
  it('renders the KPI cards and every chart panel from the sample data', async () => {
    const { wrapper } = await mountAnalytics(offlineFetch());

    expect(document.title).toBe('Analytics - KiliSocial');
    expect(wrapper.find('.analytics__title').text()).toBe('Analytics');
    expect(wrapper.findAll('.stat__label').map((node) => node.text())).toEqual([
      'Customers',
      'Conversations',
      'Messages',
      'Avg. response time'
    ]);
    expect(wrapper.findAll('.stat__value').map((node) => node.text())).toEqual(['8', '6', '37', '2.8h']);
    expect(wrapper.find('.stat__delta').text()).toBe('+150%');
    expect(wrapper.find('.stat__hint').text()).toBe('Target 4h');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(4);
    expect(wrapper.find('.pie__center-value').text()).toBe('6');
    expect(wrapper.findAll('.top__row')).toHaveLength(5);
    expect(wrapper.find('.top__name').text()).toBe('Amani Juma');
  });

  it('shows the unread pill once loading settles', async () => {
    const { wrapper } = await mountAnalytics(offlineFetch());

    expect(wrapper.find('.analytics__badge--unread').text()).toBe('3 unread');
  });

  it('discloses the sample data and hides the notice on dismiss', async () => {
    const { wrapper } = await mountAnalytics(offlineFetch());

    expect(wrapper.find('.analytics__demo').text()).toContain('Sample data shown below');

    await wrapper.find('.analytics__demo button').trigger('click');

    expect(wrapper.find('.analytics__demo').exists()).toBe(false);
    expect(localStorage.getItem(DEMO_HIDDEN_KEY)).toBe('1');
    /* Dismiss-only: the charts stay on screen. */
    expect(wrapper.findAll('.chart-stub')).toHaveLength(4);
  });

  it('keeps the notice hidden once the visitor dismissed it', async () => {
    const { wrapper } = await mountAnalytics(offlineFetch(), { [DEMO_HIDDEN_KEY]: '1' });

    expect(wrapper.find('.analytics__demo').exists()).toBe(false);
    expect(wrapper.findAll('.chart-stub')).toHaveLength(4);
  });

  it('disables refresh and shows the loading pill while fetching', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(() => gate.then(() => Promise.reject(new Error('offline'))));
    vi.stubGlobal('fetch', fetchMock);
    const pinia = createPinia();
    const router = buildRouter();
    await router.push('/dashboard/analytics');
    await router.isReady();

    const wrapper = mount(AnalyticsView, { global: { plugins: [pinia, router, Vant] } });

    liveWrappers.push(wrapper);
    await nextTick();

    expect(wrapper.find('.analytics__refresh').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.analytics__badge').text()).toBe('Loading statistics');

    release();
    await flushPromises();

    expect(wrapper.find('.analytics__refresh').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.analytics__badge--unread').text()).toBe('3 unread');
  });
});

describe('AnalyticsView navigation', () => {
  it('returns home from the back button', async () => {
    const { wrapper, router } = await mountAnalytics(offlineFetch());

    await wrapper.find('.analytics__home').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('opens a customer profile from the ranking table', async () => {
    const { wrapper, router } = await mountAnalytics(offlineFetch());

    await wrapper.findAll('.top__person')[1]?.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/customers/u-2');
  });
});

describe('AnalyticsView date range', () => {
  it('applies a preset window and only reveals inputs for custom', async () => {
    const { wrapper, store } = await mountAnalytics(offlineFetch());

    expect(store.dateRange.preset).toBe('30d');

    await wrapper.findAll('.range__chip')[1]?.trigger('click');
    expect(store.dateRange.preset).toBe('7d');
    expect(wrapper.find('.range__custom').exists()).toBe(false);
    await settle();

    await wrapper.findAll('.range__chip')[3]?.trigger('click');
    expect(wrapper.find('.range__custom').exists()).toBe(true);
    /* Custom only reveals the inputs; the window applies on submit. */
    expect(store.dateRange.preset).toBe('7d');
  });

  it('applies a validated custom window end inclusive', async () => {
    const { wrapper, store } = await mountAnalytics(offlineFetch());

    await wrapper.findAll('.range__chip')[3]?.trigger('click');
    const inputs = wrapper.findAll('.range__input');
    await inputs[0]?.setValue('2026-08-01');
    await inputs[1]?.setValue('2026-08-10');
    await wrapper.find('.range__custom').trigger('submit');

    expect(store.dateRange.preset).toBe('custom');
    expect(store.dateRange.from).toBe(new Date(2026, 7, 1).getTime());
    expect(store.dateRange.to).toBe(new Date(2026, 7, 11).getTime() - 1);
    await settle();
  });

  it('reports a reversed custom window and leaves the store alone', async () => {
    const { wrapper, store } = await mountAnalytics(offlineFetch());
    const before = { ...store.dateRange };

    await wrapper.findAll('.range__chip')[3]?.trigger('click');
    const inputs = wrapper.findAll('.range__input');
    await inputs[0]?.setValue('2026-08-20');
    await inputs[1]?.setValue('2026-08-01');
    await wrapper.find('.range__custom').trigger('submit');

    expect(wrapper.find('.range__error').text()).toBe('The start date must come before the end date');
    expect(store.dateRange.from).toBe(before.from);
    expect(store.dateRange.to).toBe(before.to);
    expect(store.dateRange.preset).toBe(before.preset);
  });
});

describe('AnalyticsView data loading', () => {
  it('forces a reload from the refresh button', async () => {
    const fetchMock = offlineFetch();
    const { wrapper } = await mountAnalytics(fetchMock);

    /* apiGet retries a transient failure once, so an offline slice costs two calls. */
    expect(countUrls(fetchMock, '/analytics/overview')).toBe(2);

    await wrapper.find('.analytics__refresh').trigger('click');
    await flushPromises();

    expect(countUrls(fetchMock, '/analytics/overview')).toBe(4);
  });

  it('reloads only the conversation trend when its bucket size changes', async () => {
    const fetchMock = offlineFetch();
    const { wrapper, store } = await mountAnalytics(fetchMock);

    const segmented = wrapper.findAll('.segmented');
    expect(segmented).toHaveLength(2);

    await segmented[0]?.findAll('.segmented__btn')[2]?.trigger('click');
    await flushPromises();

    expect(store.conversationGranularity).toBe('month');
    expect(store.messageGranularity).toBe('day');
    expect(countUrls(fetchMock, '/analytics/conversations/trend')).toBe(4);
    expect(
      urls(fetchMock).some(
        (url) => url.includes('/analytics/conversations/trend') && url.includes('granularity=month')
      )
    ).toBe(true);
    expect(countUrls(fetchMock, '/analytics/messages/trend')).toBe(2);
  });

  it('toasts and offers retry when the api fails hard', async () => {
    const fetchMock = errorFetch(500);
    const { wrapper, store } = await mountAnalytics(fetchMock);

    expect(store.error).toBe('api.500');
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Server error, showing sample data');
    expect(wrapper.find('.analytics__demo').exists()).toBe(false);
    expect(wrapper.find('.panel__state-text--error').text()).toBe('Server error, showing sample data');
    expect(wrapper.findAll('.chart-stub')).toHaveLength(0);
    expect(wrapper.findAll('.panel__retry').length).toBeGreaterThan(0);

    await wrapper.find('.panel__retry').trigger('click');
    await flushPromises();

    expect(countUrls(fetchMock, '/analytics/overview')).toBe(4);
  });

  it('renders zeroed KPIs when the api fails hard', async () => {
    const { wrapper } = await mountAnalytics(errorFetch(500));
    const values = wrapper.findAll('.stat__value').map((node) => node.text());

    expect(values[0]).toBe('0');
    expect(values[3]).toBe('\u2014');
    expect(wrapper.findAll('.top__row')).toHaveLength(0);
    /* A hard error outranks the empty state, so no panel claims there is no data. */
    expect(wrapper.findAll('.panel__state-text--error')).toHaveLength(5);
    expect(wrapper.text()).not.toContain('No data for this period');
  });
});
