# Sprint 7 Customer Management Module Scan Report

Scope: customer directory at `/dashboard/customers` (list + search + filters,
detail profile, stats, conversation history, tags CRUD and assignment).

## Existing assets (reuse, do not rewrite)

- `src/components/KsAvatar.vue` — initials avatar with brand palette; used for
  customer avatars (props: name / src / size).
- `src/lib/relativeTime.ts` — localized relative time (`relativeTime(ts, now, locale)`)
  for "last contact" columns.
- `src/components/conversation/ConversationItem.vue` — Sprint 6 list row reused
  verbatim on the customer detail page for conversation history (swipe actions
  hidden via the item's own emits; page handles select only).
- `src/stores/conversation.ts` — conversation source for customer threads;
  customer conversations resolve into the same `Conversation` shape so the inbox
  can open them via `/dashboard/conversations?open={id}`.
- `src/stores/channel.ts` + `CHANNEL_PLATFORMS` — platform metadata for the
  channel filter chips and active-channel badges.
- `src/api/http.ts` — apiGet/apiPost/apiPut/apiDelete envelope + session recovery;
  `apiErrorI18nKey()` for toast copy.
- `src/api/demo.ts` — `isMissingBackend()` fallback pattern; new demo customer +
  tag datasets follow the same localStorage persistence style (`ks-demo-*` keys).
- `src/composables/usePageMeta.ts` — page title/meta management.
- RegisterView validation regexes (EMAIL_RE / PHONE_RE) replicated locally in
  CustomerForm to avoid touching Sprint 3 code.
- Home feature grid is the dashboard navigation (no sidebar exists); the
  Customers card is inserted directly after the Conversations card.

## Potential conflicts and decisions

1. Naming: legacy `src/api/conversations.ts` (Sprint 2c mock) stays untouched;
   customer conversation history goes through the new `src/api/customer.ts`
   (`getCustomerConversations`) with a demo fallback keyed by phone match
   against the Sprint 6 demo inbox (`ks-demo-inbox`), so both modules show the
   same contacts offline.
2. `ConversationItem` reuse: Sprint 6 component is mounted on the detail page
   without modifying it; select events navigate to the inbox instead of opening
   an inline thread (the inbox owns thread rendering).
3. Inbox deep link: `views/dashboard/conversations/index.vue` gains a small
   additive onMounted read of `route.query.open` to preselect a conversation.
   No Sprint 6 behaviour changes when the query is absent.
4. Types are additive only: `Customer`, `CustomerInput`, `CustomerStats`,
   `Tag`, `CustomerFilters`, `PagedCustomers`, `TAG_COLORS`. `Conversation`
   and message types untouched.
5. No WebSocket surface for customers (REST only per spec); no additions to
   `src/events/socket.ts`.
6. Delete confirmation uses a declarative `van-dialog` (template-driven) so
   jsdom tests can drive confirm/cancel without global dialogs.
7. Tag colors are a fixed palette derived from DESIGN_SYSTEM.md tokens
   (brand gold, terracotta, indigo accent, success, warning, error) rather than
   a free color picker, keeping contrast and theme consistency.
8. Demo dataset: 6 customers mirroring the demo inbox contacts (linked by
   phone) + 2 standalone customers (no threads) to exercise empty-history and
   stats edge cases; 4 preset tags seeded on first read.

## Delivery evidence (Sprint 7)

- i18n: 54 new keys (customers.*, tags.*, home.entryCustomers*) added to all
  three locales in `src/i18n/messages.ts`; 384 keys per locale, no missing key
  and no mojibake (file patched through a Node script, never Get-Content).
- Tests: 8 new files in `src/__tests__` (customerapi, customerstore, tagstore,
  customercomposables, customercomponents, customersview, customerdetail,
  inboxdeeplink) adding 106 cases.
- Suite: 64 files / 417 tests passed (was 56 / 311).
- Coverage (vitest v8, thresholds 80/80/70/70): statements 97.63%,
  branches 89.95%, functions 89.59%, lines 97.63%.
  New code: stores/customer.ts 100%, stores/tag.ts 100%,
  views/dashboard/customers/index.vue 93.33%, detail.vue 96.5%.
- `pnpm run typecheck` (vue-tsc) clean; `pnpm run build` clean
  (524 modules, dist/assets/index-*.js 577.13 kB).
