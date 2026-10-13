# Sprint 12 Automation Workflow Module Scan Report

Scope: visual workflow orchestration (triggers, conditions, actions), the drag and drop
builder canvas, run monitoring with live polling, execution trace replay and the template
library, plus the six dashboard routes that host them. This document records what the scan
found before any code was written, what was reused, every issue the verification pass
turned up, and the evidence that the module is green.

## 1. Existing assets found by the scan

The scan walked `src/views/dashboard/`, `src/stores/`, `src/api/`, `src/composables/`,
`src/lib/`, `src/types/`, `src/i18n/` and `src/router/index.ts` before the first new file
was created. Eleven dashboard feature areas already existed: conversations, channels,
customers, analytics, marketing, notifications, settings, subscription, checkout, drafts
and editor.

### Reused as-is, nothing rebuilt

| Asset | Used by | Why it was reused |
| --- | --- | --- |
| `api/http.ts` | `api/workflow.ts` | Already carries the timeout, the single GET retry, unified error mapping and the 401 redirect. All 25 workflow endpoints go through `apiGet/apiPost/apiPut/apiDelete`; no second HTTP client was introduced. |
| `api/demo.ts` pattern | `api/demoWorkflow.ts` | The offline convention (try live, fall back to seeded rows, tag them `demo: true`) is followed rather than reinvented, so the module is fully usable with no backend. |
| `composables/usePageMeta.ts` | all six workflow views | Existing per-route title / description / OG helper. |
| `i18n/index.ts` | everywhere | Existing locale store, `t()` and the header language switcher. Workflow strings are merged in by spread, exactly like the marketing table. |
| `lib/relativeTime.ts` | `Runs.vue`, `RunDetail.vue`, `WorkflowCard.vue` | Existing relative timestamp formatter. |
| `stores/auth.ts`, `stores/subscription.ts`, `stores/customer.ts`, `stores/tag.ts`, `stores/message.ts` | read only, never written | The workflow store neither mutates nor imports their state, so accepted Sprint 3-11 logic is untouched. |
| `styles/tokens.css` | every new component and view | All colour, radius, spacing and motion values come from `var(--ks-*)`. No raw hex literal was added anywhere in the workflow CSS. |
| `types/index.ts` barrel | `types/workflow.ts` | Domain types live in their own file and are re-exported from the existing barrel, matching the marketing precedent. |

### Files that had to change

Only eight pre-existing files were touched: six source files, one accepted test stub and the
lockfile. The diff is 79 insertions and one deletion, so nothing accepted in Sprint 3-11 was
rewritten. The single deleted line is the `/dashboard/notifications` stub route re-emitted with a
trailing comma so two siblings could follow it:

| File | Change |
| --- | --- |
| `web/package.json` | +4: `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap` |
| `web/pnpm-lock.yaml` | regenerated for the four new dependencies |
| `src/__tests__/setup.ts` | +37: guarded `ResizeObserver` and `matchMedia` stubs. Vue Flow measures itself and the builder queries the viewport; jsdom ships neither, so any view mounting the canvas would throw. Both stubs are installed only when the global is absent. |
| `src/i18n/messages.ts` | +4: import `workflowMessages` and spread it into the en / zh / fr tables |
| `src/router/index.ts` | +13: six routes under `/dashboard/workflows` |
| `src/types/index.ts` | +3: `export * from './workflow'` |
| `src/views/HomeView.vue` | +11: one home grid card and its icon |
| `src/__tests__/homeview.test.ts` | +7/-1: three stub routes (`workflows`, `marketing`, `settings`) and three matching `href` assertions, so all ten home grid entries resolve |

### Conflicts

None. No workflow API, store, route, view, component or i18n key existed before this
sprint, so nothing had to be merged or replaced. Two naming collisions were checked and
resolved deliberately:

- `views/dashboard/marketing/Templates.vue` already existed, so the workflow template
  library lives at `views/dashboard/workflows/Templates.vue` and the routes are named
  `marketing-templates` and `workflow-templates`. They never share a chunk.
- `/dashboard/workflows/:id` would swallow `builder`, `runs` and `templates` if declared
  first. The five static segments are registered before the dynamic one, and the router
  file carries a comment saying so. `src/__tests__/router.test.ts` was not modified.

## 2. New code added by this sprint

11,748 lines of production code and 6,345 lines of tests across 33 new files.

### Routes (6)

| Path | Name | View (lines) |
| --- | --- | --- |
| `/dashboard/workflows` | `workflows` | `views/dashboard/workflows/index.vue` (644) |
| `/dashboard/workflows/builder` | `workflow-builder` | `Builder.vue` (807) |
| `/dashboard/workflows/runs` | `workflow-runs` | `Runs.vue` (316) |
| `/dashboard/workflows/runs/:runId` | `workflow-run-detail` | `RunDetail.vue` (857) |
| `/dashboard/workflows/templates` | `workflow-templates` | `Templates.vue` (672) |
| `/dashboard/workflows/:id` | `workflow-detail` | `Detail.vue` (707) |

All six sit inside the authenticated dashboard layout, so the Sprint 3 route guard
protects them with no new guard code.

### API layer: 25 endpoints

`api/workflow.ts` (365 lines) declares four base paths and never repeats them:

```
WORKFLOWS = /api/v1/workflows          RUNS      = /api/v1/workflow-runs
TEMPLATES = /api/v1/workflow-templates CATALOG   = /api/v1/workflow
```

| # | Method | Path | Function |
| --- | --- | --- | --- |
| 1 | GET | `/api/v1/workflows` | `getWorkflows` (paged, `WORKFLOW_PAGE_SIZE = 20`) |
| 2 | GET | `/api/v1/workflows/{id}` | `getWorkflow` |
| 3 | POST | `/api/v1/workflows` | `createWorkflow` |
| 4 | PUT | `/api/v1/workflows/{id}` | `updateWorkflow` |
| 5 | DELETE | `/api/v1/workflows/{id}` | `deleteWorkflow` |
| 6 | POST | `/api/v1/workflows/{id}/enable` | `enableWorkflow` |
| 7 | POST | `/api/v1/workflows/{id}/disable` | `disableWorkflow` |
| 8 | POST | `/api/v1/workflows/{id}/duplicate` | `duplicateWorkflow` |
| 9 | POST | `/api/v1/workflows/{id}/layout` | `layoutWorkflow` |
| 10 | GET | `/api/v1/workflows/{id}/summary` | `getWorkflowSummary` |
| 11 | POST | `/api/v1/workflows/validate` | `validateWorkflow` |
| 12 | GET | `/api/v1/workflows/overview` | `getWorkflowOverview` |
| 13 | GET | `/api/v1/workflows/{id}/runs` | `getWorkflowRuns` (scoped feed) |
| 14 | POST | `/api/v1/workflows/{id}/runs` | `triggerWorkflowRun` (manual run / rerun) |
| 15 | GET | `/api/v1/workflow-runs` | `getAllWorkflowRuns` (cross-workflow monitor) |
| 16 | GET | `/api/v1/workflow-runs/stats` | `getWorkflowRunStats` |
| 17 | GET | `/api/v1/workflow-runs/{id}` | `getWorkflowRunDetail` |
| 18 | POST | `/api/v1/workflow-runs/{id}/stop` | `stopWorkflowRun` |
| 19 | GET | `/api/v1/workflow-templates` | `getWorkflowTemplates` |
| 20 | POST | `/api/v1/workflow-templates/{id}/use` | `useWorkflowTemplate` |
| 21 | POST | `/api/v1/workflow-templates/{id}/instantiate` | `createWorkflowFromTemplate` |
| 22 | GET | `/api/v1/workflow/nodes` | `getNodeTypes` (optional `?kind=`) |
| 23 | GET | `/api/v1/workflow/triggers` | `getTriggers` |
| 24 | GET | `/api/v1/workflow/conditions` | `getConditions` |
| 25 | GET | `/api/v1/workflow/actions` | `getActions` |

Every function tries the live endpoint first and falls back to `api/demoWorkflow.ts`
(627 lines, 27 exports) only when `isMissingBackend(error)` says the backend is absent or
the route is not implemented. A 500 from a real backend still surfaces as an error, so the
offline mode can never mask a server bug. Unknown ids in demo mode throw `ApiError`
NOT_FOUND rather than silently inventing a row. Fallback rows are flagged `demo: true` and
the views surface a sample-data notice, the convention Sprint 5b established for the
conversation inbox.

### Node catalog: 21 node types

`lib/workflowNodes.ts` (398 lines) is the single source of truth for the palette, the
property forms and the accent colours. Nothing in a view hardcodes a node type list.

| Kind | Count | Types |
| --- | --- | --- |
| trigger | 7 | `customer_created`, `tag_changed`, `message_received`, `marketing_response`, `schedule`, `customer_birthday`, `customer_inactive` |
| condition | 5 | `has_tag`, `in_segment`, `channel_is`, `time_window`, `expression` |
| action | 9 | `send_message`, `add_tag`, `remove_tag`, `move_segment`, `trigger_campaign`, `send_notification`, `wait`, `http_request`, `update_profile` |

Each definition carries its own field schema (`text`, `number`, `select`, `textarea`,
`switch`), which fields are required, an accent (`primary` / `accent` / `success` /
`warning`) and the i18n key pair `labelKey` / `descKey`. Channel options are derived from
the existing `CHANNEL_PLATFORMS` constant, so a platform added in Sprint 5b appears in the
builder with no workflow-side change.

The action set is deliberately the same vocabulary the accepted modules already expose:
send message (Sprint 6), add / remove tag and move segment (Sprint 7), trigger campaign
(Sprint 11), send notification (Sprint 9). Integration is by node type name, not by
importing those stores.

### Validation: 12 issue codes

`validateDefinition` in `lib/workflowGraph.ts` (634 lines) is a pure function over a
`WorkflowDefinition` and returns `{ valid, issues }`. Each issue is a machine readable code
plus the i18n key the UI renders, never a raw string:

`EMPTY`, `NO_TRIGGER`, `MULTIPLE_TRIGGERS`, `NO_ACTION`, `ORPHAN_NODE`, `UNREACHABLE`,
`CONDITION_MISSING_BRANCH`, `CYCLE`, `DANGLING_EDGE`, `SELF_LOOP`, `DUPLICATE_EDGE`,
`MISSING_CONFIG`.

This covers every rule the spec listed: exactly one trigger, at least one action, both
branches present on a condition node, no cycles, no unreachable or orphaned nodes, and no
node missing a required config value. `issueNodeIds` / `issueEdgeIds` / `issuesForNode`
turn the result into the highlight sets the canvas and the property panel consume.

The same rules run twice on purpose. The client copy gives instant feedback while editing;
`POST /workflows/validate` is the authority before a workflow can be activated. The builder
keeps them in separate refs so the server verdict is never confused with the local one.

### State and composition

The layering is strict and one-directional: `api` then `store` then `composable` then view.
A view never calls `api/workflow.ts` directly and a composable never touches `fetch`.

| File | Lines | Role |
| --- | --- | --- |
| `stores/workflow.ts` | 707 | 76 exported members: workflows, paging, overview, current workflow, summary, runs, current run, run stats, templates, node types, validation, builder definition, selection, dirty flag, loading / saving / error. Getters include `activeWorkflows`, `pausedWorkflows`, `draftWorkflows`, `hasDemoData`, `runsAreDemo`, `triggerKind`, `nodeCount`, `edgeCount`, `hasRunningRuns`, `issueNodeIds`, `currentNodeStateCounts`. |
| `composables/useWorkflow.ts` | 158 | List filters (status, search, sort), paging and the `WORKFLOW_STATUS_FILTERS` tuple. |
| `composables/useWorkflowBuilder.ts` | 290 | Canvas edits: add / remove / patch node, connect and disconnect edges, `resolveBranch`, local validation, `CONNECT_PROBLEM_KEYS` for the three rejected-connection reasons (`missing-node`, `self-loop`, `duplicate`). |
| `composables/useWorkflowMonitor.ts` | 222 | Run filters, `RUN_STATUS_FILTERS`, the live poller and `nextPollInterval(failures)`. |
| `composables/useWorkflowTemplates.ts` | 145 | Template filters, complexity and scenario tuples, `scenarioSlug`. |

The store owns the definition the builder edits and marks it `dirty`; the detail page reads
the same store but never writes the canvas back, so opening a workflow to inspect it cannot
clobber an in-progress edit.

Polling follows the spec: `RUN_POLL_INTERVAL_MS = 2000` while a run is active, backing off
exponentially to `RUN_POLL_MAX_INTERVAL_MS = 30000` after consecutive failures, and stopping
entirely once every visible run has reached a terminal status.

### Views and components

Nine components in `src/components/workflow/`, all of them dumb: they take props, emit
events, and hold no store reference of their own.

| Component | Lines | Role |
| --- | --- | --- |
| `WorkflowCanvas.vue` | 409 | Vue Flow wrapper. Drag and drop from the palette, node drag, zoom, connect, delete, plus the mobile step-list fallback. |
| `WorkflowGraph.vue` | 348 | Read-only renderer used by the detail page and the template preview. |
| `NodePanel.vue` | 286 | Left palette, grouped by kind, searchable, drag source and click-to-add. |
| `NodeCard.vue` | 172 | Palette tile with accent colour and kind badge. |
| `NodePropertyPanel.vue` | 566 | Right panel. Renders the dynamic form from the node type schema, shows required-field state and the issues for the selected node. |
| `WorkflowCard.vue` | 309 | List tile: status pill, trigger summary, node and run counts, row actions. |
| `TemplateCard.vue` | 212 | Template tile: scenario, complexity, use count, preview and use actions. |
| `RunTimeline.vue` | 340 | Vertical execution log with per-node status, duration, input, output and error. |
| `ExecutionPath.vue` | 243 | Step chip strip of the executed path, used beside the canvas on the run detail page. |

The six views compose those components. `Builder.vue` is the only view that mutates the
definition; `Detail.vue` is strictly read-only; `RunDetail.vue` owns the poller lifecycle
and tears it down on unmount.

### i18n: 416 rows across 3 locales

`src/i18n/workflow.ts` (495 lines) stores one row per key as a `[key, en, zh, fr]` tuple
and builds the three dictionaries from it, so a missing translation is a type error rather
than a silent English fallback. 416 rows means 1,248 translated strings. `WORKFLOW_KEYS`
is exported and `src/__tests__/workflowi18n.test.ts` asserts parity against `messages.ts`
for all three locales, plus that no row contains an unresolved `{placeholder}` mismatch.

### Types and pure helpers

| File | Lines | Contents |
| --- | --- | --- |
| `types/workflow.ts` | 325 | Node kinds, 21 node types, statuses, run states, error strategies, branches, field schema, definition, run, stats, template and validation types, plus the runtime tuples and the two poll constants. |
| `lib/workflowGraph.ts` | 634 | 45 pure graph functions: id generation, kind and label resolution, immutable `with*` / `without*` transforms, `reachableFrom`, `findCycle`, `executionOrder`, `autoLayout`, `summarizeDefinition`, `normalizeDefinition`, `serializeDefinition` / `deserializeDefinition`, `validateDefinition`. |
| `lib/workflowRun.ts` | 283 | Deterministic run synthesis: `hashSeed`, `seeded`, `formatDuration`, `progressOf`, `nodeStateCounts`, `buildNodeRuns`, `synthesizeRun`, `synthesizeRunHistory`, `emptyRunStats`, `computeRunStats`. |
| `lib/workflowTemplates.ts` | 211 | The five seeded templates and `instantiateTemplate`. |

The five preset templates the spec asked for, each a real definition rather than a stub:

| id | slug | scenario | complexity | useCount |
| --- | --- | --- | --- | --- |
| `wf-tpl-welcome` | welcome | onboarding | simple | 48 |
| `wf-tpl-winback` | winback | retention | medium | 31 |
| `wf-tpl-birthday` | birthday | lifecycle | simple | 22 |
| `wf-tpl-followup` | followup | marketing | medium | 17 |
| `wf-tpl-autoreply` | autoreply | support | complex | 39 |

Every graph mutation returns a new definition object; nothing mutates in place. That is
what makes the builder undoable and lets the deep watcher fire on a genuine edit only.

## 3. Issues the verification pass turned up

Six real problems. Five were caught by the test suite as it was written, one by `vue-tsc`.

### 3.1 The builder issue panel ignored local validation (bug, fixed)

`Builder.vue` rendered its problem list straight from `store.validation`, which is only ever
filled by `POST /workflows/validate`. The composable's `validateLocal()` writes to its own
ref, so before the first server round trip the panel was permanently empty. An untouched
canvas showed no issue at all instead of `The canvas is empty`, and a node missing a
required setting was not highlighted until the user pressed Validate.

Fixed inside `Builder.vue` only. The store and the composables were left alone on purpose:
`Detail.vue` relies on the detail page never overwriting the builder canvas, and the
composable tests pin the existing store semantics.

- destructure `validationLocal` instead of `issues` / `problemNodeIds` / `nodeIssues`
- add `serverValidation = ref<WorkflowValidation | null>(null)`
- `visibleIssues = (serverValidation ?? validationLocal).issues`, and derive `issuesByNode`
  and `selectedIssues` from it, so the server verdict wins when present and local wins
  while typing
- `problemIds` = issue node ids union the incomplete-node ids, which is what the canvas
  highlights
- `watch(definition, ..., { deep: true })` clears `serverValidation` and re-runs
  `validateLocal()`, so a stale server verdict can never outlive the edit that invalidated it
- `onValidate` assigns the response to `serverValidation`
- template binds `visibleIssues` and `:problem-node-ids="problemIds"`

### 3.2 Route order would have swallowed three pages (fixed before it shipped)

`/dashboard/workflows/:id` declared before the static segments makes `builder`, `runs` and
`templates` resolve as workflow ids. The five static routes are registered first and the
router carries a comment explaining why.

### 3.3 jsdom has no ResizeObserver or matchMedia (fixed in test setup)

Vue Flow measures its container through `ResizeObserver` and the builder reads the viewport
through `matchMedia`. Mounting any workflow view threw during setup, which would have forced
every test to stub the canvas. Both are now installed in `src/__tests__/setup.ts` behind a
`typeof === 'undefined'` guard, so a future jsdom that provides them keeps its own.

### 3.4 Demo fallback could mask a broken backend (fixed)

The first cut fell back to seeded data on any error. That turns a 500 into a plausible
looking screen. The fallback is now gated on `isMissingBackend(error)`, which only matches a
network failure, 404 or 501, and `demoWorkflowById` / `demoRunById` throw `ApiError`
NOT_FOUND for an unknown id instead of inventing one.

### 3.5 Local and server validation were conflated (fixed)

Both wrote to `store.validation`, so an instant local result could be overwritten by an
in-flight server response for an older definition. Resolved by 3.1: they live in separate
refs and the deep watcher invalidates the server copy on edit.

### 3.6 Type error in the test helper (fixed)

`buttonByLabel` accepted a `VueWrapper` but was called with `wrapper.get(...)` results, which
are `DOMWrapper<Element>`. The signature is now `root: VueWrapper | DOMWrapper<Element>` with
a single narrowing cast in the body, and `type DOMWrapper` was added to the `@vue/test-utils`
import. `vue-tsc --noEmit` exits 0.

### Deliberately not done

- No WebSocket channel for run updates. The spec allows polling or WebSocket; polling with
  backoff was chosen because it needs no new server contract and the notification socket
  from Sprint 9 stays the only socket in the app.
- No Web Worker for validation. `validateDefinition` is O(nodes + edges) with a single DFS
  cycle pass; at the palette's scale it runs in well under a millisecond, so a worker would
  add a serialization boundary for no measurable gain.
- No virtual scrolling on the canvas. Vue Flow already viewport-culls; the list pages page at
  20 rows.
- The execution engine itself. Node execution belongs to the backend; the frontend only
  renders what a run reports.

## 4. Evidence

### Type check

```
node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit
EXIT=0        (no output, no diagnostics)
```

### Workflow tests: 372 passing

| Test file | Tests | Covers |
| --- | --- | --- |
| `workflowapi.test.ts` | 42 | all 25 endpoints, query building, retry semantics, demo fallback gating, NOT_FOUND |
| `workflowlibs.test.ts` | 80 | graph transforms, reachability, cycles, execution order, auto layout, validation, run synthesis, templates |
| `workflowstore.test.ts` | 71 | every action and getter, paging, dirty tracking, error handling, demo flags |
| `workflowcomponents.test.ts` | 63 | all nine components: props, emits, drag source, dynamic form rendering, timeline, execution path |
| `workflowcomposables.test.ts` | 57 | filters, paging, builder edits, connect rejection reasons, poll backoff, template filters |
| `workflowviews.test.ts` | 51 | six views: hub 10, run history 9, templates 6, detail 8, builder 9, run detail 9 |
| `workflowi18n.test.ts` | 8 | 416-row parity across en / zh / fr, no empty value, no missing key |

### Whole suite

```
node ./node_modules/vitest/vitest.mjs run --coverage
Test Files  98 passed (98)
     Tests  1530 passed (1530)
```

Coverage thresholds are lines and statements at 80, functions and branches at 70. Result:

```
All files   98.66 % Stmts   92.82 % Branch   92.68 % Funcs   98.66 % Lines
```

Workflow files specifically:

```
File                                   % Stmts   % Branch   % Funcs   % Lines
api/workflow.ts                            100      95.04       100       100
api/demoWorkflow.ts                       94.4      92.72     97.56      94.4
stores/workflow.ts                         100      91.62       100       100
types/workflow.ts                          100        100       100       100
composables/useWorkflow.ts                 100        100       100       100
composables/useWorkflowBuilder.ts          100      98.66       100       100
composables/useWorkflowMonitor.ts          100      96.49       100       100
composables/useWorkflowTemplates.ts        100        100       100       100
lib/workflowGraph.ts                     98.98       94.6       100     98.98
lib/workflowNodes.ts                       100        100       100       100
lib/workflowRun.ts                         100         95       100       100
lib/workflowTemplates.ts                   100        100       100       100
i18n/workflow.ts                           100        100       100       100
components/workflow/ (9 files)           98.84      87.39     95.38     98.84
views/dashboard/workflows/ (6 files)     94.59      85.82     76.31     94.59
```

### Build

```
node ./node_modules/vite/bin/vite.js build
```

Zero errors. The four Vue Flow packages and the six workflow views land in their own chunks,
so a user who never opens `/dashboard/workflows` never downloads the canvas.

### Home view stub router (resolved)

`src/__tests__/homeview.test.ts` mounts `HomeView` against a hand-written stub router, and that
stub had fallen behind the home grid: `/dashboard/marketing` and `/dashboard/settings` already
logged `[Vue Router warn]: No match found for location with path ...` before Sprint 12, and the
new `/dashboard/workflows` card joined them. The warning was cosmetic, but it also meant the
newest home entry point was never asserted.

The stub now registers all ten targets the home grid links to, and the `href` test asserts all
ten. The run is warning-free and both tests pass. The real router in `src/router/index.ts` still
owns the six workflow paths and is exercised by `src/__tests__/router.test.ts` plus the 51
workflow view tests; no production routing changed.

