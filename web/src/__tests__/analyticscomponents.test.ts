import { describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { h } from 'vue';
import ChannelPieChart from '../components/analytics/ChannelPieChart.vue';
import ChartPanel from '../components/analytics/ChartPanel.vue';
import DateRangePicker from '../components/analytics/DateRangePicker.vue';
import ResponseTimeGauge from '../components/analytics/ResponseTimeGauge.vue';
import StatCard from '../components/analytics/StatCard.vue';
import TopCustomersTable from '../components/analytics/TopCustomersTable.vue';
import TrendChart from '../components/analytics/TrendChart.vue';
import type { ChannelSlice, ResponseTimeStats, TopCustomer, TrendPoint } from '../types';

/* jsdom has no canvas, so the chart renders as an inspectable stub. */
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

type Option = Record<string, unknown>;
type Series = Record<string, unknown>;

const DASH = '\u2014';

const trendPoints: TrendPoint[] = [
  { bucket: '2026-09-06', timestamp: new Date(2026, 8, 6).getTime(), count: 2, inbound: 1, outbound: 1 },
  { bucket: '2026-09-07', timestamp: new Date(2026, 8, 7).getTime(), count: 3, inbound: 2, outbound: 1 }
];

const slices: ChannelSlice[] = [
  { platform: 'whatsapp', conversations: 3, percent: 50 },
  { platform: 'facebook', conversations: 3, percent: 50 }
];

const responseStats: ResponseTimeStats = {
  averageMs: 10_071_429,
  medianMs: 10_800_000,
  p90Ms: 10_800_000,
  p95Ms: 10_800_000,
  samples: 14,
  targetMinutes: 240
};

const topRows: TopCustomer[] = [
  { id: 'u-1', name: 'Amani Juma', conversations: 1, messages: 28, lastContactAt: Date.now() - 3_600_000 },
  { id: 'u-2', name: 'Neema Wanjiru', conversations: 1, messages: 3, lastContactAt: null }
];

function mountComponent(component: unknown, props: Record<string, unknown>): VueWrapper {
  return mount(component as never, { props: props as never, global: { plugins: [createPinia()] } });
}

function chartOption(wrapper: VueWrapper): Option {
  const chart = wrapper.findComponent({ name: 'VChart' });
  expect(chart.exists()).toBe(true);
  return chart.props('option') as Option;
}

function firstSeries(wrapper: VueWrapper): Series {
  return (chartOption(wrapper).series as Series[])[0] as Series;
}

describe('ChartPanel', () => {
  it('renders the heading, subtitle and body slot', () => {
    const wrapper = mount(ChartPanel, {
      props: { title: 'Channel mix', subtitle: 'Share of conversations' },
      slots: { default: () => h('p', { class: 'body-probe' }, 'Body') },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.find('.panel__title').text()).toBe('Channel mix');
    expect(wrapper.find('.panel__subtitle').text()).toBe('Share of conversations');
    expect(wrapper.find('.body-probe').text()).toBe('Body');
    expect(wrapper.attributes('aria-busy')).toBe('false');
  });

  it('renders the actions slot next to the heading', () => {
    const wrapper = mount(ChartPanel, {
      props: { title: 'Trend' },
      slots: { actions: () => h('button', { class: 'action-probe' }, 'Day') },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.find('.panel__actions .action-probe').text()).toBe('Day');
    expect(wrapper.find('.panel__subtitle').exists()).toBe(false);
  });

  it('shows a skeleton instead of the body while loading', () => {
    const wrapper = mount(ChartPanel, {
      props: { title: 'Trend', loading: true },
      slots: { default: () => h('p', { class: 'body-probe' }, 'Body') },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.findAll('.panel__skeleton')).toHaveLength(2);
    expect(wrapper.find('.body-probe').exists()).toBe(false);
  });

  it('translates the error key and re-emits retry', async () => {
    const wrapper = mount(ChartPanel, {
      props: { title: 'Trend', error: 'api.timeout' },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.find('.panel__state-text--error').text()).toBe('Request timed out');
    expect(wrapper.find('.panel__retry').text()).toBe('Retry');

    await wrapper.find('.panel__retry').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('shows the empty state when there is nothing to plot', () => {
    const wrapper = mount(ChartPanel, {
      props: { title: 'Trend', empty: true },
      slots: { default: () => h('p', { class: 'body-probe' }, 'Body') },
      global: { plugins: [createPinia()] }
    });

    expect(wrapper.find('.panel__state-text').text()).toBe('No data for this period');
    expect(wrapper.find('.body-probe').exists()).toBe(false);
  });
});

describe('StatCard', () => {
  it('renders the label, value and unit', () => {
    const wrapper = mountComponent(StatCard, { label: 'Messages', value: 37, unit: 'msgs' });

    expect(wrapper.find('.stat__label').text()).toBe('Messages');
    expect(wrapper.find('.stat__value').text()).toContain('37');
    expect(wrapper.find('.stat__unit').text()).toBe('msgs');
    expect(wrapper.find('.stat__change').exists()).toBe(false);
    expect(wrapper.find('.stat__hint').exists()).toBe(false);
  });

  it('shows a signed increase with the up direction', () => {
    const wrapper = mountComponent(StatCard, { label: 'Customers', value: '8', change: 150 });

    expect(wrapper.find('.stat__delta').text()).toBe('+150%');
    expect(wrapper.find('.stat__change').attributes('data-direction')).toBe('up');
    expect(wrapper.find('.stat__change').classes()).toContain('is-up');
  });

  it('shows a signed decrease with the down direction', () => {
    const wrapper = mountComponent(StatCard, { label: 'Customers', value: '8', change: -12.34 });

    expect(wrapper.find('.stat__delta').text()).toBe('-12.3%');
    expect(wrapper.find('.stat__change').attributes('data-direction')).toBe('down');
  });

  it('renders a dash and the flat direction when there is no baseline', () => {
    const wrapper = mountComponent(StatCard, { label: 'Conversations', value: '6', change: null });

    expect(wrapper.find('.stat__delta').text()).toBe(DASH);
    expect(wrapper.find('.stat__change').attributes('data-direction')).toBe('flat');
  });

  it('falls back to the hint when change is not provided', () => {
    const wrapper = mountComponent(StatCard, { label: 'Response', value: '2.8h', hint: 'Target 4h' });

    expect(wrapper.find('.stat__change').exists()).toBe(false);
    expect(wrapper.find('.stat__hint').text()).toBe('Target 4h');
  });

  it('shows a skeleton while loading', () => {
    const wrapper = mountComponent(StatCard, { label: 'Messages', value: 37, change: 10, loading: true });

    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.find('.stat__skeleton').exists()).toBe(true);
    expect(wrapper.find('.stat__change').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('37');
  });
});

describe('DateRangePicker', () => {
  const from = new Date(2026, 7, 10).getTime();
  const to = new Date(2026, 8, 8, 12).getTime();

  it('renders the four presets and marks the active one', () => {
    const wrapper = mountComponent(DateRangePicker, { preset: '30d', from, to });
    const chips = wrapper.findAll('.range__chip');

    expect(chips.map((chip) => chip.text())).toEqual(['Today', 'Last 7 days', 'Last 30 days', 'Custom']);
    expect(chips[2]?.attributes('aria-pressed')).toBe('true');
    expect(chips[0]?.attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.range__custom').exists()).toBe(false);
  });

  it('emits the clicked preset', async () => {
    const wrapper = mountComponent(DateRangePicker, { preset: '30d', from, to });

    await wrapper.findAll('.range__chip')[1]?.trigger('click');

    expect(wrapper.emitted('preset')?.[0]).toEqual(['7d']);
  });

  it('reveals prefilled date inputs for the custom preset', () => {
    const wrapper = mountComponent(DateRangePicker, { preset: 'custom', from, to });
    const inputs = wrapper.findAll('.range__input');

    expect(inputs).toHaveLength(2);
    expect((inputs[0]?.element as HTMLInputElement).value).toBe('2026-08-10');
    expect((inputs[1]?.element as HTMLInputElement).value).toBe('2026-09-08');
  });

  it('emits the edited custom window on submit', async () => {
    const wrapper = mountComponent(DateRangePicker, { preset: 'custom', from, to });
    const inputs = wrapper.findAll('.range__input');

    await inputs[0]?.setValue('2026-08-01');
    await inputs[1]?.setValue('2026-08-20');
    await wrapper.find('.range__custom').trigger('submit');

    expect(wrapper.emitted('custom')?.[0]).toEqual(['2026-08-01', '2026-08-20']);
  });

  it('renders a translated validation error', () => {
    const wrapper = mountComponent(DateRangePicker, {
      preset: 'custom',
      from,
      to,
      error: 'analytics.rangeReversed'
    });

    expect(wrapper.find('.range__error').text()).toBe('The start date must come before the end date');
  });
});

describe('TrendChart', () => {
  const series = [{ key: 'count' as const, label: 'Conversations' }];

  it('plots a smooth line with the bucket labels', () => {
    const wrapper = mountComponent(TrendChart, {
      title: 'Conversation trend',
      points: trendPoints,
      granularity: 'day',
      series
    });
    const plotted = firstSeries(wrapper);

    expect(plotted.type).toBe('line');
    expect(plotted.data).toEqual([2, 3]);
    expect((chartOption(wrapper).xAxis as Option).data).toEqual(['09-06', '09-07']);
    expect(wrapper.find('.segmented__btn.is-active').text()).toBe('Day');
  });

  it('switches the bucket size through update:granularity', async () => {
    const wrapper = mountComponent(TrendChart, {
      title: 'Conversation trend',
      points: trendPoints,
      granularity: 'day',
      series
    });
    const buttons = wrapper.findAll('.segmented__btn');

    expect(buttons.map((button) => button.text())).toEqual(['Day', 'Week', 'Month']);

    await buttons[2]?.trigger('click');

    expect(wrapper.emitted('update:granularity')?.[0]).toEqual(['month']);
  });

  it('builds a bar option for the bar variant', () => {
    const wrapper = mountComponent(TrendChart, {
      title: 'Message trend',
      points: trendPoints,
      granularity: 'day',
      series: [
        { key: 'inbound' as const, label: 'Inbound' },
        { key: 'outbound' as const, label: 'Outbound' }
      ],
      variant: 'bar'
    });
    const plotted = chartOption(wrapper).series as Series[];

    expect(plotted).toHaveLength(2);
    expect(plotted[0]?.type).toBe('bar');
    expect(plotted[0]?.data).toEqual([1, 2]);
    expect(plotted[1]?.data).toEqual([1, 1]);
  });

  it('shows the empty state without mounting a chart', () => {
    const wrapper = mountComponent(TrendChart, {
      title: 'Conversation trend',
      points: [],
      granularity: 'day',
      series
    });

    expect(wrapper.find('.chart-stub').exists()).toBe(false);
    expect(wrapper.find('.panel__state-text').text()).toBe('No data for this period');
  });

  it('re-emits retry from the error state', async () => {
    const wrapper = mountComponent(TrendChart, {
      title: 'Conversation trend',
      points: trendPoints,
      granularity: 'day',
      series,
      error: 'api.network'
    });

    expect(wrapper.find('.panel__state-text--error').text()).toBe('Network error, showing sample data');

    await wrapper.find('.panel__retry').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('ChannelPieChart', () => {
  it('lists every slice with the localized platform name', () => {
    const wrapper = mountComponent(ChannelPieChart, { slices });
    const rows = wrapper.findAll('.pie__row');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.find('.pie__name').text()).toBe('WhatsApp');
    expect(rows[0]?.find('.pie__count').text()).toBe('3 conversations');
    expect(rows[0]?.find('.pie__percent').text()).toBe('50%');
    expect(rows[1]?.find('.pie__name').text()).toBe('Facebook');
    expect(wrapper.find('.pie__center-value').text()).toBe('6');
  });

  it('plots a donut with the share of each platform', () => {
    const wrapper = mountComponent(ChannelPieChart, { slices });
    const plotted = firstSeries(wrapper);

    expect(plotted.type).toBe('pie');
    expect(plotted.radius).toEqual(['54%', '76%']);
    expect(plotted.data).toEqual([
      { name: 'WhatsApp', value: 3, percent: 50 },
      { name: 'Facebook', value: 3, percent: 50 }
    ]);
  });

  it('shows the empty state when no channel reported', () => {
    const wrapper = mountComponent(ChannelPieChart, { slices: [] });

    expect(wrapper.find('.chart-stub').exists()).toBe(false);
    expect(wrapper.find('.panel__state-text').text()).toBe('No data for this period');
  });
});

describe('ResponseTimeGauge', () => {
  it('lists the percentiles, sample count and service target', () => {
    const wrapper = mountComponent(ResponseTimeGauge, { stats: responseStats });
    const rows = wrapper.findAll('.gauge__row');

    expect(rows.map((row) => row.find('.gauge__label').text())).toEqual([
      'Median',
      'P90',
      'P95',
      'Samples',
      'Service target'
    ]);
    expect(rows.map((row) => row.find('.gauge__value').text())).toEqual(['3h', '3h', '3h', '14 replies', '4h']);
  });

  it('gauges the average in minutes against twice the target', () => {
    const wrapper = mountComponent(ResponseTimeGauge, { stats: responseStats });
    const plotted = firstSeries(wrapper);

    expect(plotted.max).toBe(480);
    expect(plotted.data).toEqual([{ value: 168 }]);
    expect(((plotted.progress as Option).itemStyle as Option).color).toBe('#15803D');
  });

  it('turns amber close to the target and red past it', () => {
    const amber = mountComponent(ResponseTimeGauge, { stats: { ...responseStats, averageMs: 200 * 60_000 } });
    const red = mountComponent(ResponseTimeGauge, { stats: { ...responseStats, averageMs: 300 * 60_000 } });

    expect(((firstSeries(amber).progress as Option).itemStyle as Option).color).toBe('#B45309');
    expect(((firstSeries(red).progress as Option).itemStyle as Option).color).toBe('#DC2626');
  });

  it('shows the empty state when there are no replies yet', () => {
    const wrapper = mountComponent(ResponseTimeGauge, { stats: null });

    expect(wrapper.find('.chart-stub').exists()).toBe(false);
    expect(wrapper.find('.gauge__row').exists()).toBe(false);
    expect(wrapper.find('.panel__state-text').text()).toBe('No data for this period');
  });

  it('re-emits retry from the error state', async () => {
    const wrapper = mountComponent(ResponseTimeGauge, { stats: responseStats, error: 'api.500' });

    expect(wrapper.find('.panel__state-text--error').text()).toBe('Server error, showing sample data');

    await wrapper.find('.panel__retry').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('TopCustomersTable', () => {
  it('ranks customers with message counts and last contact', () => {
    const wrapper = mountComponent(TopCustomersTable, { rows: topRows });
    const rows = wrapper.findAll('.top__row');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.find('.top__rank').text()).toBe('1');
    expect(rows[0]?.find('.top__rank').classes()).toContain('is-lead');
    expect(rows[0]?.find('.top__name').text()).toBe('Amani Juma');
    expect(rows[1]?.find('.top__rank').classes()).not.toContain('is-lead');
    expect(rows[1]?.find('.top__td--num').text()).toBe('1');
  });

  it('renders relative time and the never-contacted fallback', () => {
    const wrapper = mountComponent(TopCustomersTable, { rows: topRows });
    const lastCells = wrapper.findAll('.top__td--last');

    expect(lastCells[0]?.text()).toBe('1 h ago');
    expect(lastCells[1]?.text()).toBe('No contact yet');
  });

  it('emits select with the customer id', async () => {
    const wrapper = mountComponent(TopCustomersTable, { rows: topRows });

    await wrapper.findAll('.top__person')[1]?.trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual(['u-2']);
  });

  it('shows the empty state when nobody is active yet', () => {
    const wrapper = mountComponent(TopCustomersTable, { rows: [] });

    expect(wrapper.find('.top__row').exists()).toBe(false);
    expect(wrapper.find('.panel__state-text').text()).toBe('No data for this period');
  });

  it('re-emits retry from the error state', async () => {
    const wrapper = mountComponent(TopCustomersTable, { rows: topRows, error: 'api.timeout' });

    await wrapper.find('.panel__retry').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('analytics chart theming', () => {
  it('keeps every chart on a transparent background', () => {
    const line = mountComponent(TrendChart, {
      title: 'Trend',
      points: trendPoints,
      granularity: 'day',
      series: [{ key: 'count' as const, label: 'Conversations' }]
    });
    const pie = mountComponent(ChannelPieChart, { slices });
    const gauge = mountComponent(ResponseTimeGauge, { stats: responseStats });

    expect(chartOption(line).backgroundColor).toBe('transparent');
    expect(chartOption(pie).backgroundColor).toBe('transparent');
    expect(chartOption(gauge).backgroundColor).toBe('transparent');
  });
});
