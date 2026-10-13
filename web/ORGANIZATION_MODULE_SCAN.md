# Sprint 13 pre-build scan: multi-tenancy and permissions

Run before any Sprint 13 code was written, as the spec requires. Every claim below was
checked against the working tree at `4bb6535` plus the uncommitted Sprint 12 delivery.

## 1. What already exists

### Views under `src/views/dashboard/`

| Area | Files |
| --- | --- |
| Analytics | `analytics/index.vue` |
| Channels | `channels/index.vue`, `channels/connect.vue` |
| Conversations | `conversations/index.vue` |
| Customers | `customers/index.vue`, `customers/detail.vue` |
| Marketing | `marketing/index.vue`, `CreateCampaign.vue`, `CampaignDetail.vue`, `Templates.vue`, `History.vue` |
| Notifications | `notifications/index.vue`, `notifications/preferences.vue` |
| Settings | `settings/index.vue` (hub) + `ProfileTab`, `SecurityTab`, `PreferencesTab`, `ChannelsTab` |
| Subscription | `subscription/index.vue`, `upgrade.vue`, `usage.vue` |
| Workflows | `workflows/index.vue`, `Builder.vue`, `Runs.vue`, `RunDetail.vue`, `Templates.vue`, `Detail.vue` |

There is no `dashboard/organization/`, no `views/onboarding/` and no `views/invitation/`.
All three directories are new in this sprint.

### Stores (`src/stores/`)

`analytics`, `auth`, `channel`, `conversation`, `customer`, `drafts`, `marketing`, `message`,
`notification`, `settings`, `subscription`, `tag`, `usage`, `websocket`, `workflow`.

All fifteen are setup-style `defineStore` factories returning refs and computeds. There is no
`organization` store and nothing tenant-aware: `auth.ts` holds a single `user` ref with no
organisation field, so the current architecture is single-tenant exactly as the brief states.

### API modules (`src/api/`)

`ai`, `analytics`, `auth`, `channel`, `conversation`, `conversations`, `copywriting`,
`customer`, `demo`, `demoMarketing`, `demoWorkflow`, `http`, `marketing`, `message`,
`notification`, `plan`, `settings`, `subscription`, `tag`, `usage`, `webhooks`, `workflow`.

The house pattern, identical in all of them:

1. Call the real endpoint through `apiGet` / `apiPost` / `apiPut` / `apiDelete`.
2. Catch, test with `isMissingBackend(error)` from `api/demo.ts` (true on network errors,
   `TIMEOUT`, `HTTP_404`, `NOT_FOUND`).
3. Re-throw anything else, otherwise return the localStorage-backed demo equivalent.

`api/http.ts` owns the envelope (`ApiResponse<T>`), `ApiError`, a 10s timeout, one automatic
retry for GET on transient failures, a single-flight `/auth/refresh` on 401 and the global
`onUnauthorized` hook. It sends `credentials: include` and no tenant header of any kind.

### Router (`src/router/index.ts`)

One flat `routes` array plus a `PUBLIC_PATHS` set and a single inline `router.beforeEach` that
awaits `auth.bootstrap()`, redirects unauthenticated users to `/login?redirect=...` and pushes
authenticated users off `/login` and `/register`. There is **no** `src/router/guards.ts` and no
route currently declares `meta`. Both are new in this sprint.

### Composables (`src/composables/`)

Twenty-six, including `useWorkflow`, `useWorkflowBuilder`, `useWorkflowMonitor`,
`useWorkflowTemplates`, `useCustomer`, `useMarketing`, `useNotification`, `useSettings`,
`usePageMeta`. The Sprint 12 shape is the one to copy: the composable owns view-local state
(search text, filters, paging offset) and delegates every read and write to the store, so the
demo/real switch stays invisible to the view.

### Guards

Only the inline `beforeEach` above. No permission guard, no organisation guard, no 403 route.

## 2. Reusable assets

| Asset | Reused for |
| --- | --- |
| `api/http.ts` envelope + retry + 401 recovery | every new endpoint, unchanged |
| `api/demo.ts` `isMissingBackend` + `enterDemoMode` | the organisation demo fallback |
| `stores/auth.ts` `bootstrap()` / `demo` flag | org bootstrap ordering and the demo badge |
| `composables/usePageMeta.ts` | title + description on all seven new routes |
| `lib/metrics.ts` `formatNumber` | locale-aware member and invitation counts |
| `lib/relativeTime.ts` `relativeTime` | joined / last-login / activity timestamps |
| `components/KsAvatar.vue` | member avatars with initial fallback |
| `components/UserMenu.vue` | host for the org switcher and the new menu entries |
| `styles/tokens.css` design tokens | every new class; no literal colours anywhere |
| `i18n/` row-tuple pattern (`i18n/workflow.ts`) | `i18n/organization.ts`, three locales per row |
| `.wf` page shell in `views/dashboard/workflows/index.vue` | the `.org` shell: same top bar, demo bar, KPI row, toolbar, grid, error block |

## 3. Collision check

Case-insensitive search over `src/` excluding tests:

| Term | Files hit |
| --- | --- |
| `organization` | 0 |
| `tenantId` | 0 |
| `orgId` | 0 |
| `invitation` | 0 |
| `RoleBadge` | 0 |
| `PermissionGuard` | 0 |
| `v-permission` | 0 |
| `permission` | 2 |

The two `permission` hits are `lib/notificationAlerts.ts` and
`views/dashboard/notifications/preferences.vue`, and both mean the **browser push** permission
(`NotificationPermission`, `requestBrowserPushPermission`). Different domain, different names,
no overlap with the RBAC `Permission` type introduced here.

`src/types/index.ts` exports 109 symbols; none is named `Permission`, `Role`, `Member`,
`Organization`, `Invitation` or `PermissionGroup`. The new domain types therefore live in
`src/types/organization.ts` and are re-exported by one added line, mirroring how Sprint 12
added `export * from './workflow'`.

## 4. Real risks found, and the decision taken

**Risk 1 - the guard rewrite.** The spec asks for `src/router/guards.ts`, but the accepted
guard lives inline in `index.ts`. Moving it would rewrite Sprint 3 accepted logic. Decision:
`guards.ts` is a new file exporting a second `beforeEach` that is appended after the existing
one. The auth guard stays byte-identical; ordering gives it priority, which is what we want
because the org guard must only run for an authenticated user.

**Risk 2 - the tenant header.** Section 16 wants every request to carry the current org id.
`fetchWithTimeout` is shared by all 22 api modules, so touching it is the highest-blast-radius
change in the sprint. Decision: one additive hook, `setRequestContext()`, that stores a header
map which `fetchWithTimeout` merges into `init.headers`. Unset means byte-identical behaviour,
so Sprints 3-12 cannot regress. No existing call site changes.

**Risk 3 - route order.** `/dashboard/organization/:id` would swallow `members`, `roles`,
`settings` and `switch`, the same trap Sprint 12 documented for workflows. Decision: no
parameterised org route at all. All five org routes are static, so ordering cannot bite.

**Risk 4 - switching orgs leaves stale data.** Customers, conversations, marketing, analytics,
notifications and workflows all cache into their own stores. Decision: `switchOrganization`
calls one exported `resetScopedStores()` that `$reset`s exactly those stores, then reloads the
org-scoped data. Nothing is re-fetched that the target page would fetch itself.

**Risk 5 - the no-org redirect loop.** If the guard sends an orgless user to
`/onboarding/create-org` and that route itself requires an org, the router loops forever.
Decision: `/onboarding/create-org` and `/invitation/:token` are declared `requiresOrg: false`,
and the guard treats "already on the onboarding route" as a pass.

**Risk 6 - permission checks must not deadlock the UI.** `checkPermission` is a POST, so a
naive `v-permission` would need an await per element. Decision: permissions are loaded once per
org into the store and every check is synchronous against that cached set; the api endpoints
still exist for the server-authoritative path and are covered by tests.

## 5. Delivery

Verified on 2026-09-24. The module is additive: nine product files and one test file changed by
169 added and 10 removed lines, and no accepted Sprint 3-12 behaviour was rewritten. The auth
guard in `router/index.ts` is byte-identical; the organisation guard is a second `beforeEach`
appended after it.

### 5.1 New files

| Layer | File | Lines |
| --- | --- | --- |
| api | `src/api/organization.ts` | 156 |
| api | `src/api/member.ts` | 176 |
| api | `src/api/role.ts` | 77 |
| api | `src/api/permission.ts` | 76 |
| api | `src/api/demoOrganization.ts` | 881 |
| types | `src/types/organization.ts` | 209 |
| lib | `src/lib/organization.ts` | 323 |
| lib | `src/lib/permissions.ts` | 215 |
| lib | `src/lib/orgNav.ts` | 42 |
| store | `src/stores/organization.ts` | 926 |
| composable | `src/composables/useOrganization.ts` | 163 |
| composable | `src/composables/useMember.ts` | 183 |
| composable | `src/composables/useRole.ts` | 177 |
| composable | `src/composables/usePermission.ts` | 73 |
| router | `src/router/guards.ts` | 99 |
| directive | `src/directives/permission.ts` | 174 |
| component | `src/components/organization/OrgPageShell.vue` | 313 |
| component | `src/components/organization/OrgCard.vue` | 130 |
| component | `src/components/organization/OrgSwitcher.vue` | 282 |
| component | `src/components/organization/MemberTable.vue` | 327 |
| component | `src/components/organization/InviteDialog.vue` | 365 |
| component | `src/components/organization/ActivityFeed.vue` | 95 |
| component | `src/components/organization/PermissionTree.vue` | 260 |
| component | `src/components/permission/PermissionGuard.vue` | 51 |
| component | `src/components/permission/RoleBadge.vue` | 92 |
| view | `src/views/dashboard/organization/index.vue` | 468 |
| view | `src/views/dashboard/organization/members.vue` | 708 |
| view | `src/views/dashboard/organization/roles.vue` | 585 |
| view | `src/views/dashboard/organization/settings.vue` | 750 |
| view | `src/views/dashboard/organization/switch.vue` | 147 |
| view | `src/views/onboarding/CreateOrg.vue` | 505 |
| view | `src/views/invitation/Accept.vue` | 317 |
| view | `src/views/errors/Forbidden.vue` | 186 |
| i18n | `src/i18n/organization.ts` | 397 |
| tests | `src/__tests__/organizationlibs.test.ts` | 491 |
| tests | `src/__tests__/organizationapi.test.ts` | 342 |
| tests | `src/__tests__/organizationstore.test.ts` | 821 |
| tests | `src/__tests__/organizationcomposables.test.ts` | 927 |
| tests | `src/__tests__/organizationcomponents.test.ts` | 957 |
| tests | `src/__tests__/organizationi18n.test.ts` | 215 |
| tests | `src/__tests__/organizationviews.test.ts` | 1830 |

9,928 lines of product code, 5,583 lines of tests.

### 5.2 Changed files

| File | +/- | What changed |
| --- | --- | --- |
| `src/api/http.ts` | 47/1 | `setRequestContext()` plus a merge of those headers in `fetchWithTimeout`. With no context set the behaviour is byte-identical, so no existing call site moves. |
| `src/router/index.ts` | 60/3 | Five static organisation routes, `/onboarding/create-org`, `/invitation/:token` and `/403`, then `registerOrgGuards()` appended after the untouched auth guard. |
| `src/api/auth.ts` | 14/0 | `demoCurrentUser()`, the non-throwing identity read the demo directory seeds an owner from. |
| `src/views/HomeView.vue` | 13/1 | Workspace entry card for the organisation module. |
| `src/main.ts` | 7/2 | Registers `v-permission` after pinia, because the directive reads the organisation store. |
| `src/App.vue` | 3/1 | `OrgSwitcher` in the top bar next to the notification bell. |
| `src/i18n/messages.ts` | 4/0 | Merges the organisation namespace into en, zh and fr. |
| `src/components/UserMenu.vue` | 3/1 | Organisation and switch-organisation menu entries. |
| `src/types/index.ts` | 3/0 | `export * from './organization'`, mirroring the Sprint 12 line above it. |
| `src/__tests__/usermenu.test.ts` | 15/1 | Regression test for the two new menu labels (see 5.3, item 8). |

### 5.3 What the tests caught, and the fix

Wiring tests against mocked api edges are worth their weight when they fail on product code
rather than on the test. Eight did.

1. **The role list was never loaded on two pages.** `bootstrap()` primes the permission set and
   the catalogue, not the roles, so `members.vue` and `index.vue` rendered an empty role filter,
   an empty per-row role picker and an invite dialog with no role to choose. Both pages now load
   roles with the rest of their data. Caught by `names roles in the reader language` and
   `invites from the overview against the tenant in view`.
2. **Built-in roles were printed as message keys.** A built-in role stores `org.role.owner` in
   its `name`, so `roles.vue` (badges, detail title, delete confirmation) and `members.vue`
   (filter options, invitation badge, detail dialog) showed the key instead of "Owner". Both now
   go through a `roleLabel` helper, the same one `MemberTable` already had.
3. **Editing a role toasted "Role created".** `closeEdit()` clears `draftId` before the toast
   read `editorIsCreate`, so every save announced a creation. The mode is captured first.
   Caught by `edits a custom role where it stands`.
4. **The owner could be offered as their own successor.** `transferCandidates` compared
   `member.id` with `organization.ownerId`, which is a user id, so the filter never matched.
   It compares `member.userId` now. Caught by `offers only active teammates who are not the owner`.
5. **"Choose a successor" was an invisible error.** `submitTransfer` set
   `formErrors.transfer` to a field-label key that nothing rendered. It has its own message
   (`org.error.transferTarget`, all three locales) and its own element. Caught by
   `names what is missing before ownership can move`.
6. **The switch page could not mark the tenant in use.** It loaded the list but not the current
   organisation, so no card was `aria-current` and clicking it did nothing. It loads both.
7. **`v-permission` erased an author's own inline display.** `restoreElement` wrote
   `display = previous ?? ''` on a first-pass grant, wiping a `display: flex` the component had
   set itself. It now only resets display when it recorded one.
8. **The user menu showed a raw key.** `UserMenu.vue` pointed at `nav.organization`, a row
   dropped while de-duplicating the organisation namespace. It uses `org.title` now, and a scan
   of every static `t('...')` reference in product code against the 1,615 defined keys finds no
   other dangling key.

### 5.4 Evidence

Type check:

```
node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit
EXIT=0        (no output, no diagnostics)
```

Organisation tests: 321 passing

| Test file | Tests | Covers |
| --- | --- | --- |
| `organizationlibs.test.ts` | 41 | tenant context in localStorage, every validator, name confirmation, permission matching and wildcards, role sorting, the nav model |
| `organizationapi.test.ts` | 16 | all four api modules: endpoints, query building, the tenant header, demo fallback gating |
| `organizationstore.test.ts` | 51 | every action and getter, member paging, switch plus the scoped store resets, bootstrap memoisation, error paths, demo flags |
| `organizationcomposables.test.ts` | 46 | the four composables and `v-permission`: hide, disable with a reason, re-grant when a right arrives, watcher teardown |
| `organizationcomponents.test.ts` | 60 | all nine components: props, emits, guards, the permission tree, the invite dialog, the switcher |
| `organizationi18n.test.ts` | 10 | 335-row parity across en / zh / fr, every referenced key resolves, runtime-built keys resolve, no unused row |
| `organizationviews.test.ts` | 97 | guards 15, forbidden 4, accept 10, create 8, switch 6, overview 9, members 15, roles 14, settings 16 |

Whole suite:

```
node ./node_modules/vitest/vitest.mjs run --coverage
Test Files  105 passed (105)
     Tests  1852 passed (1852)
```

Coverage thresholds are lines and statements at 80, functions and branches at 70. Result:

```
All files   97.84 % Stmts   92.40 % Branch   92.31 % Funcs   97.84 % Lines
```

Organisation files specifically:

```
File                                    % Stmts  % Branch   % Funcs
api/organization.ts                       76.92     62.96       100
api/member.ts                             78.05     72.97       100
api/role.ts                               76.92     61.54       100
api/permission.ts                         78.57     64.29     83.33
api/demoOrganization.ts                   44.23     74.42     45.61
lib/organization.ts                       99.13     96.77       100
lib/permissions.ts                        99.31     96.61       100
lib/orgNav.ts                               100       100       100
stores/organization.ts                     93.1        80       100
composables/useOrganization.ts              100     97.44       100
composables/useMember.ts                    100     94.29       100
composables/useRole.ts                    99.23     98.48       100
composables/usePermission.ts                100       100       100
router/guards.ts                            100       100       100
directives/permission.ts                  97.22        90       100
i18n/organization.ts                        100       100       100
components/organization/ (7 files)        99.03     95.45       100
components/permission/ (2 files)            100       100       100
views/dashboard/organization/ (5 files)   99.92     85.16      93.9
views/onboarding/CreateOrg.vue            99.07     84.21       100
views/invitation/Accept.vue                96.3     80.77       100
views/errors/Forbidden.vue                98.15     78.57       100
```

`types/organization.ts` is type-only and carries no executable statement, so it is absent from
that table. The api modules sit lower for the reason every other api module in this repo does:
the tests mock the module boundary, so a real `fetch` path runs only where a test deliberately
lets it through. `api/demoOrganization.ts` is 44.23% for the same reason, and it is scaffolding
that leaves when the backend endpoints arrive.

Build:

```
node ./node_modules/vite/bin/vite.js build
1384 modules transformed, built in 10.05s, PWA precache 8 entries, EXIT=0
```

### 5.5 Deliberate limits

- **No backend.** Every endpoint falls back to `api/demoOrganization.ts` when the server does
  not answer, and any row that came from it is flagged `demo: true`, which the pages turn into
  a dismissible "sample data" bar. Nothing pretends to be real data.
- **Data isolation is a header plus a reset.** Requests carry `X-Organization-Id`; switching
  tenants empties the org-scoped rows and calls `resetScopedStores()` on the customer,
  conversation, marketing, analytics, notification and workflow stores, then hard-navigates so
  no in-memory row can survive. Row-level filtering stays the server's job.
- **The permission catalogue is fetched once per session** and memoised; the role tree renders
  from that cache, which is the lazy load section 19 asks for without a second request per node.
- **No organisation route takes a parameter.** All five are static, so the `/:id` swallow trap
  Sprint 12 documented cannot appear here.
