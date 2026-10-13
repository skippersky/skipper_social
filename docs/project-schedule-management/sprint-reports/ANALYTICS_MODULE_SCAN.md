# Sprint 8 Analytics Dashboard Module Scan Report

Scope: analytics dashboard at /dashboard/analytics (four KPI cards, conversation
and message trends with a granularity switch, channel mix pie, response-time
gauge, top-customer ranking, preset plus custom date range, manual refresh).

## Files added

- web/src/api/analytics.ts - seven endpoint wrappers over apiGet, each with a
  demo fallback: overview, conversation trend, message trend, channel
  distribution, response time, agent performance, top customers.
- web/src/stores/analytics.ts - slice state, request cache, granularity,
  presetRange() and the derived totals the KPI cards read.
- web/src/composables/useDashboard.ts - orchestration plus the 300ms range
  debounce, cleared through onScopeDispose.
- web/src/composables/useDateRange.ts - preset and custom window state,
  validation, end-inclusive custom range.
- web/src/composables/useChart.ts - chart option builders shared by the panels.
- web/src/lib/echarts.ts - single registration point for the chart runtime.
- web/src/lib/metrics.ts - formatNumber, formatDuration, formatChange and
  trendDirection, all locale aware.
- web/src/components/analytics/ - ChartPanel, StatCard, TrendChart,
  ChannelPieChart, ResponseTimeGauge, TopCustomersTable, DateRangePicker.
- web/src/views/dashboard/analytics/index.vue - the page.
- web/src/__tests__/setup.ts - global vitest setup, see decision 10.
- Six test files: analyticsapi, analyticsstore, analyticscomposables,
  analyticscomponents, analyticsview, echartswiring.

## Existing assets (reuse, do not rewrite)

- src/api/http.ts - apiGet envelope, timeout, the single retry on retriable
  failures and ApiError(code, message); apiErrorI18nKey() for toast copy. No
  parallel fetch layer was added.
- src/api/demo.ts - isMissingBackend() fallback pattern. The demo analytics
  aggregator derives its numbers from the existing demo inbox and customer
  datasets, so analytics, inbox and customers agree while offline.
- src/components/KsAvatar.vue - reused verbatim in the top-customer ranking.
- src/lib/relativeTime.ts - the last contact column.
- src/composables/usePageMeta.ts - page title and meta description.
- src/i18n store - t() with value and count interpolation; no new mechanism.
- src/stores/conversation.ts and src/stores/customer.ts shapes are the demo
  aggregation source; neither store was modified.
- The home feature grid is the dashboard navigation (there is no sidebar), so the
  Analytics card was inserted after the Customers card.
- DESIGN_SYSTEM tokens only (--ks-*) through scoped CSS; this repo has no
  Tailwind and none was introduced.

## Potential conflicts and decisions

1. ECharts version deviates from the brief. The spec asked for ECharts 5, but
   vue-echarts 8 peers require echarts 6, so the install is echarts 6.1.0 plus
   vue-echarts 8.3.0. If ECharts 5 is mandatory, pin vue-echarts 7 with echarts
   5; the option builders do not change, only the registration list in
   src/lib/echarts.ts.
2. src/lib/echarts.ts registers only CanvasRenderer, Line, Pie, Gauge and the
   Grid, Tooltip and Legend components, so the bundle never pulls all of ECharts.
   MarkLine and Title are deliberately not registered: no target line is drawn
   yet and the gauge subtitle is plain markup.
3. The sample-data notice on this page is dismiss-only, unlike the inbox and the
   customer directory where dismissing also collapses the demo rows. Blank charts
   read as a broken page, so the numbers stay and the bar goes away. The dismiss
   persists under ks-analytics-demo-hidden, separate from ks-chat-demo-hidden and
   ks-customers-demo-hidden.
4. Error policy. A non-ApiError (offline, missing backend) falls back to demo
   data and sets demo true. An ApiError whose code starts with HTTP_5 never falls
   back: the store keeps error = api.500, every panel shows the error state with
   a retry button and the KPIs read zero. Inside ChartPanel the error branch
   outranks loading and empty, so a hard failure never claims there is no data.
5. Caching and debounce. Each slice caches the signature it was loaded for,
   from:to, with trends appending the granularity, so switching a bucket size
   refetches only that trend. Range changes debounce 300ms and the window is
   capped at 366 days.
6. getAgentPerformance is wired through api, store and types but has no UI in
   this sprint; nothing dead was shipped into the page.
7. Types are additive only: OverviewStats, TrendPoint, ChannelSlice,
   ResponseTimeStats, AgentPerformance, TopCustomer, DateRange, DateRangePreset,
   TrendGranularity. No existing interface changed.
8. date-fns is not installed and was not added; the window math is hand-rolled in
   useDateRange and presetRange.
9. HomeView feature grid moved from four to three columns so six cards form two
   even rows, and the unread count moved into a header pill. Additive markup and
   CSS only; no Sprint 5b behaviour changed.
10. Test infrastructure, the one change outside analytics. src/__tests__/setup.ts
    is registered through vite.config.ts test.setupFiles. It tracks setTimeout
    and setInterval, clears whatever is still pending after each test, then
    drains one macrotask so queued microtasks and Vue flushes land while jsdom is
    alive. Reason: callbacks scheduled by components were firing after the
    environment was torn down and surfacing as unhandled "window is not defined"
    and removeChild NotFoundError rejections. The Vant notice bar in
    EditorView.vue checks its scroll width on a timeout and the websocket client
    schedules heartbeats. Every test still passed, but the run exited 1: one such
    error on the first full run, three on the next, none on any run after the
    setup file landed. No product code was touched to fix it.

## Delivery evidence (Sprint 8)

- i18n: 57 new keys (55 analytics.* plus home.entryAnalyticsTitle and
  home.entryAnalyticsDesc) in en, zh and fr; 444 keys per locale, no missing key.
  The diff on messages.ts is 171 added lines and 0 removed.
- Tests: 6 new files adding 109 cases (analyticsapi 16, analyticsstore 15,
  analyticscomposables 27, analyticscomponents 35, analyticsview 14,
  echartswiring 2).
- Suite: 71 files / 532 tests passed with exit code 0 on two consecutive full
  runs. Those counts include scratchanalytics.test.ts, a ground-truth diagnostic
  from development that must be deleted before commit; without it the suite is
  70 files / 531 tests. Baseline before Sprint 8 was 64 files / 422 tests.
- Coverage (vitest v8, thresholds 80/80/70/70): statements 97.99%, branches
  90.95%, functions 90.40%, lines 97.99%. Baseline before Sprint 8 was 97.64 /
  89.97 / 89.66.
- New code: api/analytics.ts 100% lines, stores/analytics.ts 98.7%, useChart and
  useDashboard and useDateRange 100%, components/analytics 100% lines,
  views/dashboard/analytics/index.vue 97.01%, lib/echarts.ts 100%, lib/metrics.ts
  91.66% (the multi-day duration branch).
- pnpm run typecheck (vue-tsc) clean. It caught a real defect: the response KPI
  hint read targetMinutes off the overview payload, which does not carry it, so
  the card rendered "Target -" instead of "Target 4h". The value now comes from
  the response-time slice and a view assertion locks it.
- pnpm run build clean: 1143 modules, dist/assets/index-*.js 1,175.29 kB (gzip
  398.92), CSS 319.59 kB (gzip 69.49). The bundle grew from 577 kB in Sprint 7
  because of ECharts; the follow-up worth doing is a dynamic import for the
  analytics route so the chart runtime stays out of the entry chunk.

## Manual acceptance path

1. Log in with the demo account (demo@kilisocial.app / Demo1234) or any
   registered user.
2. Home grid then the Analytics card, or open /dashboard/analytics directly.
3. KPI row: customers, conversations, messages and average response time, with
   the change badge on customers and the Target 4h hint on response time.
4. The amber sample-data bar shows while offline; dismiss it, reload, and it
   stays hidden.
5. Trend panels: switch day, week and month on each chart independently and
   watch only that chart refetch.
6. Channel mix pie and response-time gauge render in the brand palette.
7. Top-customer table lists five rows; clicking a name opens the customer
   profile.
8. Range chips 7d, 30d and 90d apply immediately; Custom reveals two date
   inputs, rejects a reversed window with an inline error and applies a valid one
   end-inclusive.
9. Refresh forces every slice to reload and is disabled while loading.
10. Resize to phone width: KPIs drop to two columns, panels stack, and the last
    contact column leaves the ranking table.
