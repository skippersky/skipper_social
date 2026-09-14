# Sprint 9 Notification Centre Module Scan Report

Scope: notification centre at /dashboard/notifications (type and read-status
filters, paginated list with windowing, per-row mark-read and delete, bulk
mark-all-read and clear-read), a preferences page at
/dashboard/notifications/preferences, a header bell with a recent-items
dropdown, and a global toast layer with browser-push and audio delivery.

## Files added

- web/src/api/notification.ts - nine endpoint wrappers over apiGet/apiPut/
  apiDelete, each with a demo fallback: list, by id, mark read, mark all read,
  delete, delete read, unread count, get preferences, update preferences.
- web/src/stores/notification.ts - list state, filters, paging offsets, unread
  badge, connection status, preferences, the toast queue and the polling
  fallback used while the socket is down.
- web/src/websocket/notificationWs.ts - NotificationSocket: subscribes to the
  shared socket bus, dedupes by id, maps transport status onto notification
  connection states and counts retries.
- web/src/composables/useNotificationSocket.ts - wires NotificationSocket to
  the store: status fan-out, realtime row insert, read receipts, teardown.
- web/src/composables/useNotification.ts - single-row operations plus the
  click-through contract (mark read, then route).
- web/src/composables/useNotificationList.ts - list operations: load, filter,
  load more, bulk actions, refresh.
- web/src/lib/notificationAlerts.ts - browser push mirror and the short audio
  cue, both degrading silently; resetNotificationAlerts() test hook.
- web/src/lib/notificationWindow.ts - computeVirtualWindow(), a pure
  fixed-height windowing function with no DOM dependency.
- web/src/components/notification/ - NotificationBell, NotificationDropdown,
  NotificationItem, NotificationToast.
- web/src/views/dashboard/notifications/index.vue - the notification centre.
- web/src/views/dashboard/notifications/preferences.vue - the preferences page.
- Nine test files: notificationapi, notificationstore, notificationcomposables,
  notificationcomponents, notificationsview, notificationsocket,
  notificationpreferences, notificalerts, notificationwindow.

## Existing assets (reuse, do not rewrite)

- src/api/http.ts - apiGet/apiPut/apiDelete envelope, timeout, the single
  retry on retriable failures and ApiError(code, message); apiErrorI18nKey()
  for toast copy. No parallel fetch layer was added.
- src/api/demo.ts - isMissingBackend() fallback pattern. The demo notification
  seed derives its message rows from the existing demo inbox, so
  notifications, inbox and customers agree while offline.
- src/composables/useWebSocket.ts and src/events/socket.ts - the Sprint 6
  singleton transport and its bus. Notification frames ride the same
  connection; no second WebSocket was opened.
- src/lib/relativeTime.ts - toast and row timestamps.
- src/composables/usePageMeta.ts - page title and meta description on both
  notification routes.
- src/i18n store - t() with value interpolation; no new mechanism.
- src/stores/auth.ts - isAuthenticated drives the bell and the socket attach.
- src/components/KsAvatar.vue and the DESIGN_SYSTEM --ks-* tokens only,
  through scoped CSS. This repo has no Tailwind and none was introduced.
- The home feature grid is the dashboard navigation (there is no sidebar), so
  the Notifications card was inserted after the Analytics card.

## Potential conflicts and decisions

1. The row type is named AppNotification, not Notification. The browser owns
   the global Notification constructor and lib/notificationAlerts.ts needs the
   real one, so a type called Notification would shadow the platform API at
   every import site.
2. One shared socket, not a notification socket. NotificationSocket takes
   injected connect and watchStatus dependencies and subscribes to socketBus.
   Two frames were added to the existing envelope in useWebSocket: notification
   and notification_read. The Sprint 6 inbox events are untouched.
3. useNotificationSocket.ts now sits next to Sprint 6 useWebSocket.ts. Similar
   names, different layers: the first is domain wiring, the second is
   transport. App.vue attaches on login and detaches on logout through a watch
   on auth.isAuthenticated, so an anonymous session holds no socket and no
   polling interval.
4. Retry policy deliberately diverges from the transport. The shared client
   backs off forever for the inbox; the notification layer stops announcing
   "retrying" after MAX_NOTIFICATION_RETRIES = 5 and surfaces an error state
   instead. The dedupe ring is capped at DEDUPE_CAPACITY = 200 ids so a long
   session cannot grow the seen set without bound.
5. Error policy mirrors Sprint 8. A non-ApiError (offline, missing backend)
   falls back to demo data and marks rows demo true. An ApiError whose code
   starts with HTTP_5 never falls back: the store keeps error = api.500, the
   list shows the error state with a retry button and the badge is left alone.
6. Sample-data disclosure. The amber bar is dismissible and persists under
   ks-notifications-demo-hidden, separate from ks-chat-demo-hidden,
   ks-customers-demo-hidden and ks-analytics-demo-hidden. Like the inbox and
   the customer directory, and unlike analytics, dismissing also hides the
   rows: a notification list of fake rows is more misleading than an empty one.
7. Windowing only above VIRTUAL_THRESHOLD = 100 rows, with a fixed
   NOTIFICATION_ROW_HEIGHT of 76px, overscan 6 and a 600px viewport.
   Short lists render everything, which keeps the scrollbar stable. The math is
   a pure function so it is tested without a DOM, and no virtual-list library
   was added.
8. Browser push and the audio cue are best-effort mirrors, not a delivery
   guarantee. Both return false or unsupported when the platform refuses, and
   the in-app toast stays the source of truth. Permission is requested only
   from the preferences switch, which is a real user gesture; nothing prompts
   on load. There is no service-worker push in this sprint.
9. Toast queue is capped at MAX_TOASTS = 3 with a TOAST_TTL_MS = 5000 lifetime.
   Timers are keyed on toast id, so a re-ordered queue never restarts a
   countdown. enqueueToast checks the per-type preference first, which means a
   muted type never produces a toast even though the row still lands in the list.
10. Types are additive only: AppNotification, NotificationType,
    NOTIFICATION_TYPES, NotificationFilters, NotificationPreferences,
    NotificationConnectionStatus, PagedNotifications. No existing interface
    changed, and src/types/index.ts is 60 added lines with 0 removed.
11. App.vue, HomeView.vue and router/index.ts changes are additive. The bell
    renders only when authenticated; the toast layer is always mounted because
    it is also the offline preview target. No Sprint 5b or Sprint 8 behaviour
    was modified.
12. No backend endpoints exist yet. /api/v1/notifications and its sub-routes
    are a contract proposal: list with type, status, limit and offset; PUT
    /{id}/read; PUT /read-all returning {updated}; DELETE /{id}; DELETE /read
    returning {deleted}; GET /unread-count returning {count}; GET and PUT
    /preferences. Every wrapper degrades to demo data through isMissingBackend.
13. No new dependency was added. No socket.io-client, no virtual list, no
    date library; the sprint reuses the Sprint 6 transport and hand-rolled
    relative time.

## Delivery evidence (Sprint 9)

- i18n: 64 new keys per locale (nav.notifications, 61 notifications.* and the
  two home.entryNotifications* keys) in en, zh and fr; 409 keys per locale, no
  missing key. The diff on messages.ts is 192 added lines and 0 removed.
- Tests: 9 new files adding 168 cases (notificationstore 37,
  notificationcomponents 27, notificationcomposables 21, notificationsview 18,
  notificationapi 18, notificationsocket 15, notificalerts 13,
  notificationpreferences 11, notificationwindow 8) plus one new case in
  app.test.ts locking the bell to authenticated sessions.
- Suite: 80 files / 701 tests passed with exit code 0. Those counts include
  scratchanalytics.test.ts, a Sprint 8 ground-truth diagnostic that must be
  deleted before commit; without it the suite is 79 files / 700 tests.
  Baseline before Sprint 9 was 71 files / 532 tests.
- Coverage (vitest v8, thresholds 80/80/70/70): statements 98.24%, branches
  91.93%, functions 92.01%, lines 98.24%. Baseline before Sprint 9 was
  97.99 / 90.95 / 90.40 / 97.99.
- New code: stores/notification.ts 100/100/100/100, api/notification.ts 100%
  lines (89.65% branches), websocket/notificationWs.ts 100% lines (98.07%
  branches), lib/notificationAlerts.ts and lib/notificationWindow.ts 100%, the
  three notification composables 100%, components/notification 99.29% lines,
  views/dashboard/notifications 97.82% lines (preferences.vue 100%, index.vue
  96.49% on the paging and dismiss branches).
- pnpm run typecheck (vue-tsc) clean. It caught two real defects in the new
  tests rather than in product code: a props bag passed to mount() through a
  never-cast component, and findAll() results typed as VueWrapper instead of
  DOMWrapper in the preferences switch helper.
- pnpm run build clean: 1169 modules, dist/assets/index-*.js 1217.61 kB (gzip
  409.54), CSS 339.72 kB (gzip 72.00), plus the PWA precache of 6 entries.
  Sprint 8 was 1143 modules / 1175.29 kB / 319.59 kB. The entry chunk is still
  over the 500 kB warning line; the follow-up worth doing remains a dynamic
  import for the analytics and notification routes.

## Manual acceptance path

1. Log in with the demo account (demo@kilisocial.app / Demo1234) or any
   registered user. Before login the header shows no bell; after login it does.
2. Home grid then the Notifications card, or open /dashboard/notifications
   directly. The bell dropdown offers the same destination under View all.
3. Badge: unread count on the bell, capped at 99+. Four of the eleven seeded
   rows are unread.
4. Bell dropdown lists up to five recent rows with Mark all read, View all and
   Preferences; Escape or an outside click closes it.
5. Centre filters: type chips All, Messages, Conversations, Customers, System,
   plus a status select Any status, Read, Unread. Each change refetches and
   resets the paging offset.
6. Row actions: clicking a row marks it read then routes (a customer row goes
   to /dashboard/customers/u-8); a row with no link stays put and only flips to
   read. Mark read shows on unread rows only, Delete on every row.
7. Bulk actions: Mark all read empties the badge and toasts; Clear read removes
   read rows and toasts. Refresh reloads the page and the badge.
8. The amber sample-data bar shows while offline. Dismiss it, reload, and it
   stays hidden with the empty state underneath.
9. Preferences page: six switches, four notification types plus browser push
   and sound. Toggling stays local until Save preferences; a failing save
   reverts every switch and toasts the error copy.
10. Browser push asks for permission once. Denying it, or a browser without
    Notification support, reverts the switch with an explanatory toast and
    never prompts again while the switch is off.
11. Send a test notification pushes a system toast with no backend running; it
    lands at the top of the list and bumps the badge.
12. The live pill in the preferences header reads Offline updates while the
    socket is down and Live once it connects.
13. Resize to phone width: the two-column preferences grid stacks to one, the
    save button goes full width, the bell stays in the header and the toast
    stays anchored clear of the tabbar.
