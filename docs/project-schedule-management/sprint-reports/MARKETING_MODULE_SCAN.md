# Sprint 11 AI Marketing Module Scan Report

Scope: AI copy generation, recipient selection, throttled batch send, template bank
and send history with CSV export, plus the five dashboard routes that host them.
This document records what the scan found, what was reused, every issue the final
verification pass turned up, and the evidence that the module is green.

## 1. Existing assets found by the scan

### Reused as-is, nothing rebuilt

| Asset | Used by | Why it was reused |
| --- | --- | --- |
| `api/http.ts` | `api/marketing.ts` | Already carries the timeout, the single GET retry, unified error mapping and the 401 redirect. All 20 marketing endpoints go through `apiGet/apiPost/apiPut/apiDelete`. |
| `api/demo.ts` | `api/demoMarketing.ts` | The offline pattern (try live, fall back to seeded rows, tag them `demo: true`) is followed rather than reinvented, so the module is usable with no backend. |
| `lib/relativeTime.ts` | `History.vue`, campaign cards | Existing relative timestamp formatter. |
| `composables/usePageMeta.ts` | all five marketing views | Existing per-route title / description / OG helper. |
| `i18n/index.ts` | everywhere | Existing locale store, `t()` and the header language switcher. |
| `styles/tokens.css` | every new component | 564 `var(--ks-*)` references and no raw hex literal anywhere in the marketing CSS. |
| `stores/auth.ts`, `stores/subscription.ts` | untouched | Marketing neither reads nor writes them. |

### Files that had to change

Only four pre-existing files were touched, and the diff is 295 insertions with zero
deletions:

| File | Change |
| --- | --- |
| `src/types/index.ts` | +260: campaign, content, recipient, template, send-record and history types, plus `DEFAULT_SEND_SETTINGS` |
| `src/i18n/messages.ts` | +14: import `marketingMessages` and spread it into the en / zh / fr tables |
| `src/router/index.ts` | +10: five routes under `/dashboard/marketing` |
| `src/views/HomeView.vue` | +11: one home grid card and its icon |

### Conflicts

None. No marketing API, store, route, view or component existed before this sprint,
so nothing had to be merged or replaced. `lib/csv.ts` is new here, not a reuse of
an earlier helper.

## 2. New code added by this sprint

### Routes

| Path | Name | View (lines) |
| --- | --- | --- |
| `/dashboard/marketing` | `marketing` | `views/dashboard/marketing/index.vue` (540) |
| `/dashboard/marketing/create` | `marketing-create` | `CreateCampaign.vue` (803) |
| `/dashboard/marketing/campaigns/:id` | `marketing-detail` | `CampaignDetail.vue` (728) |
| `/dashboard/marketing/templates` | `marketing-templates` | `Templates.vue` (621) |
| `/dashboard/marketing/history` | `marketing-history` | `History.vue` (475) |

All five live inside the authenticated dashboard layout, so the Sprint 3 route guard
protects them with no new guard code.

### API layer: 20 endpoints under `/api/v1/marketing`

`content/generate`, `content/preview`; `templates` list / create / update /
delete / use; `recipients/query`, `recipients/validate`; `channels`;
`campaigns` list / detail / create / start / pause / cancel / stats / records
read / records write / retry; `history`; `overview`.

Each function tries the live endpoint first and falls back to `api/demoMarketing.ts`
(867 lines) on failure. Fallback rows are flagged and the views surface a sample-data
notice, the convention Sprint 5b established for the conversation inbox.

### State and composition

| File | Lines | Role |
| --- | --- | --- |
| `stores/marketing.ts` | 571 | 62 exported members: 20 state, 11 getters, 31 actions. Paging, selection, progress, demo flag |
| `composables/useMarketing.ts` | 235 | list filters, history paging, CSV rows, `exportHistory` |
| `composables/useAIContent.ts` | 208 | generate / regenerate / refine, debounce, cache-hit surfacing |
| `composables/useBatchSend.ts` | 213 | thin binding between the wizard and `lib/sendQueue` |
| `composables/useTemplates.ts` | 150 | template CRUD and the usage counter |

### Pure logic: no Vue, no network

| File | Lines | Role |
| --- | --- | --- |
| `lib/sendQueue.ts` | 228 | `clampRate`, `estimateDurationMs`, `formatDuration`, `createSendQueue`, `retryableItems`, `backOffRate` |
| `lib/marketingContent.ts` | 449 | `hashPrompt`, `composeContent`, `refineContent`, `renderPreview(s)`, `isContentSendable`, `FEEDBACK_RULES` |
| `lib/marketingValidation.ts` | 146 | name / content / recipients / channels / schedule / rate rules and `RATE_LIMITS` |
| `lib/csv.ts` | 95 | RFC-4180 escaping and the browser download branch |

Keeping the throttle arithmetic and the validation rules out of the components is
what makes them testable without mounting anything.

### Components: seven, all at 100% line coverage

`RecipientSelector.vue` (440), `SendProgressDialog.vue` (374),
`AIContentGenerator.vue` (357), `CampaignCard.vue` (340), `ContentEditor.vue`
(219), `TemplateCard.vue` (214), `ChannelPreview.vue` (143).

The cards emit intent instead of touching the store. Only `RecipientSelector` reads
the store directly, and its traffic is stubbed at the network edge in tests.

### i18n

`i18n/marketing.ts` holds 228 keys as `[key, en, zh, fr]` tuples across 293 lines.
Because a row is a 4-tuple, dropping a language is a typecheck failure rather than a
silent English fallback. `messages.ts` spreads the built tables into each locale and
is otherwise unchanged.

The marketing views use no Vant component and no Tailwind, because the project has
neither dependency. Styling is scoped CSS against the design tokens, matching every
other dashboard module.

## 3. Issues the verification pass found, and what was done

1. **Duplicated wizard suite.** The create-campaign describe block had been appended
   to `marketingviews.test.ts` twice, redeclaring nine helpers. Trimmed the second
   copy: 74,170 to 62,555 bytes and 1,913 to 1,650 lines, leaving 55 tests.

2. **Scheduled sends silently did nothing (product bug).** The datetime field rendered
   now + 30 minutes, but `settings.scheduledAt` stayed null until the operator
   edited the field, so `validateSchedule` rejected the submit and the wizard
   returned with no POST and no visible error. `CreateCampaign.vue` now seeds
   `scheduledAt` from the value the field displays, so what is shown is what is sent.

3. **Templates toolbar read "N campaigns".** `Templates.vue` reused
   `marketing.totalCampaigns` for its counter. Added `marketing.templates.count`
   (`{n} templates` / 共 {n} 个模板 / `{n} modeles` with the accent) and pointed
   the view at it.

4. **19 typecheck errors in `marketingcomponents.test.ts`.** All type-level; the
   tests already passed at runtime. A mock object referenced itself inside its own
   initializer (TS7022, TS7024), seven assignments wrote to what the real composable
   types as a read-only ComputedRef (TS2540), nine calls passed a DOMWrapper where a
   VueWrapper was declared (TS2345), and one setProps hit a mount typed as never.
   Fixed by naming the mock refs before the object literal, casting the stubbed
   content ref writable, typing `activeChips` as `DOMWrapper<Element>`, and
   casting that one setProps payload.

5. **Six dead i18n rows removed:** `marketing.editor.chars`,
   `marketing.editor.saved`, `marketing.recipients.byChannel`,
   `marketing.send.confirm`, `marketing.send.title`,
   `marketing.wizard.discardText`. No view referenced any of them.

## 4. New guard: marketingi18n.test.ts

Seven tests that read the product sources through `import.meta.glob` with the raw
query, so the check needs no Node typings and runs offline:

- every key appears once and lives in the `marketing.` namespace (228 keys);
- all three locales are filled and non-empty for every key;
- the spread really landed, so `messages[locale][key]` equals
  `marketingMessages[locale][key]`;
- placeholder sets are identical across en / zh / fr;
- the zh column is genuinely Chinese wherever the string carries words, and fewer
  than 20% of the fr column is a verbatim copy of English. Measured: 16 of 228, and
  each of those is a shared loanword such as Marketing, Pause or Audience;
- every `'marketing.*'` literal in the product code resolves, with prefix awareness
  for keys built at runtime such as `'marketing.wizard.step' + item`. 204 distinct
  literals scanned across 179 files;
- no defined key is left unreferenced.

That last rule is what caught the six dead rows, and it will catch the next typo that
would otherwise render a raw key in the UI.

## 5. Delivery evidence

All commands run from `web/` on Windows with the bundled Node runtime.

### Test run

```
pnpm run test        # vitest run --coverage
Test Files  92 passed (92)
     Tests  1159 passed (1159)
  Duration  105.52s
```

The Sprint 10 baseline was 85 files and 872 tests. This sprint adds 7 files and 287
tests:

| File | Tests | Covers |
| --- | --- | --- |
| `marketingcomponents.test.ts` | 71 | all seven components, stubbed `useAIContent`, network-stubbed selector |
| `marketingviews.test.ts` | 55 | five views: hub, detail, templates, history, create wizard |
| `marketingcomposables.test.ts` | 52 | `useMarketing`, `useAIContent`, `useBatchSend`, `useTemplates` |
| `marketinglibs.test.ts` | 36 | `sendQueue`, `marketingContent`, `marketingValidation`, `csv` |
| `marketingstore.test.ts` | 35 | store state, actions, getters, demo fallback |
| `marketingapi.test.ts` | 31 | all 20 endpoints: live, retry, demo fallback |
| `marketingi18n.test.ts` | 7 | the locale parity guard described above |

### Coverage

Global, provider v8. Thresholds are global only: lines and statements 80, functions
and branches 70.

```
All files | % Stmts 98.62 | % Branch 92.50 | % Funcs 92.28 | % Lines 98.62
```

Statements rose from 98.43% to 98.62% while the suite grew by a third.

Sprint 11 files, as % Stmts / % Branch / % Funcs / % Lines:

```
api/marketing.ts             100     96.15   100     100
api/demoMarketing.ts          98.15   90.60    94.64   98.15
components/marketing         100     97.74   100     100   (all 7 at 100% lines)
composables/useAIContent     100     97.87   100     100
composables/useMarketing     100     98.03   100     100
composables/useTemplates     100    100     100     100
composables/useBatchSend     100     97.30   100     100
i18n/marketing.ts            100    100     100     100
lib/marketingContent.ts       98.61   89.70    93.75   98.61
lib/marketingValidation.ts   100     96.72   100     100
lib/sendQueue.ts              95.71   94.33    94.11   95.71
lib/csv.ts                    98.27   89.47   100      98.27
stores/marketing.ts          100     91.71   100     100
views/dashboard/marketing     97.73   87.06    74.32   97.73
  CampaignDetail.vue          99.62   86.86    80.00   99.62
  CreateCampaign.vue          93.70   72.94    62.50   93.70
  History.vue                100     97.14    85.71  100
  Templates.vue              100     96.55    73.68  100
  index.vue                   98.94   95.00    85.71   98.94
HomeView.vue                 100    100     100     100
```

### Typecheck and build

```
pnpm run typecheck   # vue-tsc --noEmit  -> exit 0, 0 diagnostics
pnpm run build       # vite build        -> exit 0, 1254 modules
  dist/assets/index-CMxIKSFY.js   1,403.26 kB | gzip: 465.61 kB
  dist/assets/index-BoiaDrNI.css    419.16 kB | gzip:  80.59 kB
  PWA v0.20.5 generateSW, precache 6 entries (1794.35 KiB)
```

The over-500kB chunk warning is pre-existing (echarts plus the PWA precache) and is
not introduced by this sprint.

## 6. Known follow-ups, deliberately not fixed here

- `CreateCampaign.vue` sits at 62.5% function coverage. The uncovered functions are
  the send-dialog retry and error branches; line coverage is 93.7%. Worth a focused
  pass before the module meets a real backend.
- The `van-skeleton` "failed to resolve component" warnings during the run come from
  `ChatWindow.vue` and `ChatView.vue` (Sprints 2 and 6). Vant is registered in
  `main.ts` but not in the test mount. Cosmetic and pre-existing.
- No `/api/v1/marketing/*` route exists on the backend yet, and `API_CONTRACT.md`
  does not list these endpoints. The module runs entirely on demo fallbacks; the
  server side is the next backend sprint.
- The send queue throttles in the browser. A real deployment needs the same rate
  limits enforced server side, otherwise closing the tab stops a campaign mid-flight.
- Scheduled campaigns are stored with a `scheduledAt` timestamp but nothing fires
  them yet. Dispatching scheduled sends belongs to the backend, not the client.

## 7. Manual acceptance path

1. Sign in with the demo account (`demo@kilisocial.app` / `Demo1234`).
2. Home grid: the new Marketing card opens `/dashboard/marketing`.
3. Hub: read the four overview tiles, filter by status, load more, and confirm the
   sample-data notice appears while the backend is absent.
4. New campaign step 1: type a name, generate copy, watch the debounce, then generate
   the same prompt again and confirm the cache-hit note.
5. Step 2: filter recipients by tag, channel and activity, select the valid ones and
   read the summary line.
6. Step 3 immediate: set the rate above 60 per minute and confirm the clamp warning,
   then submit and exercise pause, resume and cancel on the progress dialog.
7. Step 3 scheduled: pick scheduled, leave the default time untouched and submit. It
   must route to the campaign detail page and must not start the queue. This is the
   path that was broken and is now fixed.
8. Campaign detail: check the stats tiles, the record table and retry-failed.
9. Templates: create, edit, delete and apply one into the wizard. Confirm the toolbar
   now reads "N templates" rather than "N campaigns".
10. History: filter by date range and by campaign, page through, export CSV and open
    the file.
11. Switch to zh and fr from the header and confirm every marketing screen translates,
    including toasts and inline validation errors.
12. Resize below 768px and confirm the wizard steps, chip rows and history table
    collapse to a single column with no horizontal scroll.

## 8. Scratch files to delete before committing

Produced while debugging. Nothing here is referenced by the build or the suite:

```
web/.scratch-coverage.txt      web/.scratch-full.txt
web/.scratch-i18n-keys.json    web/.scratch-t1.json
web/.scratch-t2.json           web/.scratch-t3.json
web/.scratch-t4.json           web/.scratch-testrun.txt
web/.scratch-tsc.txt           web/.scratch-unicode-test.txt
web/.tmp-mc.txt                web/.tmp-testrun.txt
web/.writeprobe.txt            web/.writeprobe2.txt
web/patch-dashboard.cjs        web/patch-inbox.mjs
web/patch-nav.cjs              web/src/__tests__/scratchanalytics.test.ts
```

`scratchanalytics.test.ts` holds one test and is counted in the 92 files / 1159
tests above, so removing it leaves 91 files and 1158 tests.
