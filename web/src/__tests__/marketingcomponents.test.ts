/**
 * Sprint 11 marketing components.
 *
 * These are the presentation and wiring tests. The cards emit intent instead of
 * touching the store, the editor round-trips patches, the progress dialog is a
 * window onto lib/sendQueue, and RecipientSelector is the one component that
 * really talks to the store, so its traffic is stubbed at the network edge.
 * AIContentGenerator is mounted against a stubbed useAIContent: that composable
 * has its own suite, and what matters here is that button states, notices and
 * the emitted content id follow the composable state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Ref } from 'vue';
import AIContentGenerator from '../components/marketing/AIContentGenerator.vue';
import CampaignCard from '../components/marketing/CampaignCard.vue';
import ChannelPreview from '../components/marketing/ChannelPreview.vue';
import ContentEditor from '../components/marketing/ContentEditor.vue';
import RecipientSelector from '../components/marketing/RecipientSelector.vue';
import SendProgressDialog from '../components/marketing/SendProgressDialog.vue';
import TemplateCard from '../components/marketing/TemplateCard.vue';
import { useAIContent } from '../composables/useAIContent';
import { summarizeContent } from '../lib/marketingContent';
import { useMarketingStore } from '../stores/marketing';
import { DEFAULT_SEND_SETTINGS } from '../types';
import type {
  BatchSendProgress,
  Campaign,
  CampaignStatus,
  ContentPreview,
  MarketingContent,
  MarketingTemplate,
  Recipient,
  Tag
} from '../types';

vi.mock('../composables/useAIContent', async () => {
  const vue = await import('vue');
  const vitest = await import('vitest');
  const blank = {
    prompt: '',
    goal: 'promotion',
    audience: '',
    language: 'en',
    tone: 'friendly',
    length: 'standard'
  };
  /* The refs are named first so the computeds below do not reach back into the
     object literal that is still being initialised, which TypeScript cannot type. */
  const form = vue.ref({ ...blank });
  const feedback = vue.ref('');
  const generating = vue.ref(false);
  const lastError = vue.ref<string | null>(null);
  const cacheHit = vue.ref(false);
  const content = vue.ref<MarketingContent | null>(null);
  const state = {
    form,
    feedback,
    generating,
    lastError,
    cacheHit,
    content,
    canGenerate: vue.computed(() => form.value.prompt.trim().length > 0 && !generating.value),
    canRefine: vue.computed(
      () => content.value !== null && feedback.value.trim().length > 0 && !generating.value
    ),
    charCount: vue.computed(() => (content.value ? content.value.body.length : 0)),
    generate: vitest.vi.fn(),
    regenerate: vitest.vi.fn(),
    refine: vitest.vi.fn(),
    update: vitest.vi.fn((patch: Record<string, unknown>) => {
      form.value = { ...form.value, ...patch } as typeof blank;
    }),
    scheduleGenerate: vitest.vi.fn()
  };
  return { useAIContent: () => state, DEFAULT_AI_FORM: { ...blank }, GENERATE_DEBOUNCE_MS: 400 };
});

/* The stub replaces the composable's content computed with a plain ref, so the
   tests can drive it directly; the cast gives them that write access. */
const ai = useAIContent() as Omit<ReturnType<typeof useAIContent>, 'content'> & {
  content: Ref<MarketingContent | null>;
};

const HOUR = 3_600_000;
const NOW = new Date(2026, 8, 7, 9, 0).getTime();

function makeContent(patch: Partial<MarketingContent> = {}): MarketingContent {
  return {
    id: 'ct-1',
    title: 'Weekend flash sale',
    body: 'Fifteen percent off every galvanised roofing sheet until Sunday midnight.',
    cta: 'Order now',
    imageSuggestion: 'Stacked roofing sheets at golden hour',
    hashtags: ['kili', 'hardware'],
    goal: 'promotion',
    language: 'en',
    tone: 'friendly',
    length: 'standard',
    createdAt: NOW,
    ...patch
  };
}

function makeCampaign(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: 'cmp-1',
    name: 'September roofing push',
    status: 'draft' as CampaignStatus,
    content: makeContent(),
    recipientCount: 24,
    channels: ['whatsapp', 'facebook'],
    settings: { ...DEFAULT_SEND_SETTINGS },
    progress: { total: 24, sent: 0, failed: 0, pending: 24, percent: 0, ratePerMinute: 0 },
    stats: {
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      converted: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      conversionRate: 0
    },
    createdAt: NOW - 2 * HOUR,
    startedAt: null,
    finishedAt: null,
    ...patch
  };
}

function makeTemplate(patch: Partial<MarketingTemplate> = {}): MarketingTemplate {
  return {
    id: 'tpl-1',
    name: 'Roofing promo',
    category: 'promotion',
    title: 'Fifteen percent off this week',
    content: 'Galvanised roofing sheets, delivered across Dar es Salaam within two days.',
    cta: 'Ask for a quote',
    usageCount: 7,
    createdAt: NOW - 3 * HOUR,
    updatedAt: NOW - HOUR,
    ...patch
  };
}

function mountWith(component: unknown, props: Record<string, unknown>): VueWrapper {
  return mount(component as never, {
    props: props as never,
    global: { plugins: [createPinia()] }
  });
}

/** Mounts against a pinia the test can also reach through the store hook. */
function mountStored(component: unknown, props: Record<string, unknown>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(component as never, {
    props: props as never,
    global: { plugins: [pinia] }
  });
  return { wrapper, store: useMarketingStore() };
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, code: 'OK', message: 'ok', data })
  } as Response;
}

function buttonByText(wrapper: VueWrapper, selector: string, text: string) {
  return wrapper.findAll(selector).find((node) => node.text() === text);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  ai.form.value = {
    prompt: '',
    goal: 'promotion',
    audience: '',
    language: 'en',
    tone: 'friendly',
    length: 'standard'
  };
  ai.feedback.value = '';
  ai.generating.value = false;
  ai.lastError.value = null;
  ai.cacheHit.value = false;
  ai.content.value = null;
  vi.mocked(ai.generate).mockReset();
  vi.mocked(ai.regenerate).mockReset();
  vi.mocked(ai.refine).mockReset();
  vi.mocked(ai.update).mockClear();
  vi.mocked(ai.scheduleGenerate).mockReset();
});

describe('CampaignCard', () => {
  it('renders name, status badge, title summary, audience and channels', () => {
    const wrapper = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW });

    expect(wrapper.find('.c-card').classes()).toContain('is-draft');
    expect(wrapper.find('.c-card__name').text()).toBe('September roofing push');
    expect(wrapper.find('.c-card__status').text()).toBe('Draft');
    expect(wrapper.find('.c-card__summary').text()).toBe('Weekend flash sale');
    expect(wrapper.find('.c-card__meta-row dt').text()).toBe('24 recipients');
    expect(wrapper.find('.c-card__meta-row dd').text()).toBe('Created 2 h ago');
    expect(wrapper.findAll('.c-card__chip').map((chip) => chip.text())).toEqual([
      'WhatsApp',
      'Facebook'
    ]);
  });

  it('hides the progress block for a draft that never started', () => {
    const wrapper = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW });
    expect(wrapper.find('.c-card__progress').exists()).toBe(false);
  });

  it('offers start and cancel for a draft, and never pause', () => {
    const wrapper = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW });
    expect(wrapper.findAll('.c-card__btn').map((node) => node.text())).toEqual([
      'Start',
      'Cancel',
      'Open'
    ]);
  });

  it('shows pause instead of start while running, plus live progress', () => {
    const campaign = makeCampaign({
      status: 'running',
      progress: { total: 24, sent: 10, failed: 2, pending: 12, percent: 41.6, ratePerMinute: 10 }
    });
    const wrapper = mountWith(CampaignCard, { campaign, now: NOW });

    expect(wrapper.findAll('.c-card__btn').map((node) => node.text())).toEqual([
      'Pause',
      'Cancel',
      'Open'
    ]);
    const bar = wrapper.find('.c-card__bar');
    expect(bar.attributes('role')).toBe('progressbar');
    expect(bar.attributes('aria-valuemin')).toBe('0');
    expect(bar.attributes('aria-valuemax')).toBe('100');
    expect(bar.attributes('aria-valuenow')).toBe('42');
    expect(wrapper.find('.c-card__percent').text()).toBe('42%');
    expect(wrapper.find('.c-card__bar-fill').attributes('style')).toContain('width: 42%');
    expect(wrapper.find('.c-card__count.is-sent').text()).toBe('Sent 10');
    expect(wrapper.find('.c-card__count.is-failed').text()).toBe('Failed 2');
  });

  it('lets a paused campaign start again and keeps its progress visible', () => {
    const campaign = makeCampaign({
      status: 'paused',
      progress: { total: 24, sent: 7, failed: 1, pending: 16, percent: 30, ratePerMinute: 0 }
    });
    const wrapper = mountWith(CampaignCard, { campaign, now: NOW });

    expect(wrapper.find('.c-card__status').text()).toBe('Paused');
    expect(wrapper.findAll('.c-card__btn').map((node) => node.text())).toEqual([
      'Start',
      'Cancel',
      'Open'
    ]);
    expect(wrapper.find('.c-card__progress').exists()).toBe(true);
    expect(wrapper.find('.c-card__percent').text()).toBe('30%');
  });

  it('keeps the bar once a finished campaign still reports progress', () => {
    const completed = mountWith(CampaignCard, {
      campaign: makeCampaign({
        status: 'completed',
        progress: { total: 24, sent: 24, failed: 0, pending: 0, percent: 100, ratePerMinute: 12 }
      }),
      now: NOW
    });
    expect(completed.find('.c-card__status').text()).toBe('Completed');
    expect(completed.findAll('.c-card__btn').map((node) => node.text())).toEqual(['Open']);
    expect(completed.find('.c-card__progress').exists()).toBe(true);

    const cancelled = mountWith(CampaignCard, {
      campaign: makeCampaign({ status: 'cancelled' }),
      now: NOW
    });
    expect(cancelled.find('.c-card__status').text()).toBe('Cancelled');
    expect(cancelled.findAll('.c-card__btn').map((node) => node.text())).toEqual(['Open']);
    expect(cancelled.find('.c-card__progress').exists()).toBe(false);
  });

  it('clamps a nonsensical percent back into 0..100', () => {
    const over = mountWith(CampaignCard, {
      campaign: makeCampaign({
        status: 'running',
        progress: { total: 24, sent: 30, failed: 0, pending: 0, percent: 140, ratePerMinute: 10 }
      }),
      now: NOW
    });
    expect(over.find('.c-card__percent').text()).toBe('100%');
    expect(over.find('.c-card__bar').attributes('aria-valuenow')).toBe('100');

    const under = mountWith(CampaignCard, {
      campaign: makeCampaign({
        status: 'running',
        progress: { total: 24, sent: 0, failed: 0, pending: 24, percent: -20, ratePerMinute: 10 }
      }),
      now: NOW
    });
    expect(under.find('.c-card__percent').text()).toBe('0%');
    expect(under.find('.c-card__bar-fill').attributes('style')).toContain('width: 0%');
  });

  it('emits the campaign id with start, pause, cancel and open', async () => {
    const running = mountWith(CampaignCard, {
      campaign: makeCampaign({
        status: 'running',
        progress: { total: 24, sent: 4, failed: 0, pending: 20, percent: 16, ratePerMinute: 10 }
      }),
      now: NOW
    });
    await buttonByText(running, '.c-card__btn', 'Pause')!.trigger('click');
    await buttonByText(running, '.c-card__btn', 'Cancel')!.trigger('click');
    await buttonByText(running, '.c-card__btn', 'Open')!.trigger('click');

    expect(running.emitted('pause')).toEqual([['cmp-1']]);
    expect(running.emitted('cancel')).toEqual([['cmp-1']]);
    expect(running.emitted('open')).toEqual([['cmp-1']]);
    expect(running.emitted('start')).toBeUndefined();

    const draft = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW });
    await buttonByText(draft, '.c-card__btn', 'Start')!.trigger('click');
    expect(draft.emitted('start')).toEqual([['cmp-1']]);
  });

  it('freezes the relative label when the clock is injected', () => {
    const early = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW - HOUR });
    expect(early.find('.c-card__meta-row dd').text()).toBe('Created 1 h ago');

    const late = mountWith(CampaignCard, { campaign: makeCampaign(), now: NOW + 48 * HOUR });
    expect(late.find('.c-card__meta-row dd').text()).not.toBe('Created 2 h ago');
  });
});

describe('TemplateCard', () => {
  it('renders name, goal badge, title, usage count and created time', () => {
    const wrapper = mountWith(TemplateCard, { item: makeTemplate(), now: NOW });

    expect(wrapper.find('.t-card__name').text()).toBe('Roofing promo');
    expect(wrapper.find('.t-card__category').text()).toBe('Promotion');
    expect(wrapper.find('.t-card__title').text()).toBe('Fifteen percent off this week');
    expect(wrapper.find('.t-card__meta-row dt').text()).toBe('Used 7 times');
    expect(wrapper.find('.t-card__meta-row dd').text()).toBe('Created 3 h ago');
  });

  it('localises the goal badge per category', () => {
    const wrapper = mountWith(TemplateCard, {
      item: makeTemplate({ category: 'winback' }),
      now: NOW
    });
    expect(wrapper.find('.t-card__category').text()).toBe('Win-back');
  });

  it('keeps a short body verbatim', () => {
    const wrapper = mountWith(TemplateCard, {
      item: makeTemplate({ content: 'Short body' }),
      now: NOW
    });
    expect(wrapper.find('.t-card__excerpt').text()).toBe('Short body');
  });

  it('clamps a long body to the shared 120 character excerpt', () => {
    const long = 'Galvanised sheets and ridge caps. '.repeat(20);
    const wrapper = mountWith(TemplateCard, { item: makeTemplate({ content: long }), now: NOW });
    const excerpt = wrapper.find('.t-card__excerpt').text();

    expect(excerpt).toBe(summarizeContent({ body: long }, 120));
    expect(excerpt.length).toBeLessThanOrEqual(120);
    expect(excerpt.length).toBeLessThan(long.trim().length);
  });

  it('emits use, edit and delete with the template id', async () => {
    const wrapper = mountWith(TemplateCard, { item: makeTemplate(), now: NOW });

    await buttonByText(wrapper, '.t-card__btn', 'Use')!.trigger('click');
    await buttonByText(wrapper, '.t-card__btn', 'Edit')!.trigger('click');
    await buttonByText(wrapper, '.t-card__btn', 'Delete')!.trigger('click');

    expect(wrapper.emitted('use')).toEqual([['tpl-1']]);
    expect(wrapper.emitted('edit')).toEqual([['tpl-1']]);
    expect(wrapper.emitted('delete')).toEqual([['tpl-1']]);
  });

  it('reports zero usage without breaking the label', () => {
    const wrapper = mountWith(TemplateCard, { item: makeTemplate({ usageCount: 0 }), now: NOW });
    expect(wrapper.find('.t-card__meta-row dt').text()).toBe('Used 0 times');
  });
});

function previewRow(patch: Partial<ContentPreview> = {}): ContentPreview {
  return {
    platform: 'whatsapp',
    title: 'Weekend flash sale',
    body: 'Fifteen percent off until Sunday.',
    cta: 'Order now',
    charCount: 33,
    limit: 4096,
    truncated: false,
    ...patch
  };
}

describe('ChannelPreview', () => {
  it('shows the empty state until copy exists', () => {
    const wrapper = mountWith(ChannelPreview, { previews: [] });

    expect(wrapper.find('.c-prev__title').text()).toBe('Channel preview');
    expect(wrapper.find('.c-prev__empty').text()).toBe('Generate copy to see the previews.');
    expect(wrapper.find('.c-prev__grid').exists()).toBe(false);
  });

  it('renders one card per platform with its own character budget', () => {
    const wrapper = mountWith(ChannelPreview, {
      previews: [previewRow(), previewRow({ platform: 'instagram', limit: 2200 })]
    });

    expect(wrapper.findAll('.c-prev__card')).toHaveLength(2);
    expect(wrapper.findAll('.c-prev__platform').map((node) => node.text())).toEqual([
      'WhatsApp',
      'Instagram'
    ]);
    expect(wrapper.findAll('.c-prev__count').map((node) => node.text())).toEqual([
      '33 / 4096 characters',
      '33 / 2200 characters'
    ]);
    expect(wrapper.find('.c-prev__msg-title').text()).toBe('Weekend flash sale');
    expect(wrapper.find('.c-prev__msg-body').text()).toBe('Fifteen percent off until Sunday.');
    expect(wrapper.find('.c-prev__cta').text()).toBe('Order now');
    expect(wrapper.find('.c-prev__card').classes()).not.toContain('is-over');
  });

  it('flags an over-limit platform and hides an absent call to action', () => {
    const wrapper = mountWith(ChannelPreview, {
      previews: [
        previewRow({
          platform: 'tiktok',
          cta: '',
          charCount: 2260,
          limit: 2200,
          truncated: true
        })
      ]
    });

    expect(wrapper.find('.c-prev__card').classes()).toContain('is-over');
    expect(wrapper.find('.c-prev__warn').text()).toBe('Truncated to fit');
    expect(wrapper.find('.c-prev__cta').exists()).toBe(false);
    expect(wrapper.find('.c-prev__count').text()).toBe('2260 / 2200 characters');
  });

  it('keeps the explainer hint beside the heading', () => {
    const wrapper = mountWith(ChannelPreview, { previews: [previewRow()] });
    expect(wrapper.find('.c-prev__hint').text()).toBe(
      'Each platform renders the same copy with its own limits.'
    );
  });
});

describe('ContentEditor', () => {
  it('renders nothing while there is no draft', () => {
    const wrapper = mountWith(ContentEditor, { content: null });

    expect(wrapper.find('.c-edit').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('marks a complete draft as ready to send', () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });
    const badge = wrapper.find('.c-edit__badge');

    expect(wrapper.find('.c-edit__title').text()).toBe('Message');
    expect(badge.classes()).toContain('is-ok');
    expect(badge.text()).toBe('Ready to send');
  });

  it('warns when the title or the body is blank', () => {
    const noTitle = mountWith(ContentEditor, { content: makeContent({ title: '   ' }) });
    expect(noTitle.find('.c-edit__badge').classes()).toContain('is-bad');
    expect(noTitle.find('.c-edit__badge').text()).toBe(
      'Add a title and body before sending'
    );

    const noBody = mountWith(ContentEditor, { content: makeContent({ body: '' }) });
    expect(noBody.find('.c-edit__badge').classes()).toContain('is-bad');
  });

  it('binds every field back to the draft it was given', () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });

    expect((wrapper.find('#ce-title').element as HTMLInputElement).value).toBe(
      'Weekend flash sale'
    );
    expect((wrapper.find('#ce-body').element as HTMLTextAreaElement).value).toBe(
      'Fifteen percent off every galvanised roofing sheet until Sunday midnight.'
    );
    expect((wrapper.find('#ce-cta').element as HTMLInputElement).value).toBe('Order now');
    expect((wrapper.find('#ce-tags').element as HTMLInputElement).value).toBe('kili hardware');
  });

  it('emits one narrow patch per edited field', async () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });

    await wrapper.find('#ce-title').setValue('Renewed title');
    await wrapper.find('#ce-body').setValue('Renewed body');
    await wrapper.find('#ce-cta').setValue('Renewed cta');

    expect(wrapper.emitted('update')).toEqual([
      [{ title: 'Renewed title' }],
      [{ body: 'Renewed body' }],
      [{ cta: 'Renewed cta' }]
    ]);
  });

  it('splits hashtags on whitespace and drops the blanks', async () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });

    await wrapper.find('#ce-tags').setValue('  kili   hardware  ');

    expect(wrapper.emitted('update')).toEqual([[{ hashtags: ['kili', 'hardware'] }]]);
  });

  it('clears every hashtag when the field is emptied', async () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });

    await wrapper.find('#ce-tags').setValue('   ');

    expect(wrapper.emitted('update')).toEqual([[{ hashtags: [] }]]);
  });

  it('shows the image brief only when the draft carries one', () => {
    const withBrief = mountWith(ContentEditor, { content: makeContent() });
    expect(withBrief.find('.c-edit__image').text()).toContain(
      'Stacked roofing sheets at golden hour'
    );

    const without = mountWith(ContentEditor, { content: makeContent({ imageSuggestion: '' }) });
    expect(without.find('.c-edit__image').exists()).toBe(false);
  });

  it('asks the parent to drop the draft', async () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent() });

    await buttonByText(wrapper, '.c-edit__btn', 'Clear draft')!.trigger('click');

    expect(wrapper.emitted('clear')).toHaveLength(1);
  });

  it('renders a draft with no hashtags as an empty field', () => {
    const wrapper = mountWith(ContentEditor, { content: makeContent({ hashtags: [] }) });
    expect((wrapper.find('#ce-tags').element as HTMLInputElement).value).toBe('');
  });
});

function batchProgress(patch: Partial<BatchSendProgress> = {}): BatchSendProgress {
  return {
    total: 10,
    done: 4,
    failed: 1,
    running: true,
    percent: 40,
    etaMs: 90_000,
    currentName: 'Amani Juma',
    ratePerMinute: 10,
    ...patch
  };
}

function queueSummary(patch: Record<string, unknown> = {}) {
  return {
    total: 10,
    sent: 8,
    failed: 2,
    skipped: 0,
    cancelled: false,
    elapsedMs: 45_000,
    failures: [
      { id: 'r-2', name: 'Neema Wanjiru', reason: 'Channel not connected' },
      { id: 'r-5', name: 'Juma Salim', reason: 'Opted out of marketing' }
    ],
    ...patch
  };
}

describe('SendProgressDialog', () => {
  it('renders nothing while closed', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: false,
      progress: batchProgress(),
      summary: null
    });

    expect(wrapper.find('.s-prog-overlay').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('reports live progress and keeps the stop control reachable', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null
    });

    expect(wrapper.find('.s-prog__title').text()).toBe('Sending');
    const bar = wrapper.find('.s-prog__bar');
    expect(bar.attributes('role')).toBe('progressbar');
    expect(bar.attributes('aria-valuenow')).toBe('40');
    expect(wrapper.find('.s-prog__bar-fill').attributes('style')).toContain('width: 40%');
    expect(wrapper.find('.s-prog__bar-fill').classes()).not.toContain('is-stopped');
    expect(wrapper.find('.s-prog__done').text()).toBe('4 / 10');
    expect(wrapper.find('.s-prog__percent').text()).toBe('40%');
    expect(wrapper.findAll('.s-prog__stat dt')[0].text()).toBe('10 / min');
    expect(wrapper.findAll('.s-prog__stat dd')[0].text()).toBe('Remaining 1m 30s');
    expect(wrapper.findAll('.s-prog__stat dt')[1].text()).toBe('Now: Amani Juma');
    expect(wrapper.findAll('.s-prog__stat dd')[1].text()).toBe('1 failed');
    expect(wrapper.findAll('.s-prog__stat dd')[1].classes()).toContain('is-failed');
    expect(wrapper.find('.s-prog__close').attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.s-prog__btn').map((node) => node.text())).toEqual(['Pause', 'Stop']);
  });

  it('swaps pause for resume once the queue is held', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null,
      paused: true
    });

    expect(wrapper.findAll('.s-prog__btn').map((node) => node.text())).toEqual(['Resume', 'Stop']);
  });

  it('hides the per-recipient row when nothing is in flight', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ currentName: '', failed: 0 }),
      summary: null
    });

    expect(wrapper.findAll('.s-prog__stat')).toHaveLength(1);
  });

  it('falls back to zeros when no progress frame exists yet', () => {
    const wrapper = mountWith(SendProgressDialog, { open: true, progress: null, summary: null });

    expect(wrapper.find('.s-prog__bar').attributes('aria-valuenow')).toBe('0');
    expect(wrapper.find('.s-prog__done').text()).toBe('0 / 0');
    expect(wrapper.find('.s-prog__percent').text()).toBe('0%');
    expect(wrapper.findAll('.s-prog__stat dd')[0].text()).toBe('Remaining 0s');
    expect(wrapper.find('.s-prog__summary').exists()).toBe(false);
  });

  it('clamps a percent above the range and greys the bar once stopped', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ percent: 180, running: false }),
      summary: queueSummary()
    });

    expect(wrapper.find('.s-prog__percent').text()).toBe('100%');
    expect(wrapper.find('.s-prog__bar-fill').classes()).toContain('is-stopped');
  });

  it('summarises a finished batch and lists every failure with its reason', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false, done: 10, percent: 100 }),
      summary: queueSummary()
    });

    expect(wrapper.find('.s-prog__summary').text()).toBe('Batch complete: 8 sent, 2 failed.');
    expect(wrapper.find('.s-prog__summary').attributes('role')).toBe('status');
    expect(wrapper.find('.s-prog__failures-title').text()).toBe('Reason');
    expect(wrapper.findAll('.s-prog__failure-name').map((node) => node.text())).toEqual([
      'Neema Wanjiru',
      'Juma Salim'
    ]);
    expect(wrapper.findAll('.s-prog__failure-reason').map((node) => node.text())).toEqual([
      'Channel not connected',
      'Opted out of marketing'
    ]);
    expect(wrapper.findAll('.s-prog__btn').map((node) => node.text())).toEqual([
      'Retry failed',
      'Close'
    ]);
    expect(wrapper.find('.s-prog__close').attributes('disabled')).toBeUndefined();
  });

  it('reports a cancelled batch by how much was never attempted', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false, done: 7, percent: 70 }),
      summary: queueSummary({ sent: 7, failed: 0, skipped: 3, cancelled: true, failures: [] })
    });

    expect(wrapper.find('.s-prog__summary').text()).toBe(
      'Stopped with 3 messages not attempted.'
    );
    expect(wrapper.find('.s-prog__no-failures').text()).toBe('No failures to retry.');
    expect(wrapper.findAll('.s-prog__btn').map((node) => node.text())).toEqual(['Close']);
  });

  it('keeps the failures panel hidden while the queue still runs', () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null,
      failures: [{ id: 'r-2', name: 'Neema Wanjiru', reason: 'Channel not connected' }]
    });

    expect(wrapper.findAll('.s-prog__failure')).toHaveLength(1);
    expect(wrapper.findAll('.s-prog__btn').map((node) => node.text())).toEqual(['Pause', 'Stop']);
  });

  it('forwards every queue command as an emit', async () => {
    const running = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null
    });
    await buttonByText(running, '.s-prog__btn', 'Pause')!.trigger('click');
    await buttonByText(running, '.s-prog__btn', 'Stop')!.trigger('click');
    expect(running.emitted('pause')).toHaveLength(1);
    expect(running.emitted('cancel')).toHaveLength(1);

    const paused = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null,
      paused: true
    });
    await buttonByText(paused, '.s-prog__btn', 'Resume')!.trigger('click');
    expect(paused.emitted('resume')).toHaveLength(1);

    const done = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false, done: 10, percent: 100 }),
      summary: queueSummary()
    });
    await buttonByText(done, '.s-prog__btn', 'Retry failed')!.trigger('click');
    expect(done.emitted('retry')).toHaveLength(1);
  });

  it('closes from the button and from the backdrop but not from the panel', async () => {
    const done = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false }),
      summary: queueSummary()
    });
    await buttonByText(done, '.s-prog__btn', 'Close')!.trigger('click');
    expect(done.emitted('update:open')).toEqual([[false]]);

    const backdrop = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false }),
      summary: queueSummary()
    });
    await backdrop.find('.s-prog-overlay').trigger('click');
    expect(backdrop.emitted('update:open')).toEqual([[false]]);

    const panel = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress({ running: false }),
      summary: queueSummary()
    });
    await panel.find('.s-prog').trigger('click');
    expect(panel.emitted('update:open')).toBeUndefined();
  });

  it('blocks dismissal while a batch is still delivering', async () => {
    const wrapper = mountWith(SendProgressDialog, {
      open: true,
      progress: batchProgress(),
      summary: null
    });

    await wrapper.find('.s-prog-overlay').trigger('click');

    expect(wrapper.emitted('update:open')).toBeUndefined();
    expect(wrapper.find('.s-prog__close').attributes('disabled')).toBeDefined();
  });
});

const ELLIPSIS = String.fromCharCode(8230);

const TAGS: Tag[] = [
  { id: 'tag-vip', name: 'VIP', color: '#B45309' },
  { id: 'tag-lead', name: 'New lead', color: '#5B5BD6' }
];

const RECIPIENTS: Recipient[] = [
  {
    id: 'r-1',
    name: 'Amani Juma',
    channel: 'whatsapp',
    handle: '+255712000001',
    tags: ['VIP'],
    valid: true
  },
  {
    id: 'r-2',
    name: 'Neema Wanjiru',
    channel: 'facebook',
    handle: 'neema.w',
    tags: ['New lead'],
    valid: false,
    invalidReason: 'no_channel_account'
  },
  {
    id: 'r-3',
    name: 'Juma Salim',
    channel: 'whatsapp',
    handle: '',
    tags: [],
    valid: false,
    invalidReason: 'missing_handle'
  }
];

function serveRecipients(rows: Recipient[] = RECIPIENTS) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(rows));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function serveFailure(status = 500) {
  const mock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () =>
      Promise.resolve({
        success: false,
        code: 'HTTP_' + status,
        message: 'boom',
        data: null
      })
  } as Response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

function mountSelector(channels: string[] = ['whatsapp']) {
  return mountStored(RecipientSelector, { tags: TAGS, channels });
}

function chipGroup(wrapper: VueWrapper, index: number) {
  return wrapper.findAll('.r-sel__chips')[index];
}

function activeChips(group: DOMWrapper<Element>): string[] {
  return group.findAll('.r-sel__chip.is-active').map((node) => node.text());
}

function optionsOf(wrapper: VueWrapper, selector: string): string[] {
  return wrapper.findAll(selector + ' option').map((node) => node.text());
}

function callText(mock: ReturnType<typeof vi.fn>, index: number): string {
  const call = mock.mock.calls[index] as unknown[];
  const init = (call[1] ?? {}) as { body?: unknown };
  return String(call[0]) + ' ' + String(init.body ?? '');
}

describe('RecipientSelector', () => {
  it('loads the audience on mount and renders one row per recipient', async () => {
    const fetchMock = serveRecipients();
    const { wrapper } = mountSelector();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalled();
    expect(callText(fetchMock, 0)).toContain('/recipients/query');
    expect(wrapper.findAll('.r-sel__row')).toHaveLength(3);
    expect(wrapper.findAll('.r-sel__name').map((node) => node.text())).toEqual([
      'Amani Juma',
      'Neema Wanjiru',
      'Juma Salim'
    ]);
    expect(wrapper.findAll('.r-sel__handle')[0].text()).toBe('+255712000001');
    expect(wrapper.find('.r-sel__title').text()).toBe('Recipients');
  });

  it('seeds the channel filter from the send step and keeps tags wide open', async () => {
    serveRecipients();
    const { wrapper } = mountSelector(['whatsapp', 'instagram']);
    await flushPromises();

    expect(activeChips(chipGroup(wrapper, 0))).toEqual(['All tags']);
    expect(activeChips(chipGroup(wrapper, 1))).toEqual(['WhatsApp', 'Instagram']);
    expect(activeChips(chipGroup(wrapper, 2))).toEqual(['All']);
  });

  it('falls back to WhatsApp when the wizard has no channel yet', async () => {
    serveRecipients();
    const { wrapper } = mountSelector([]);
    await flushPromises();

    expect(activeChips(chipGroup(wrapper, 1))).toEqual(['WhatsApp']);
  });

  it('re-queries with the tag it was given', async () => {
    const fetchMock = serveRecipients();
    const { wrapper } = mountSelector();
    await flushPromises();
    fetchMock.mockClear();

    const tagChips = chipGroup(wrapper, 0).findAll('.r-sel__chip');
    expect(tagChips.map((node) => node.text())).toEqual(['All tags', 'VIP', 'New lead']);
    await tagChips[1].trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callText(fetchMock, 0)).toContain('tag-vip');
    expect(activeChips(chipGroup(wrapper, 0))).toEqual(['VIP']);
  });

  it('drops a tag again and widens back to all tags', async () => {
    const fetchMock = serveRecipients();
    const { wrapper } = mountSelector();
    await flushPromises();

    const tagChips = chipGroup(wrapper, 0).findAll('.r-sel__chip');
    await tagChips[1].trigger('click');
    await flushPromises();
    await chipGroup(wrapper, 0).findAll('.r-sel__chip')[0].trigger('click');
    await flushPromises();

    expect(activeChips(chipGroup(wrapper, 0))).toEqual(['All tags']);
    expect(callText(fetchMock, fetchMock.mock.calls.length - 1)).toContain('"tagIds":[]');
  });

  it('re-queries when a channel or activity filter changes', async () => {
    const fetchMock = serveRecipients();
    const { wrapper } = mountSelector(['whatsapp']);
    await flushPromises();
    fetchMock.mockClear();

    await chipGroup(wrapper, 1).findAll('.r-sel__chip')[3].trigger('click');
    await flushPromises();
    expect(activeChips(chipGroup(wrapper, 1))).toEqual(['WhatsApp', 'TikTok']);
    expect(callText(fetchMock, 0)).toContain('tiktok');

    fetchMock.mockClear();
    await chipGroup(wrapper, 2).findAll('.r-sel__chip')[1].trigger('click');
    await flushPromises();
    expect(activeChips(chipGroup(wrapper, 2))).toEqual(['Active 30d']);
    expect(callText(fetchMock, 0)).toContain('"activity":"active"');
  });

  it('buffers the search text and only refetches on submit', async () => {
    const fetchMock = serveRecipients();
    const { wrapper } = mountSelector();
    await flushPromises();
    fetchMock.mockClear();

    await wrapper.find('.r-sel__input').setValue('amani');
    expect(fetchMock).not.toHaveBeenCalled();

    await wrapper.find('.r-sel__search').trigger('submit');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callText(fetchMock, 0)).toContain('amani');
  });

  it('follows a channel change made later in the wizard', async () => {
    serveRecipients();
    const { wrapper } = mountSelector(['whatsapp']);
    await flushPromises();

    await wrapper.setProps({ channels: ['whatsapp', 'tiktok'] } as never);
    await flushPromises();

    expect(activeChips(chipGroup(wrapper, 1))).toEqual(['WhatsApp', 'TikTok']);
  });

  it('selects only reachable contacts and summarises them', async () => {
    serveRecipients();
    const { wrapper, store } = mountSelector();
    await flushPromises();

    await buttonByText(wrapper, '.r-sel__btn', 'Select valid')!.trigger('click');
    await flushPromises();

    expect(store.selectedIds).toEqual(['r-1']);
    const summary = wrapper.find('.r-sel__summary');
    expect(summary.attributes('role')).toBe('status');
    expect(summary.text()).toContain('1 selected');
    expect(summary.text()).toContain('1 reachable');
    expect(summary.text()).toContain('WhatsApp: 1');
    expect(summary.find('.r-sel__bad').exists()).toBe(false);
    expect(wrapper.find('.r-sel__notice').exists()).toBe(false);
  });

  it('toggles a single recipient from its checkbox', async () => {
    serveRecipients();
    const { wrapper, store } = mountSelector();
    await flushPromises();

    const box = wrapper.findAll('.r-sel__row input')[0];
    expect(box.attributes('aria-label')).toBe('Amani Juma');
    await box.setValue(true);
    expect(store.selectedIds).toEqual(['r-1']);
    expect(wrapper.find('.r-sel__summary').text()).toContain('1 selected');

    await box.setValue(false);
    expect(store.selectedIds).toEqual([]);
  });

  it('clears the whole selection', async () => {
    serveRecipients();
    const { wrapper, store } = mountSelector();
    await flushPromises();

    store.selectAllVisible(false);
    await flushPromises();
    expect(store.selectedIds).toHaveLength(3);

    await buttonByText(wrapper, '.r-sel__btn', 'Clear')!.trigger('click');
    await flushPromises();

    expect(store.selectedIds).toEqual([]);
    expect(wrapper.find('.r-sel__summary').text()).toContain('0 selected');
  });

  it('explains why unreachable contacts will be skipped, but only once asked', async () => {
    serveRecipients();
    const { wrapper, store } = mountSelector();
    await flushPromises();

    store.selectAllVisible(false);
    await flushPromises();
    expect(wrapper.find('.r-sel__notice').exists()).toBe(false);
    expect(wrapper.find('.r-sel__summary .r-sel__bad').text()).toBe('2 unreachable');

    await buttonByText(wrapper, '.r-sel__btn', 'Validate selection')!.trigger('click');
    await flushPromises();

    const notice = wrapper.find('.r-sel__notice');
    expect(notice.exists()).toBe(true);
    expect(notice.attributes('role')).toBe('note');
    expect(notice.text()).toContain(
      '2 selected contacts cannot receive this campaign and will be skipped.'
    );
    expect(notice.text()).toContain('Channel not connected (1)');
    expect(notice.text()).toContain('Missing phone or handle (1)');
  });

  it('labels each unreachable row inline', async () => {
    serveRecipients();
    const { wrapper } = mountSelector();
    await flushPromises();

    const rows = wrapper.findAll('.r-sel__row');
    expect(rows[0].find('.r-sel__bad').exists()).toBe(false);
    expect(rows[1].find('.r-sel__bad').text()).toBe('Channel not connected');
    expect(rows[2].find('.r-sel__bad').text()).toBe('Missing phone or handle');
    expect(rows[0].findAll('.r-sel__tag').map((node) => node.text())).toEqual(['VIP']);
    expect(rows[0].find('.r-sel__channel').text()).toBe('WhatsApp');
  });

  it('shows the loading line only while the first query is in flight', async () => {
    let release: (rows: Recipient[]) => void = () => undefined;
    const pending = new Promise<Recipient[]>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => pending.then((rows) => jsonResponse(rows)))
    );

    const { wrapper } = mountSelector();
    await flushPromises();
    expect(wrapper.find('.r-sel__loading').text()).toBe('Loading' + ELLIPSIS);
    expect(wrapper.find('.r-sel__list').exists()).toBe(false);

    release(RECIPIENTS);
    await flushPromises();
    expect(wrapper.find('.r-sel__loading').exists()).toBe(false);
    expect(wrapper.findAll('.r-sel__row')).toHaveLength(3);
  });

  it('shows the empty copy when nobody matches the filters', async () => {
    serveRecipients([]);
    const { wrapper } = mountSelector();
    await flushPromises();

    expect(wrapper.find('.r-sel__empty').text()).toBe('No customer matches these filters.');
    expect(wrapper.find('.r-sel__list').exists()).toBe(false);
  });

  it('keeps the empty state and records the error when the query fails', async () => {
    serveFailure(500);
    const { wrapper, store } = mountSelector();
    await flushPromises();

    expect(wrapper.find('.r-sel__empty').exists()).toBe(true);
    expect(store.error).toBe('api.500');
  });
});

describe('AIContentGenerator', () => {
  it('starts locked with the empty-state hint', () => {
    const wrapper = mountWith(AIContentGenerator, {});
    const primary = wrapper.find('.ai-gen__btn--primary');

    expect(wrapper.find('.ai-gen__title').text()).toBe('AI copywriting');
    expect(primary.text()).toBe('Generate');
    expect(primary.attributes('disabled')).toBeDefined();
    expect(wrapper.find('.ai-gen__hint').text()).toBe(
      'Describe the offer and generate a draft.'
    );
    expect(wrapper.find('.ai-gen__chars').exists()).toBe(false);
    expect(wrapper.find('.ai-gen__refine').exists()).toBe(false);
    expect(wrapper.findAll('.ai-gen__btn').map((node) => node.text())).toEqual(['Generate']);
  });

  it('offers every goal, language, tone and length the product allows', () => {
    const wrapper = mountWith(AIContentGenerator, {});

    expect(optionsOf(wrapper, '#ai-goal')).toEqual([
      'Promotion',
      'New arrival',
      'Festival',
      'Win-back',
      'Custom'
    ]);
    expect(optionsOf(wrapper, '#ai-language')).toEqual(['English', 'French', 'Swahili']);
    expect(optionsOf(wrapper, '#ai-tone')).toEqual([
      'Professional',
      'Friendly',
      'Playful',
      'Urgent'
    ]);
    expect(optionsOf(wrapper, '#ai-length')).toEqual(['Short', 'Standard', 'Detailed']);
  });

  it('unlocks generate from a prompt and schedules the debounced run', async () => {
    const wrapper = mountWith(AIContentGenerator, {});

    await wrapper.find('#ai-prompt').setValue('Roofing sheets');
    await flushPromises();

    expect(ai.update).toHaveBeenCalledWith({ prompt: 'Roofing sheets' });
    expect(ai.scheduleGenerate).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.ai-gen__btn--primary').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.ai-gen__hint').exists()).toBe(false);
  });

  it('writes each option change back to the form', async () => {
    const wrapper = mountWith(AIContentGenerator, {});

    await wrapper.find('#ai-audience').setValue('Hardware resellers');
    await wrapper.find('#ai-goal').setValue('winback');
    await wrapper.find('#ai-language').setValue('fr');
    await wrapper.find('#ai-tone').setValue('urgent');
    await wrapper.find('#ai-length').setValue('short');

    expect(ai.update).toHaveBeenNthCalledWith(1, { audience: 'Hardware resellers' });
    expect(ai.update).toHaveBeenNthCalledWith(2, { goal: 'winback' });
    expect(ai.update).toHaveBeenNthCalledWith(3, { language: 'fr' });
    expect(ai.update).toHaveBeenNthCalledWith(4, { tone: 'urgent' });
    expect(ai.update).toHaveBeenNthCalledWith(5, { length: 'short' });
    expect(ai.form.value).toEqual({
      prompt: '',
      goal: 'winback',
      audience: 'Hardware resellers',
      language: 'fr',
      tone: 'urgent',
      length: 'short'
    });
  });

  it('hands the new draft id up to the wizard', async () => {
    ai.form.value = { ...ai.form.value, prompt: 'Roofing sheets' };
    vi.mocked(ai.generate).mockResolvedValue(makeContent({ id: 'ct-9' }));

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();
    await buttonByText(wrapper, '.ai-gen__btn', 'Generate')!.trigger('click');
    await flushPromises();

    expect(ai.generate).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('generated')).toEqual([['ct-9']]);
  });

  it('stays quiet when generation produces nothing', async () => {
    ai.form.value = { ...ai.form.value, prompt: 'Roofing sheets' };
    vi.mocked(ai.generate).mockResolvedValue(null);

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();
    await wrapper.find('.ai-gen__btn--primary').trigger('click');
    await flushPromises();

    expect(ai.generate).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('generated')).toBeUndefined();
  });

  it('shows the writing label and locks the button mid-flight', () => {
    ai.form.value = { ...ai.form.value, prompt: 'Roofing sheets' };
    ai.generating.value = true;

    const wrapper = mountWith(AIContentGenerator, {});
    const primary = wrapper.find('.ai-gen__btn--primary');

    expect(primary.text()).toBe('Writing' + ELLIPSIS);
    expect(primary.attributes('disabled')).toBeDefined();
  });

  it('announces a semantic cache hit as a status note', () => {
    ai.content.value = makeContent();
    ai.cacheHit.value = true;

    const wrapper = mountWith(AIContentGenerator, {});
    const notice = wrapper.find('.ai-gen__notice--cache');

    expect(notice.attributes('role')).toBe('status');
    expect(notice.text()).toContain('Served from semantic cache');
    expect(notice.text()).toContain('TTL 24h');
  });

  it('renders a failure as an alert and drops the empty hint', () => {
    ai.lastError.value = 'api.network';

    const wrapper = mountWith(AIContentGenerator, {});
    const notice = wrapper.find('.ai-gen__notice--error');

    expect(notice.attributes('role')).toBe('alert');
    expect(notice.text()).toBe('Network error, showing sample data');
    expect(wrapper.find('.ai-gen__hint').exists()).toBe(false);
  });

  it('reveals the draft counter, regenerate and a locked refine row', async () => {
    const draft = makeContent({ id: 'ct-3' });
    ai.content.value = draft;

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();

    expect(wrapper.find('.ai-gen__chars').text()).toBe(draft.body.length + ' characters');
    expect(wrapper.find('.ai-gen__hint').exists()).toBe(false);
    expect(buttonByText(wrapper, '.ai-gen__btn', 'Regenerate')!.exists()).toBe(true);
    expect(wrapper.find('.ai-gen__refine').exists()).toBe(true);
    expect(buttonByText(wrapper, '.ai-gen__btn', 'Apply')!.attributes('disabled')).toBeDefined();
  });

  it('refines once feedback exists and forwards the new id', async () => {
    ai.content.value = makeContent({ id: 'ct-3' });
    vi.mocked(ai.refine).mockResolvedValue(makeContent({ id: 'ct-4' }));

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();

    await wrapper.find('#ai-feedback').setValue('More playful');
    await flushPromises();
    expect(buttonByText(wrapper, '.ai-gen__btn', 'Apply')!.attributes('disabled')).toBeUndefined();

    await buttonByText(wrapper, '.ai-gen__btn', 'Apply')!.trigger('click');
    await flushPromises();

    expect(ai.refine).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('generated')).toEqual([['ct-4']]);
  });

  it('emits nothing when a refinement yields no draft', async () => {
    ai.content.value = makeContent({ id: 'ct-3' });
    vi.mocked(ai.refine).mockResolvedValue(null);

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();
    await wrapper.find('#ai-feedback').setValue('More playful');
    await flushPromises();
    await buttonByText(wrapper, '.ai-gen__btn', 'Apply')!.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('generated')).toBeUndefined();
  });

  it('regenerates with the same inputs and reports the cached id', async () => {
    ai.content.value = makeContent({ id: 'ct-3' });
    vi.mocked(ai.regenerate).mockResolvedValue(makeContent({ id: 'ct-3' }));

    const wrapper = mountWith(AIContentGenerator, {});
    await flushPromises();
    await buttonByText(wrapper, '.ai-gen__btn', 'Regenerate')!.trigger('click');
    await flushPromises();

    expect(ai.regenerate).toHaveBeenCalledTimes(1);
    expect(ai.generate).not.toHaveBeenCalled();
    expect(wrapper.emitted('generated')).toEqual([['ct-3']]);
  });

  it('keeps regenerate locked while a request is in flight', () => {
    ai.content.value = makeContent();
    ai.generating.value = true;

    const wrapper = mountWith(AIContentGenerator, {});

    expect(buttonByText(wrapper, '.ai-gen__btn', 'Regenerate')!.attributes('disabled')).toBeDefined();
  });
});
