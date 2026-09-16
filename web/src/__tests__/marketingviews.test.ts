/**
 * Sprint 11 marketing views.
 *
 * These are the wiring tests: each page is mounted against a real router and a
 * stubbed network edge, so what is asserted is the contract between view, store
 * and api. Two backends are used on purpose - a route table that answers with
 * known payloads for deterministic assertions, and a rejecting fetch that drives
 * every page into the demo fallback, which is the mode a reviewer sees before
 * the marketing api exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { h, type Component } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import Vant, { showConfirmDialog, showToast } from 'vant';
import CampaignDetail from '../views/dashboard/marketing/CampaignDetail.vue';
import CreateCampaign from '../views/dashboard/marketing/CreateCampaign.vue';
import HistoryView from '../views/dashboard/marketing/History.vue';
import MarketingHub from '../views/dashboard/marketing/index.vue';
import TemplatesView from '../views/dashboard/marketing/Templates.vue';
import { useMarketingStore } from '../stores/marketing';
import type {
  BatchSendProgress,
  Campaign,
  CampaignStats,
  MarketingContent,
  MarketingTemplate,
  Recipient,
  SendRecord
} from '../types';

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return {
    ...actual,
    showToast: vi.fn(),
    showConfirmDialog: vi.fn(() => Promise.resolve())
  };
});

/**
 * The throttled delivery loop owns its own suite; the wizard only needs the
 * contract, so the queue is replaced by a stub whose summary the test controls.
 */
vi.mock('../composables/useBatchSend', async () => {
  const vue = await import('vue');
  const vitest = await import('vitest');
  const estimate = {
    count: 0,
    ms: 0,
    text: '0s',
    rate: { perMinute: 10, intervalMs: 2000 }
  };
  const state = {
    progress: vue.ref(null),
    running: vue.ref(false),
    paused: vue.ref(false),
    failures: vue.ref([]),
    lastSummary: vue.ref(null),
    estimate: vitest.vi.fn(() => estimate),
    start: vitest.vi.fn(),
    pause: vitest.vi.fn(),
    resume: vitest.vi.fn(),
    cancel: vitest.vi.fn(),
    dismiss: vitest.vi.fn(),
    rerunFailures: vitest.vi.fn()
  };
  return { useBatchSend: () => state, batchStub: state };
});

interface BatchStub {
  progress: { value: unknown };
  running: { value: boolean };
  paused: { value: boolean };
  failures: { value: unknown[] };
  lastSummary: { value: unknown };
  estimate: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
  rerunFailures: ReturnType<typeof vi.fn>;
}

const batchModule = await import('../composables/useBatchSend');
const batch = (batchModule as unknown as { batchStub: BatchStub }).batchStub;

const DEMO_HIDDEN_KEY = 'ks-marketing-demo-hidden';
const NOW = new Date(2026, 8, 7, 9, 0).getTime();
const MARKETING = '/api/v1/marketing';

/* ---------------------------------------------------------------- fixtures */

function contentFixture(patch: Partial<MarketingContent> = {}): MarketingContent {
  return {
    id: 'ct-1',
    title: 'Weekend flash sale',
    body: 'Fifteen percent off every galvanised roofing sheet until Sunday midnight.',
    cta: 'Order now',
    imageSuggestion: 'Stacked roofing sheets at golden hour',
    hashtags: ['kili'],
    goal: 'promotion',
    language: 'en',
    tone: 'friendly',
    length: 'standard',
    createdAt: NOW,
    ...patch
  };
}

function statsFixture(patch: Partial<CampaignStats> = {}): CampaignStats {
  return {
    delivered: 9,
    opened: 6,
    clicked: 3,
    replied: 2,
    converted: 1,
    openRate: 67,
    clickRate: 33,
    replyRate: 22,
    conversionRate: 11,
    ...patch
  };
}

function campaignFixture(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    name: 'Weekend kitenge sale',
    status: 'running',
    content: contentFixture(),
    recipientCount: 12,
    channels: ['whatsapp'],
    settings: {
      mode: 'immediate',
      scheduledAt: null,
      perMinute: 10,
      intervalMs: 2000,
      channels: ['whatsapp']
    },
    progress: { total: 12, sent: 5, failed: 1, pending: 6, percent: 42, ratePerMinute: 10 },
    stats: statsFixture(),
    createdAt: NOW,
    startedAt: NOW,
    finishedAt: null,
    ...patch
  };
}

function recordFixture(patch: Partial<SendRecord> = {}): SendRecord {
  return {
    id: 'rec-1',
    campaignId: 'cmp-1',
    campaignName: 'Weekend kitenge sale',
    recipientId: 'r-1',
    recipientName: 'Amani Juma',
    channel: 'whatsapp',
    status: 'sent',
    sentAt: NOW,
    opened: true,
    clicked: false,
    replied: false,
    ...patch
  };
}

function templateFixture(patch: Partial<MarketingTemplate> = {}): MarketingTemplate {
  return {
    id: 'tpl-1',
    name: 'Weekend promotion',
    category: 'promotion',
    title: 'Weekend flash sale',
    content: 'Fifteen percent off until Sunday midnight.',
    cta: 'Order now',
    usageCount: 3,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  };
}

function recipientFixture(patch: Partial<Recipient> = {}): Recipient {
  return {
    id: 'r-1',
    name: 'Amani Juma',
    channel: 'whatsapp',
    handle: '+255700000001',
    tags: ['VIP'],
    valid: true,
    ...patch
  };
}

/* ------------------------------------------------------------ http helpers */

type Route = [string, unknown];

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, code: 'OK', message: '', data })
  } as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({
      success: false,
      code: 'HTTP_' + status,
      message: 'boom',
      data: null
    })
  } as Response;
}

/**
 * Answers by "METHOD url-fragment"; the first match wins, so callers list the
 * most specific route first. Anything unmatched answers 404, which the api layer
 * reads as a missing backend and degrades to the demo fixtures.
 */
function backend(routes: Route[]): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((url: unknown, init?: { method?: string }) => {
    const key = (init?.method ?? 'GET').toUpperCase() + ' ' + String(url);
    const hit = routes.find(([needle]) => key.includes(needle));
    return Promise.resolve(hit ? jsonResponse(hit[1]) : errorResponse(404));
  });
}

function offlineFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new Error('offline'));
}

function errorFetch(status: number): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(errorResponse(status));
}

function urls(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[0]));
}

function lastUrl(mock: ReturnType<typeof vi.fn>): string {
  const list = urls(mock);
  return list[list.length - 1];
}

function bodyOf(mock: ReturnType<typeof vi.fn>, index: number): string {
  const call = mock.mock.calls[index] as unknown[];
  const init = (call[1] ?? {}) as { body?: unknown };
  return String(init.body ?? '');
}

function buttonByText(wrapper: VueWrapper, selector: string, label: string) {
  return wrapper.findAll(selector).find((node) => node.text().trim() === label);
}

const OVERVIEW = {
  monthSent: 120,
  monthOpenRate: 42,
  monthConversionRate: 18,
  activeCampaigns: 2
};

function paged(campaigns: Campaign[], hasMore = false) {
  return { campaigns, hasMore, total: campaigns.length };
}

/** Overview first, list last: the campaign list url prefixes every detail url. */
function hubRoutes(campaigns: Campaign[], extra: Route[] = []): Route[] {
  return [
    ['GET ' + MARKETING + '/overview', OVERVIEW],
    ...extra,
    ['GET ' + MARKETING + '/campaigns', paged(campaigns)]
  ];
}

/* ------------------------------------------------------------------ mount */

const stub = { render: () => h('div') };
const liveWrappers: VueWrapper[] = [];

function buildRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/home', component: stub },
      { path: '/dashboard/marketing', component: MarketingHub },
      { path: '/dashboard/marketing/create', component: CreateCampaign },
      { path: '/dashboard/marketing/templates', component: TemplatesView },
      { path: '/dashboard/marketing/history', component: HistoryView },
      { path: '/dashboard/marketing/campaigns/:id', component: CampaignDetail }
    ]
  });
}

async function mountView(
  component: Component,
  path: string,
  fetchMock: ReturnType<typeof vi.fn> = offlineFetch()
) {
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  const pinia = createPinia();
  const router = buildRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, { global: { plugins: [pinia, router, Vant] } });
  liveWrappers.push(wrapper);
  await flushPromises();
  return { wrapper, router, pinia, store: useMarketingStore(pinia) };
}

beforeEach(() => {
  vi.clearAllMocks();
  batch.progress.value = null;
  batch.running.value = false;
  batch.paused.value = false;
  batch.failures.value = [];
  batch.lastSummary.value = null;
  batch.start.mockResolvedValue(null);
  batch.rerunFailures.mockResolvedValue(0);
});

afterEach(() => {
  while (liveWrappers.length > 0) liveWrappers.pop()?.unmount();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('Marketing hub', () => {
  it('renders the KPI row, the campaign grid and the page meta', async () => {
    const fetchMock = backend(
      hubRoutes([campaignFixture(), campaignFixture({ id: 'cmp-2', name: 'Festival greeting', status: 'draft' })])
    );
    const { wrapper } = await mountView(MarketingHub, '/dashboard/marketing', fetchMock);

    expect(wrapper.find('.mkt__title').text()).toBe('Marketing campaigns');
    expect(document.title).toBe('Marketing - KiliSocial');
    expect(wrapper.findAll('.mkt__kpi')).toHaveLength(4);
    expect(wrapper.findAll('.mkt__kpi-label').map((node) => node.text())).toEqual([
      'Sent this month',
      'Open rate',
      'Conversion rate',
      'Active campaigns'
    ]);
    expect(wrapper.findAll('.mkt__kpi-value').map((node) => node.text())).toEqual([
      '120',
      '42%',
      '18%',
      '2'
    ]);
    expect(wrapper.findAll('.c-card__name').map((node) => node.text())).toEqual([
      'Weekend kitenge sale',
      'Festival greeting'
    ]);
    expect(wrapper.find('.mkt__count').text()).toBe('2 campaigns');
    expect(wrapper.find('.mkt__demo').exists()).toBe(false);
    expect(urls(fetchMock).some((url) => url.includes('/overview'))).toBe(true);
  });

  it('labels the sample data and remembers when it is dismissed', async () => {
    const { wrapper } = await mountView(MarketingHub, '/dashboard/marketing');

    expect(wrapper.find('.mkt__demo').text()).toContain('Sample data.');
    expect(wrapper.findAll('.c-card__name').map((node) => node.text()).sort()).toEqual([
      'Festival greeting',
      'New arrival: handwoven bags',
      'Weekend kitenge sale'
    ]);

    await wrapper.find('.mkt__demo button').trigger('click');

    expect(wrapper.find('.mkt__demo').exists()).toBe(false);
    expect(localStorage.getItem(DEMO_HIDDEN_KEY)).toBe('1');
  });

  it('keeps the sample notice hidden on the next visit', async () => {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
    const fetchMock = offlineFetch();
    vi.stubGlobal('fetch', fetchMock);
    const router = buildRouter();
    await router.push('/dashboard/marketing');
    await router.isReady();
    const wrapper = mount(MarketingHub, {
      global: { plugins: [createPinia(), router, Vant] }
    });
    liveWrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.find('.mkt__demo').exists()).toBe(false);
    expect(wrapper.findAll('.c-card')).toHaveLength(3);
  });

  it('navigates home, to the wizard and to both sub pages', async () => {
    const { wrapper, router } = await mountView(
      MarketingHub,
      '/dashboard/marketing',
      backend(hubRoutes([]))
    );

    await wrapper.find('.mkt__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');

    await router.push('/dashboard/marketing');
    await flushPromises();
    await buttonByText(wrapper, '.mkt__top-actions .mkt__btn', 'New campaign')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/create');

    await router.push('/dashboard/marketing');
    await flushPromises();
    const links = wrapper.findAll('.mkt__link');
    expect(links.map((node) => node.text())).toEqual(['Templates', 'Send history']);
    expect(links.map((node) => node.attributes('href'))).toEqual([
      '/dashboard/marketing/templates',
      '/dashboard/marketing/history'
    ]);
  });

  it('offers every status as a tab and re-queries with the picked one', async () => {
    const fetchMock = backend(hubRoutes([campaignFixture()]));
    const { wrapper } = await mountView(MarketingHub, '/dashboard/marketing', fetchMock);

    expect(wrapper.findAll('.mkt__tab').map((node) => node.text())).toEqual([
      'All',
      'Draft',
      'Running',
      'Paused',
      'Completed',
      'Cancelled'
    ]);
    expect(wrapper.findAll('.mkt__tab')[0].classes()).toContain('is-active');
    expect(lastUrl(fetchMock)).not.toContain('status=');

    await wrapper.findAll('.mkt__tab')[2].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.mkt__tab')[2].classes()).toContain('is-active');
    expect(wrapper.findAll('.mkt__tab')[2].attributes('aria-selected')).toBe('true');
    expect(lastUrl(fetchMock)).toContain('status=running');
  });

  it('searches on submit and clears back to the full list', async () => {
    const fetchMock = backend(hubRoutes([campaignFixture()]));
    const { wrapper } = await mountView(MarketingHub, '/dashboard/marketing', fetchMock);
    const input = wrapper.find('.mkt__input');

    await input.setValue('kitenge');
    expect(buttonByText(wrapper, '.mkt__search .mkt__btn', 'Clear')!.exists()).toBe(true);
    await wrapper.find('.mkt__search').trigger('submit');
    await flushPromises();
    expect(lastUrl(fetchMock)).toContain('query=kitenge');

    await buttonByText(wrapper, '.mkt__search .mkt__btn', 'Clear')!.trigger('click');
    await flushPromises();
    expect((wrapper.find('.mkt__input').element as HTMLInputElement).value).toBe('');
    expect(lastUrl(fetchMock)).not.toContain('query=');
  });

  it('shows the empty state and its call to action when nothing matches', async () => {
    const { wrapper, router } = await mountView(
      MarketingHub,
      '/dashboard/marketing',
      backend(hubRoutes([]))
    );

    expect(wrapper.find('.mkt__grid').exists()).toBe(false);
    expect(wrapper.find('.mkt__empty-title').text()).toBe('No campaigns yet');
    expect(wrapper.find('.mkt__empty-hint').text()).toContain('Create your first campaign');

    await buttonByText(wrapper, '.mkt__empty .mkt__btn', 'New campaign')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/create');
  });

  it('pages through the list with load more', async () => {
    const fetchMock = backend([
      ['GET ' + MARKETING + '/overview', OVERVIEW],
      ['GET ' + MARKETING + '/campaigns', paged([campaignFixture()], true)]
    ]);
    const { wrapper, store } = await mountView(MarketingHub, '/dashboard/marketing', fetchMock);

    expect(wrapper.find('.mkt__more').exists()).toBe(true);
    fetchMock.mockImplementation((url: unknown) => {
      const full = String(url);
      if (full.includes('/overview')) return Promise.resolve(jsonResponse(OVERVIEW));
      return Promise.resolve(
        jsonResponse(
          paged([
            campaignFixture(),
            campaignFixture({ id: 'cmp-2', name: 'Festival greeting', status: 'draft' })
          ])
        )
      );
    });

    await buttonByText(wrapper, '.mkt__more .mkt__btn', 'Load more')!.trigger('click');
    await flushPromises();

    expect(lastUrl(fetchMock)).toContain('offset=1');
    expect(store.campaigns).toHaveLength(2);
  });

  it('surfaces a hard failure instead of pretending the list is empty', async () => {
    const { wrapper, store } = await mountView(
      MarketingHub,
      '/dashboard/marketing',
      errorFetch(500)
    );

    expect(wrapper.find('.mkt__error').text()).toBe('Server error, showing sample data');
    expect(showToast).toHaveBeenCalledWith('Server error, showing sample data');
    expect(store.hasDemoData).toBe(false);
  });

  it('starts a campaign from its card and confirms with a toast', async () => {
    const started = campaignFixture({ id: 'cmp-1', status: 'draft' });
    const fetchMock = backend(
      hubRoutes([started], [
        ['POST ' + MARKETING + '/campaigns/cmp-1/start', campaignFixture({ status: 'running' })]
      ])
    );
    const { wrapper, store } = await mountView(MarketingHub, '/dashboard/marketing', fetchMock);

    await buttonByText(wrapper, '.c-card__btn', 'Start')!.trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('/campaigns/cmp-1/start'))).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Campaign started');
    expect(store.campaigns[0].status).toBe('running');
  });

  it('opens the detail page from the card', async () => {
    const { wrapper, router } = await mountView(
      MarketingHub,
      '/dashboard/marketing',
      backend(hubRoutes([campaignFixture()]))
    );

    await buttonByText(wrapper, '.c-card__btn', 'Open')!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/campaigns/cmp-1');
  });
});

/* ---------------------------------------------------------- campaign detail */

/**
 * The records url extends the detail url and both extend the list url, so the
 * specific routes are declared first for the first-match table.
 */
function detailRoutes(
  campaign: Campaign,
  records: SendRecord[] = [],
  extra: Route[] = []
): Route[] {
  return [
    ['GET ' + MARKETING + '/campaigns/cmp-1/records', records],
    ...extra,
    ['GET ' + MARKETING + '/campaigns/cmp-1', campaign]
  ];
}

const DETAIL_PATH = '/dashboard/marketing/campaigns/cmp-1';
const DEMO_DETAIL_PATH = '/dashboard/marketing/campaigns/cmp-running';
const ACTION_SELECTOR = '.mkt-d__actions .mkt-d__btn';

function actionLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll(ACTION_SELECTOR).map((node) => node.text().trim());
}

function liveProgress(patch: Partial<BatchSendProgress> = {}): BatchSendProgress {
  return {
    total: 12,
    done: 7,
    failed: 2,
    running: true,
    percent: 58,
    etaMs: 60000,
    currentName: 'Amani Juma',
    ratePerMinute: 10,
    ...patch
  };
}

function failedRecord(patch: Partial<SendRecord> = {}): SendRecord {
  return recordFixture({
    id: 'rec-2',
    recipientId: 'r-2',
    recipientName: 'Baraka Neema',
    status: 'failed',
    failureReason: 'Number not on WhatsApp',
    sentAt: null,
    opened: false,
    ...patch
  });
}

describe('CampaignDetail', () => {
  it('renders the header, the audience meta and the performance tiles', async () => {
    const fetchMock = backend(detailRoutes(campaignFixture(), [recordFixture()]));
    const { wrapper } = await mountView(CampaignDetail, DETAIL_PATH, fetchMock);

    expect(wrapper.find('.mkt-d__title').text()).toBe('Weekend kitenge sale');
    expect(wrapper.find('.mkt-d__subtitle').text()).toBe('Weekend flash sale');
    expect(document.title).toBe('Campaign - KiliSocial');

    const status = wrapper.find('.mkt-d__status');
    expect(status.text()).toBe('Running');
    expect(status.classes()).toContain('is-running');

    const rows = wrapper.findAll('.mkt-d__meta-row');
    expect(rows[0].find('dt').text()).toBe('12 recipients');
    expect(rows[0].find('dd').text()).toContain('Created');
    expect(rows[1].find('dd').text()).toBe('WhatsApp');
    expect(rows[2].find('dd').text()).toBe('10 / min');

    expect(wrapper.findAll('.mkt-d__stat-label').map((node) => node.text())).toEqual([
      'Delivered',
      'Opened',
      'Clicked',
      'Replied',
      'Converted'
    ]);
    expect(wrapper.findAll('.mkt-d__stat-value').map((node) => node.text())).toEqual([
      '9',
      '6',
      '3',
      '2',
      '1'
    ]);
    expect(wrapper.findAll('.mkt-d__rate dd').map((node) => node.text())).toEqual([
      '67%',
      '33%',
      '22%',
      '11%'
    ]);
    expect(urls(fetchMock).some((url) => url.includes('/campaigns/cmp-1/records'))).toBe(true);
  });

  it('lists every delivery with its channel, state and failure reason', async () => {
    const { wrapper } = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture(), [recordFixture(), failedRecord()]))
    );

    const rows = wrapper.findAll('.mkt-d__record');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.mkt-d__record-name').text()).toBe('Amani Juma');
    expect(rows[0].find('.mkt-d__record-channel').text()).toBe('WhatsApp');
    expect(rows[0].find('.mkt-d__record-status').text()).toBe('Sent');
    expect(rows[0].find('.mkt-d__record-status').classes()).toContain('is-sent');
    expect(rows[0].find('.mkt-d__record-reason').exists()).toBe(false);
    expect(rows[1].find('.mkt-d__record-status').classes()).toContain('is-failed');
    expect(rows[1].find('.mkt-d__record-reason').text()).toBe('Number not on WhatsApp');
    expect(rows[1].find('.mkt-d__record-time').text()).toBe('—');
  });

  it('explains an empty record list and withholds the retry action', async () => {
    const { wrapper } = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture(), []))
    );

    expect(wrapper.find('.mkt-d__records').exists()).toBe(false);
    expect(wrapper.find('.mkt-d__records-empty').text()).toBe('Nothing delivered yet.');
    expect(actionLabels(wrapper).some((label) => label.startsWith('Retry failed'))).toBe(false);
  });

  it('hides the progress panel until something has been sent', async () => {
    const draft = campaignFixture({
      status: 'draft',
      startedAt: null,
      progress: { total: 12, sent: 0, failed: 0, pending: 12, percent: 0, ratePerMinute: 10 }
    });
    const { wrapper } = await mountView(CampaignDetail, DETAIL_PATH, backend(detailRoutes(draft)));

    expect(wrapper.find('.mkt-d__percent').exists()).toBe(false);
    expect(wrapper.find('.mkt-d__bar').exists()).toBe(false);
    expect(wrapper.find('.mkt-d__counters').exists()).toBe(false);
  });

  it('mirrors the live batch counters over the stored progress', async () => {
    const { wrapper, store } = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture()))
    );

    expect(wrapper.findAll('.mkt-d__counters li').map((node) => node.text())).toEqual([
      'Sent 5',
      'Failed 1',
      'Pending 6'
    ]);

    store.setProgress(liveProgress());
    await flushPromises();

    expect(wrapper.find('.mkt-d__percent').text()).toBe('58%');
    expect(wrapper.find('.mkt-d__bar').attributes('aria-valuenow')).toBe('58');
    const live = wrapper.findAll('.mkt-d__counters li').map((node) => node.text());
    expect(live[0]).toBe('Sent 7');
    expect(live[1]).toBe('Failed 2');
    expect(live[2]).toBe('Pending 3');
    expect(live[3]).toContain('Remaining');
  });

  it('offers only the transitions the current status allows', async () => {
    const draft = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture({ status: 'draft' })))
    );
    expect(actionLabels(draft.wrapper)).toEqual(['Refresh', 'Start', 'Cancel']);

    const running = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture({ status: 'running' })))
    );
    expect(actionLabels(running.wrapper)).toEqual(['Refresh', 'Pause', 'Cancel']);

    const finished = await mountView(
      CampaignDetail,
      DETAIL_PATH,
      backend(detailRoutes(campaignFixture({ status: 'completed', finishedAt: NOW })))
    );
    expect(actionLabels(finished.wrapper)).toEqual(['Refresh']);
  });

  it('starts the campaign, toasts and flips the badge', async () => {
    const fetchMock = backend(
      detailRoutes(campaignFixture({ status: 'draft' }), [], [
        ['POST ' + MARKETING + '/campaigns/cmp-1/start', campaignFixture({ status: 'running' })]
      ])
    );
    const { wrapper, store } = await mountView(CampaignDetail, DETAIL_PATH, fetchMock);

    await buttonByText(wrapper, ACTION_SELECTOR, 'Start')!.trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('/campaigns/cmp-1/start'))).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Campaign started');
    expect(store.currentCampaign?.status).toBe('running');
    expect(wrapper.find('.mkt-d__status').text()).toBe('Running');
  });

  it('retries the failed deliveries and reports the queued count', async () => {
    const fetchMock = backend(
      detailRoutes(campaignFixture(), [recordFixture(), failedRecord()], [
        ['POST ' + MARKETING + '/campaigns/cmp-1/retry', { retried: 2 }]
      ])
    );
    const { wrapper } = await mountView(CampaignDetail, DETAIL_PATH, fetchMock);

    const retry = buttonByText(wrapper, ACTION_SELECTOR, 'Retry failed (1)')!;
    expect(retry.exists()).toBe(true);
    await retry.trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('/campaigns/cmp-1/retry'))).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Retried 2 failed messages');
  });

  it('re-reads the campaign on refresh and returns to the list from the arrow', async () => {
    const fetchMock = backend(detailRoutes(campaignFixture(), [recordFixture()]));
    const { wrapper, router } = await mountView(CampaignDetail, DETAIL_PATH, fetchMock);
    const before = urls(fetchMock).length;

    await buttonByText(wrapper, ACTION_SELECTOR, 'Refresh')!.trigger('click');
    await flushPromises();

    expect(urls(fetchMock)).toHaveLength(before + 2);
    expect(lastUrl(fetchMock)).toContain('/campaigns/cmp-1/records');

    await wrapper.find('.mkt-d__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing');
  });

  it('reports an unknown campaign instead of rendering an empty shell', async () => {
    const { wrapper, router } = await mountView(
      CampaignDetail,
      '/dashboard/marketing/campaigns/cmp-missing'
    );

    expect(wrapper.find('.mkt-d__title').text()).toBe('Campaign');
    expect(wrapper.find('.mkt-d__empty-title').text()).toBe('Campaign not found.');
    expect(showToast).toHaveBeenCalledWith('Not found, showing sample data');

    await buttonByText(wrapper, '.mkt-d__empty .mkt-d__btn', 'All campaigns')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing');
  });

  it('labels a server failure as such rather than as a missing campaign', async () => {
    const { wrapper, store } = await mountView(CampaignDetail, DETAIL_PATH, errorFetch(500));

    expect(store.currentCampaign).toBeNull();
    expect(wrapper.find('.mkt-d__empty-title').text()).toBe('Campaign not found.');
    expect(showToast).toHaveBeenCalledWith('Server error, showing sample data');
  });

  it('keeps a loading line while the campaign is still in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined))
    );
    const pinia = createPinia();
    const router = buildRouter();
    await router.push(DETAIL_PATH);
    await router.isReady();
    const wrapper = mount(CampaignDetail, { global: { plugins: [pinia, router, Vant] } });
    liveWrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.find('.mkt-d__loading').text()).toBe('Loading…');
    expect(wrapper.find('.mkt-d__empty').exists()).toBe(false);
  });

  it('renders the sample campaign when the marketing api is absent', async () => {
    const { wrapper, store } = await mountView(CampaignDetail, DEMO_DETAIL_PATH);

    expect(wrapper.find('.mkt-d__title').text()).toBe('Weekend kitenge sale');
    expect(wrapper.find('.mkt-d__status').text()).toBe('Running');
    expect(store.currentCampaign?.demo).toBe(true);
  });
});

/* ------------------------------------------------------------- templates */

const TEMPLATES_PATH = '/dashboard/marketing/templates';

/** Extra routes first: they are all more specific than the bare list url. */
function templateRoutes(templates: MarketingTemplate[], extra: Route[] = []): Route[] {
  return [...extra, ['GET ' + MARKETING + '/templates', templates]];
}

function methods(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => {
    const init = (call[1] ?? {}) as { method?: string };
    return String(init.method ?? 'GET').toUpperCase();
  });
}

/** The dialog fields render in a fixed order: name, goal, title, body, cta. */
async function fillTemplate(
  wrapper: VueWrapper,
  values: { name?: string; title?: string; body?: string; cta?: string }
): Promise<void> {
  const fields = wrapper.findAll('.tpl-field');
  if (values.name !== undefined) await fields[0].find('input').setValue(values.name);
  if (values.title !== undefined) await fields[2].find('input').setValue(values.title);
  if (values.body !== undefined) await fields[3].find('textarea').setValue(values.body);
  if (values.cta !== undefined) await fields[4].find('input').setValue(values.cta);
}

function fieldValue(wrapper: VueWrapper, index: number, tag: string): string {
  const field = wrapper.findAll('.tpl-field')[index].find(tag);
  return (field.element as HTMLInputElement).value;
}

describe('Templates', () => {
  const TWO = [
    templateFixture(),
    templateFixture({
      id: 'tpl-2',
      name: 'Festival greeting',
      category: 'festival',
      title: 'Sikukuu njema',
      content: 'Karibu rafiki, tunakukaribisha duka letu.',
      cta: 'Tazama bidhaa'
    })
  ];

  it('renders the toolbar, the goal tabs and the grid', async () => {
    const { wrapper, router } = await mountView(
      TemplatesView,
      TEMPLATES_PATH,
      backend(templateRoutes(TWO))
    );

    expect(wrapper.find('.tpl__title').text()).toBe('Templates');
    expect(document.title).toBe('Templates - KiliSocial');
    expect(wrapper.find('.tpl__count').text()).toContain('2');
    expect(wrapper.findAll('.tpl__tab').map((node) => node.text())).toEqual([
      'All goals',
      'Promotion',
      'New arrival',
      'Festival',
      'Win-back',
      'Custom'
    ]);
    expect(wrapper.findAll('.tpl__tab')[0].classes()).toContain('is-active');
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toEqual([
      'Weekend promotion',
      'Festival greeting'
    ]);

    await wrapper.find('.tpl__home').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing');
  });

  it('filters by goal on the client without another request', async () => {
    const fetchMock = backend(templateRoutes(TWO));
    const { wrapper } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);
    const before = urls(fetchMock).length;

    await wrapper.findAll('.tpl__tab')[3].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.tpl__tab')[3].classes()).toContain('is-active');
    expect(wrapper.findAll('.tpl__tab')[3].attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toEqual([
      'Festival greeting'
    ]);
    expect(urls(fetchMock)).toHaveLength(before);
  });

  it('searches across name and body and falls into the empty state', async () => {
    const { wrapper } = await mountView(
      TemplatesView,
      TEMPLATES_PATH,
      backend(templateRoutes(TWO))
    );

    await wrapper.find('.tpl__input').setValue('festival');
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toEqual([
      'Festival greeting'
    ]);

    await wrapper.find('.tpl__input').setValue('fifteen');
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toEqual([
      'Weekend promotion'
    ]);

    await wrapper.find('.tpl__input').setValue('zzz');
    expect(wrapper.find('.tpl__grid').exists()).toBe(false);
    expect(wrapper.find('.tpl__empty-title').text()).toBe('No template matches.');
  });

  it('opens the create dialog and blocks an incomplete template', async () => {
    const fetchMock = backend(templateRoutes([templateFixture()]));
    const { wrapper } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);
    const before = urls(fetchMock).length;

    await buttonByText(wrapper, '.tpl__top .tpl__btn', 'New template')!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.tpl-overlay').exists()).toBe(true);
    expect(wrapper.find('.tpl-overlay').attributes('aria-modal')).toBe('true');
    expect(wrapper.find('.tpl-dialog__title').text()).toBe('New template');
    expect(wrapper.findAll('.tpl-field__hint').map((node) => node.text())).toEqual([
      'Max 40 characters',
      'Max 2000 characters'
    ]);
    expect(fieldValue(wrapper, 0, 'input')).toBe('');

    await wrapper.find('.tpl-dialog').trigger('submit');
    await flushPromises();

    expect(wrapper.findAll('.tpl-field__error').map((node) => node.text())).toEqual([
      'Name the template.',
      'Add a message title.',
      'Add the message body.'
    ]);
    expect(wrapper.findAll('.tpl-field__input.is-invalid')).toHaveLength(3);
    expect(wrapper.find('.tpl-overlay').exists()).toBe(true);
    expect(urls(fetchMock)).toHaveLength(before);
  });

  it('creates a template, toasts and prepends the card', async () => {
    const created = templateFixture({ id: 'tpl-9', name: 'Harvest promo' });
    const fetchMock = backend(
      templateRoutes([templateFixture()], [['POST ' + MARKETING + '/templates', created]])
    );
    const { wrapper, store } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);

    await buttonByText(wrapper, '.tpl__top .tpl__btn', 'New template')!.trigger('click');
    await flushPromises();
    await fillTemplate(wrapper, {
      name: 'Harvest promo',
      title: 'Fresh harvest',
      body: 'Twelve percent off every sheet.'
    });
    await wrapper.find('.tpl-dialog').trigger('submit');
    await flushPromises();

    const postAt = methods(fetchMock).indexOf('POST');
    expect(postAt).toBeGreaterThan(-1);
    expect(bodyOf(fetchMock, postAt)).toContain('Harvest promo');
    expect(showToast).toHaveBeenCalledWith('Template saved');
    expect(wrapper.find('.tpl-overlay').exists()).toBe(false);
    expect(store.templates.map((item) => item.id)).toEqual(['tpl-9', 'tpl-1']);
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toEqual([
      'Harvest promo',
      'Weekend promotion'
    ]);
  });

  it('prefills the edit dialog and puts the change', async () => {
    const updated = templateFixture({ content: 'Twelve percent off everything.' });
    const fetchMock = backend(
      templateRoutes([templateFixture()], [
        ['PUT ' + MARKETING + '/templates/tpl-1', updated]
      ])
    );
    const { wrapper } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);

    await buttonByText(wrapper, '.t-card__btn', 'Edit')!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.tpl-dialog__title').text()).toBe('Edit');
    expect(fieldValue(wrapper, 0, 'input')).toBe('Weekend promotion');
    expect(fieldValue(wrapper, 3, 'textarea')).toBe('Fifteen percent off until Sunday midnight.');

    await wrapper.findAll('.tpl-field')[3].find('textarea').setValue('Twelve percent off everything.');
    await wrapper.find('.tpl-dialog').trigger('submit');
    await flushPromises();

    expect(methods(fetchMock)).toContain('PUT');
    expect(urls(fetchMock).some((url) => url.includes('/templates/tpl-1'))).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Template updated');
    expect(wrapper.find('.tpl-overlay').exists()).toBe(false);
  });

  it('deletes only after the reader confirms', async () => {
    const fetchMock = backend(
      templateRoutes([templateFixture()], [['DELETE ' + MARKETING + '/templates/tpl-1', null]])
    );
    const { wrapper, store } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);
    const confirm = showConfirmDialog as unknown as ReturnType<typeof vi.fn>;

    confirm.mockRejectedValueOnce('cancel');
    await buttonByText(wrapper, '.t-card__btn', 'Delete')!.trigger('click');
    await flushPromises();

    expect(methods(fetchMock)).not.toContain('DELETE');
    expect(store.templates).toHaveLength(1);

    await buttonByText(wrapper, '.t-card__btn', 'Delete')!.trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete template',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
      })
    );
    expect(methods(fetchMock)).toContain('DELETE');
    expect(showToast).toHaveBeenCalledWith('Template deleted');
    expect(store.templates).toHaveLength(0);
    expect(wrapper.find('.tpl__empty-title').text()).toBe('No template matches.');
  });

  it('hands the template to the wizard on use', async () => {
    const fetchMock = backend(
      templateRoutes([templateFixture()], [
        ['POST ' + MARKETING + '/templates/tpl-1/use', templateFixture({ usageCount: 4 })]
      ])
    );
    const { wrapper, router, store } = await mountView(TemplatesView, TEMPLATES_PATH, fetchMock);

    await buttonByText(wrapper, '.t-card__btn', 'Use')!.trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('/templates/tpl-1/use'))).toBe(true);
    expect(showToast).toHaveBeenCalledWith('Template loaded into the editor');
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/create');
    expect(store.generatedContent?.title).toBe('Weekend flash sale');
    expect(store.templates[0].usageCount).toBe(4);
  });

  it('closes the dialog from the backdrop and from cancel', async () => {
    const { wrapper } = await mountView(
      TemplatesView,
      TEMPLATES_PATH,
      backend(templateRoutes([templateFixture()]))
    );
    const open = buttonByText(wrapper, '.tpl__top .tpl__btn', 'New template')!;

    await open.trigger('click');
    await flushPromises();
    expect(wrapper.find('.tpl-overlay').exists()).toBe(true);
    await wrapper.find('.tpl-overlay').trigger('click');
    await flushPromises();
    expect(wrapper.find('.tpl-overlay').exists()).toBe(false);

    await open.trigger('click');
    await flushPromises();
    await buttonByText(wrapper, '.tpl-dialog__actions .tpl__btn', 'Cancel')!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.tpl-overlay').exists()).toBe(false);
  });

  it('falls back to the sample library when the api is absent', async () => {
    const { wrapper, store } = await mountView(TemplatesView, TEMPLATES_PATH);

    expect(wrapper.findAll('.t-card__name')).toHaveLength(5);
    expect(wrapper.findAll('.t-card__name').map((node) => node.text())).toContain('Blank canvas');
    expect(store.templates.every((item) => item.demo === true)).toBe(true);
  });

  it('surfaces a hard failure instead of an empty library', async () => {
    const { wrapper, store } = await mountView(TemplatesView, TEMPLATES_PATH, errorFetch(500));

    expect(wrapper.find('.tpl__error').text()).toBe('Server error, showing sample data');
    expect(showToast).toHaveBeenCalledWith('Server error, showing sample data');
    expect(store.templates).toHaveLength(0);
    expect(wrapper.find('.tpl__grid').exists()).toBe(false);
    expect(wrapper.find('.tpl__empty-title').text()).toBe('No template matches.');
  });

  it('keeps a loading line while the library is in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined))
    );
    const pinia = createPinia();
    const router = buildRouter();
    await router.push(TEMPLATES_PATH);
    await router.isReady();
    const wrapper = mount(TemplatesView, { global: { plugins: [pinia, router, Vant] } });
    liveWrappers.push(wrapper);
    await flushPromises();

    expect(wrapper.find('.tpl__loading').text()).toBe('Loading…');
    expect(wrapper.find('.tpl__empty').exists()).toBe(false);
  });
});

/* ------------------------------------------------------------ send history */

const HISTORY_PATH = '/dashboard/marketing/history';

const FAILED_RECORD = recordFixture({
  id: 'rec-2',
  recipientName: 'Baraka Salim',
  status: 'failed',
  failureReason: 'carrier rejected',
  opened: false,
  sentAt: NOW - 3600000
});

function historyPage(records: SendRecord[], hasMore = false, total = records.length) {
  return { records, hasMore, total };
}

/** The log owns the /history url, the campaign select owns the list url. */
function historyRoutes(records: SendRecord[], extra: Route[] = []): Route[] {
  return [
    ...extra,
    ['GET ' + MARKETING + '/history', historyPage(records)],
    ['GET ' + MARKETING + '/campaigns', paged([campaignFixture()])]
  ];
}

function postedTo(mock: ReturnType<typeof vi.fn>, needle: string): boolean {
  return mock.mock.calls.some((call) => {
    const init = (call[1] ?? {}) as { method?: string };
    return String(init.method ?? 'GET').toUpperCase() === 'POST' && String(call[0]).includes(needle);
  });
}

function postBody(mock: ReturnType<typeof vi.fn>, needle: string): Record<string, unknown> {
  const index = mock.mock.calls.findIndex((call) => {
    const init = (call[1] ?? {}) as { method?: string };
    return String(init.method ?? 'GET').toUpperCase() === 'POST' && String(call[0]).includes(needle);
  });
  return JSON.parse(bodyOf(mock, index)) as Record<string, unknown>;
}

function lastToast(): string {
  const calls = (showToast as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return String(calls[calls.length - 1][0]);
}

/**
 * jsdom has no object URL support, which is the branch the export button toasts
 * about. Installing one exercises the download branch instead of skipping it.
 */
function withObjectUrlSupport(): () => void {
  const scope = URL as unknown as {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  const hadCreate = typeof scope.createObjectURL === 'function';
  const hadRevoke = typeof scope.revokeObjectURL === 'function';
  const previousCreate = scope.createObjectURL;
  const previousRevoke = scope.revokeObjectURL;
  const previousClick = HTMLAnchorElement.prototype.click;
  scope.createObjectURL = () => 'blob:kili-mock';
  scope.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = vi.fn();
  return () => {
    if (hadCreate) scope.createObjectURL = previousCreate;
    else delete scope.createObjectURL;
    if (hadRevoke) scope.revokeObjectURL = previousRevoke;
    else delete scope.revokeObjectURL;
    HTMLAnchorElement.prototype.click = previousClick;
  };
}

describe('Send history', () => {
  const TWO_RECORDS = [recordFixture(), FAILED_RECORD];

  it('renders the log, the column head and the campaign filter', async () => {
    const fetchMock = backend(historyRoutes(TWO_RECORDS));
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, fetchMock);

    expect(wrapper.find('.hist__title').text()).toBe('Send history');
    expect(document.title).toBe('Send history - KiliSocial');
    expect(wrapper.find('.hist__count').text()).toBe('2 records');
    expect(wrapper.findAll('.hist__head span').map((node) => node.text())).toEqual([
      'Recipient',
      'Campaign',
      'Channel',
      'Status',
      'Time'
    ]);
    expect(wrapper.findAll('.hist__cell--name').map((node) => node.text())).toEqual([
      'Amani Juma',
      'Baraka Salim'
    ]);
    expect(wrapper.findAll('.hist__status').map((node) => node.text())).toEqual(['Sent', 'Failed']);
    expect(wrapper.findAll('.hist__status')[1].attributes('data-status')).toBe('failed');
    expect(wrapper.find('.hist__reason').text()).toContain('carrier rejected');
    expect(wrapper.findAll('.hist__row')[0].findAll('.hist__flag.is-on')).toHaveLength(1);
    expect(wrapper.find('.hist__when').text().length).toBeGreaterThan(0);
    expect(wrapper.findAll('.hist__field--grow option').map((node) => node.text())).toEqual([
      'All campaigns',
      'Weekend kitenge sale'
    ]);
    expect(wrapper.find('.hist__more').exists()).toBe(false);
    expect(buttonByText(wrapper, '.hist__btn', 'Export CSV')!.attributes('disabled')).toBeUndefined();
  });

  it('reads a queued row as pending', async () => {
    const queued = recordFixture({
      id: 'rec-4',
      recipientName: 'Neema Kondo',
      status: 'pending',
      sentAt: null,
      opened: false
    });
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, backend(historyRoutes([queued])));

    expect(wrapper.find('.hist__status').text()).toBe('Pending');
    expect(wrapper.find('.hist__when').text()).toBe('Pending');
    expect(wrapper.findAll('.hist__flag.is-on')).toHaveLength(0);
  });

  it('sends the date range and the campaign id as query params', async () => {
    const filtered = historyPage([FAILED_RECORD], false, 1);
    const fetchMock = backend(
      historyRoutes(TWO_RECORDS, [['campaignId=cmp-1', filtered]])
    );
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, fetchMock);

    const dates = wrapper.findAll('input.hist__input');
    await dates[0].setValue('2026-08-01');
    await dates[1].setValue('2026-08-31');
    await wrapper.find('.hist__field--grow select').setValue('cmp-1');
    await wrapper.find('form.hist__filters').trigger('submit');
    await flushPromises();

    const from = new Date(2026, 7, 1).getTime();
    const to = new Date(2026, 7, 31).getTime() + 86399999;
    expect(lastUrl(fetchMock)).toContain('from=' + from);
    expect(lastUrl(fetchMock)).toContain('to=' + to);
    expect(lastUrl(fetchMock)).toContain('campaignId=cmp-1');
    expect(wrapper.findAll('.hist__row')).toHaveLength(1);
    expect(wrapper.find('.hist__count').text()).toBe('1 records');
  });

  it('clears every filter on reset', async () => {
    const fetchMock = backend(historyRoutes(TWO_RECORDS));
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, fetchMock);

    await wrapper.find('.hist__field--grow select').setValue('cmp-1');
    await wrapper.find('form.hist__filters').trigger('submit');
    await flushPromises();
    expect(lastUrl(fetchMock)).toContain('campaignId=cmp-1');

    await buttonByText(wrapper, '.hist__btn', 'Reset filters')!.trigger('click');
    await flushPromises();

    expect(lastUrl(fetchMock)).not.toContain('campaignId=');
    expect(lastUrl(fetchMock)).not.toContain('from=');
    const select = wrapper.find('.hist__field--grow select').element as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(wrapper.findAll('.hist__row')).toHaveLength(2);
  });

  it('pages the log and drops the overlap between pages', async () => {
    const second = historyPage(
      [recordFixture(), recordFixture({ id: 'rec-3', recipientName: 'Chausi Hamisi' })],
      false,
      3
    );
    const fetchMock = backend([
      ['offset=2', second],
      ['GET ' + MARKETING + '/history', historyPage(TWO_RECORDS, true, 3)],
      ['GET ' + MARKETING + '/campaigns', paged([campaignFixture()])]
    ]);
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, fetchMock);

    expect(wrapper.find('.hist__more').exists()).toBe(true);
    await buttonByText(wrapper, '.hist__more .hist__btn', 'Load more')!.trigger('click');
    await flushPromises();

    expect(urls(fetchMock).some((url) => url.includes('offset=2'))).toBe(true);
    expect(wrapper.findAll('.hist__cell--name').map((node) => node.text())).toEqual([
      'Amani Juma',
      'Baraka Salim',
      'Chausi Hamisi'
    ]);
    expect(wrapper.find('.hist__more').exists()).toBe(false);
  });

  it('reports a browser that cannot save the file', async () => {
    const { wrapper } = await mountView(
      HistoryView,
      HISTORY_PATH,
      backend(historyRoutes(TWO_RECORDS))
    );

    await buttonByText(wrapper, '.hist__btn', 'Export CSV')!.trigger('click');

    expect(showToast).toHaveBeenCalledWith('Export unavailable in this browser');
  });

  it('exports the rows that are on screen', async () => {
    const restore = withObjectUrlSupport();
    try {
      const { wrapper } = await mountView(
        HistoryView,
        HISTORY_PATH,
        backend(historyRoutes(TWO_RECORDS))
      );

      await buttonByText(wrapper, '.hist__btn', 'Export CSV')!.trigger('click');

      const message = lastToast();
      expect(message.startsWith('Exported 2 rows to kili-social-send-history-')).toBe(true);
      expect(message.endsWith('.csv')).toBe(true);
      expect(message).toContain(String(new Date().getFullYear()));
    } finally {
      restore();
    }
  });

  it('surfaces a server error next to the empty state', async () => {
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH, errorFetch(500));

    expect(wrapper.find('.hist__error').text()).toBe('Server error, showing sample data');
    expect(wrapper.find('.hist__empty-text').text()).toBe('No records for this filter.');
    expect(showToast).toHaveBeenCalledWith('Server error, showing sample data');
  });

  it('falls back to the demo log when the api is missing', async () => {
    const { wrapper } = await mountView(HistoryView, HISTORY_PATH);

    /* No marketing api at all, so the page serves the seeded demo log instead. */
    const rows = wrapper.findAll('.hist__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(wrapper.find('.hist__empty').exists()).toBe(false);
    expect(localStorage.getItem('ks-demo-mode')).toBe('1');
    expect(wrapper.find('.hist__count').text()).toContain('records');
    expect(wrapper.findAll('.hist__field--grow option').map((node) => node.text())).toContain(
      'Weekend kitenge sale'
    );
    expect(buttonByText(wrapper, '.hist__btn', 'Export CSV')!.attributes('disabled')).toBeUndefined();
  });
});


/* ---------------------------------------------------- create campaign wizard */

const WIZARD_PATH = '/dashboard/marketing/create';
const CAMPAIGN_NAME = 'Easter hardware promo';
const CREATED = campaignFixture({ id: 'cmp-9', name: CAMPAIGN_NAME, status: 'draft' });

/**
 * The wizard touches four endpoints before it can submit: the template bank,
 * the channel list, the audience query and the campaign create. Detail last,
 * because its url extends the list url.
 */
function wizardRoutes(extra: Route[] = []): Route[] {
  return [
    ...extra,
    ['GET ' + MARKETING + '/templates', [templateFixture()]],
    ['POST ' + MARKETING + '/templates/tpl-1/use', templateFixture({ usageCount: 4 })],
    ['GET ' + MARKETING + '/channels', ['whatsapp', 'facebook']],
    [
      'POST ' + MARKETING + '/recipients/query',
      [recipientFixture(), recipientFixture({ id: 'r-2', name: 'Baraka Salim', handle: '+255700000002' })]
    ],
    ['GET ' + MARKETING + '/campaigns/cmp-9', CREATED],
    ['POST ' + MARKETING + '/campaigns', CREATED]
  ];
}

/** Step one is only passable with a name and sendable copy; the template gives both. */
async function fillContent(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('#wiz-name').setValue(CAMPAIGN_NAME);
  await wrapper.find('#wiz-template').setValue('tpl-1');
  await flushPromises();
}

async function nextStep(wrapper: VueWrapper): Promise<void> {
  await buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.trigger('click');
  await flushPromises();
}

async function selectAudience(wrapper: VueWrapper): Promise<void> {
  await buttonByText(wrapper, '.r-sel__btn', 'Select valid')!.trigger('click');
  await flushPromises();
}

function submitButton(wrapper: VueWrapper) {
  return buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Create campaign');
}

/** Walks the wizard to the delivery step, which every submit test starts from. */
async function reachSendStep(wrapper: VueWrapper): Promise<void> {
  await fillContent(wrapper);
  await nextStep(wrapper);
  await selectAudience(wrapper);
  await nextStep(wrapper);
}

describe('Create campaign wizard', () => {
  it('renders the step rail and keeps Next locked until the copy is sendable', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);

    expect(wrapper.find('.wiz__title').text()).toBe('Create campaign');
    expect(document.title).toBe('Create campaign - KiliSocial');
    expect(wrapper.findAll('.wiz__step').map((node) => node.text())).toEqual([
      '1. Content',
      '2. Audience',
      '3. Send'
    ]);
    expect(wrapper.findAll('.wiz__step')[0].classes()).toContain('is-active');
    expect(wrapper.find('.wiz__section').text()).toBe('Write the message');
    expect(wrapper.find('.c-edit').exists()).toBe(false);
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeDefined();
    expect(buttonByText(wrapper, '.wiz__top .wiz__btn', 'Discard draft')!.exists()).toBe(true);
    expect(urls(fetchMock).some((url) => url.includes('/templates'))).toBe(true);
    expect(urls(fetchMock).some((url) => url.includes('/channels'))).toBe(true);
  });

  it('loads a template into the editor and unlocks the step', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);

    await wrapper.find('#wiz-name').setValue(CAMPAIGN_NAME);
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeDefined();

    await wrapper.find('#wiz-template').setValue('tpl-1');
    await flushPromises();

    expect(wrapper.find('.c-edit').exists()).toBe(true);
    expect(wrapper.find('.c-edit__badge').classes()).toContain('is-ok');
    expect((wrapper.find('.c-edit__textarea').element as HTMLTextAreaElement).value).toBe(
      'Fifteen percent off until Sunday midnight.'
    );
    expect(showToast).toHaveBeenCalledWith('Template loaded into the editor');
    expect(postedTo(fetchMock, '/templates/tpl-1/use')).toBe(true);
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeUndefined();
  });

  it('needs a name, then an audience, before the delivery step', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);

    await wrapper.find('#wiz-template').setValue('tpl-1');
    await flushPromises();
    /* Sendable copy but no campaign name: the gate stays closed. */
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeDefined();

    await wrapper.find('#wiz-name').setValue(CAMPAIGN_NAME);
    await nextStep(wrapper);

    expect(wrapper.findAll('.wiz__step')[1].classes()).toContain('is-active');
    expect(wrapper.find('.wiz__section').text()).toBe('Choose recipients');
    expect(wrapper.findAll('.r-sel__row')).toHaveLength(2);
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeDefined();

    await selectAudience(wrapper);

    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeUndefined();
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Back')!.exists()).toBe(true);
    expect(postedTo(fetchMock, '/recipients/query')).toBe(true);
  });

  it('exposes the delivery settings and discloses a clamped rate', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await reachSendStep(wrapper);

    expect(wrapper.find('.wiz__section').text()).toBe('Delivery settings');
    expect(wrapper.findAll('.wiz__seg').map((node) => node.text())).toEqual(['Send now', 'Schedule']);
    expect(wrapper.findAll('.wiz__seg')[0].classes()).toContain('is-active');
    expect(wrapper.find('#wiz-when').exists()).toBe(false);

    await wrapper.findAll('.wiz__seg')[1].trigger('click');
    expect(wrapper.find('#wiz-when').exists()).toBe(true);
    await wrapper.findAll('.wiz__seg')[0].trigger('click');
    expect(wrapper.find('#wiz-when').exists()).toBe(false);

    expect(wrapper.findAll('.wiz__chip').map((node) => node.text())).toEqual([
      'WhatsApp',
      'Facebook',
      'Instagram',
      'TikTok'
    ]);
    expect(wrapper.findAll('.wiz__chip')[1].attributes('aria-pressed')).toBe('false');
    await wrapper.findAll('.wiz__chip')[1].trigger('click');
    expect(wrapper.findAll('.wiz__chip')[1].attributes('aria-pressed')).toBe('true');
    expect(wrapper.findAll('.wiz__chip')[1].classes()).toContain('is-active');

    expect(wrapper.find('.wiz__warn').exists()).toBe(false);
    await wrapper.find('#wiz-rate').setValue('60');
    expect(wrapper.find('.wiz__warn').text()).toBe(
      'Rate adjusted to stay inside the product limits.'
    );

    expect(wrapper.findAll('.wiz__review-row dt')[1].text()).toBe('2 selected');
    expect(wrapper.findAll('.wiz__review-row dd')[0].text()).toBe(CAMPAIGN_NAME);
    expect(wrapper.findAll('.wiz__review-row dd')[1].text()).toContain('2 reachable');
    expect(submitButton(wrapper)!.exists()).toBe(true);
  });

  it('creates the campaign and hands the audience to the queue', async () => {
    const fetchMock = backend(wizardRoutes());
    batch.start.mockResolvedValue({
      total: 2,
      sent: 2,
      failed: 0,
      skipped: 0,
      cancelled: false,
      elapsedMs: 1200,
      failures: []
    });
    const { wrapper, router } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await reachSendStep(wrapper);

    await submitButton(wrapper)!.trigger('click');
    await flushPromises();

    const payload = postBody(fetchMock, MARKETING + '/campaigns');
    expect(payload.name).toBe(CAMPAIGN_NAME);
    expect(payload.templateId).toBe('tpl-1');
    expect(payload.recipientIds).toEqual(['r-1', 'r-2']);
    expect((payload.settings as { mode: string }).mode).toBe('immediate');
    expect((payload.filters as { channels: string[] }).channels).toEqual(['whatsapp']);
    expect(showToast).toHaveBeenCalledWith('Campaign created');
    expect(batch.start).toHaveBeenCalledWith('cmp-9', { perMinute: 10, intervalMs: 2000 });
    expect(wrapper.find('.s-prog-overlay').exists()).toBe(true);
    expect(router.currentRoute.value.path).toBe(WIZARD_PATH);
    expect(urls(fetchMock).some((url) => url.includes('/campaigns/cmp-9'))).toBe(true);
  });

  it('schedules the campaign without touching the queue', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper, router } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await reachSendStep(wrapper);

    await wrapper.findAll('.wiz__seg')[1].trigger('click');
    await submitButton(wrapper)!.trigger('click');
    await flushPromises();

    const payload = postBody(fetchMock, MARKETING + '/campaigns');
    const settings = payload.settings as { mode: string; scheduledAt: number | null };
    expect(settings.mode).toBe('scheduled');
    expect(settings.scheduledAt).toBeGreaterThan(Date.now());
    expect(batch.start).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/campaigns/cmp-9');
  });

  it('closes the panel and says so when nobody is reachable', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper, router } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await reachSendStep(wrapper);

    await submitButton(wrapper)!.trigger('click');
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith('No reachable recipient selected.');
    expect(batch.dismiss).toHaveBeenCalled();
    expect(wrapper.find('.s-prog-overlay').exists()).toBe(false);
    expect(router.currentRoute.value.path).toBe('/dashboard/marketing/campaigns/cmp-9');
  });

  it('refuses to create a campaign with an out of range rate', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await reachSendStep(wrapper);

    await wrapper.find('#wiz-rate').setValue('999');
    await submitButton(wrapper)!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.wiz__error').map((node) => node.text())).toContain(
      'Per-minute rate must be 1-60.'
    );
    expect(postedTo(fetchMock, MARKETING + '/campaigns')).toBe(false);
    expect(batch.start).not.toHaveBeenCalled();
  });

  it('discards the draft and returns to the hub', async () => {
    const fetchMock = backend(wizardRoutes());
    const { wrapper, router, store } = await mountView(CreateCampaign, WIZARD_PATH, fetchMock);
    await fillContent(wrapper);
    await nextStep(wrapper);
    await selectAudience(wrapper);
    expect(store.selectedIds).toHaveLength(2);

    await buttonByText(wrapper, '.wiz__top .wiz__btn', 'Discard draft')!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/marketing');
    expect(store.selectedIds).toHaveLength(0);
    expect(store.generatedContent).toBeNull();
  });

  it('still offers the demo template bank when the api is missing', async () => {
    const { wrapper } = await mountView(CreateCampaign, WIZARD_PATH);

    const options = wrapper.findAll('#wiz-template option').map((node) => node.text());
    expect(options[0]).toBe('All goals');
    expect(options.length).toBeGreaterThan(1);
    expect(buttonByText(wrapper, '.wiz__nav .wiz__btn', 'Next')!.attributes('disabled')).toBeDefined();
  });
});
