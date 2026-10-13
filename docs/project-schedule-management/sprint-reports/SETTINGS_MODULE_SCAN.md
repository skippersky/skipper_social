# Sprint 10 Settings and Account Module Scan Report

Scope: system settings hub with four tabs (profile, security, preferences, channel
accounts). This document records what already exists, what is reused, and every
deliberate deviation from the task text.

## 1. Existing assets found by the scan

### Views (src/views)
- `SettingsProfileView.vue` routed at `/settings/profile` (Sprint 3). Edits nickname,
  company, timezone, language and an avatar URL through `auth.updateProfile`.
- `SettingsSecurityView.vue` routed at `/settings/security` (Sprint 3). Changes the
  password through `authApi.changePassword`.
- `components/SettingsNav.vue` is the two column shell those pages share.
- `views/dashboard/channels/index.vue` and `connect.vue` (Sprint 5b) already list and
  connect channels.
- `views/dashboard/notifications/preferences.vue` (Sprint 9) already owns the sound
  and browser push switches.

### API (src/api)
- `http.ts`: `apiGet/apiPost/apiPut/apiDelete`, `ApiError`, `apiErrorI18nKey`,
  10s timeout, one GET retry, single-flight 401 refresh. Reused as is.
- `auth.ts`: `getMe`, `updateMe`, `changePassword`, `resetPassword`, plus a private
  localStorage demo user directory (`ks-demo-users`) and `DEMO_CREDENTIALS`.
- `channel.ts`: `getChannels`, `connectChannel`, `disconnectChannel`,
  `refreshChannelToken`, all with demo fallback.
- `demo.ts`: `isMissingBackend`, `demoChannels`, `demoChannelById`, `demoConnect`,
  `demoDisconnect`, `demoRefreshToken`, `DEFAULT_NOTIFICATION_PREFERENCES`,
  `demoNotificationPreferences`, `demoUpdateNotificationPreferences`.

### Stores (src/stores)
- `auth.ts` (session, user, demo flag), `channel.ts` (channels, quota slots,
  connect/disconnect/refresh, channelBus events), `notification.ts` (list, unread,
  toasts, `preferences`, `fetchPreferences`, `updatePreferences`),
  `subscription.ts` (plan quotas used by the channel quota warning).

### Providers and channel components (Sprint 5b)
- `providers/`: `ChannelProvider` strategy with `getRequiredCredentials()`,
  `connect(credentials?)`, `disconnect`, `refreshToken`, `getStatus`, plus
  `ChannelProviderFactory` registering whatsapp / facebook / instagram / tiktok.
- `components/channel/`: `ChannelCard.vue` (connect / refresh / disconnect),
  `ChannelStatusBadge.vue`, `CredentialFormDialog.vue` (dynamic credential fields,
  required-field validation, submit and oauth emits), `PlatformSelector.vue`,
  `ConnectLimitWarning.vue`.

### Design tokens (src/styles/tokens.css)
- All colours, radii, shadows and motion are CSS custom properties
  (`--ks-bg-surface`, `--ks-primary`, `--ks-motion-normal`, `--ks-ease`, ...).
- `DESIGN_SYSTEM.md` defines a light palette only. It contains no dark tokens.

## 2. Reuse decisions (no wheel rebuilt)

| Sprint 10 asks for | Existing asset | Decision |
| --- | --- | --- |
| `components/settings/ChannelCard.vue` | `components/channel/ChannelCard.vue` | Thin wrapper: renders the Sprint 5b card and adds the Sprint 10 test-connection action. No duplicated markup or status logic. |
| `components/settings/ChannelBindDialog.vue` | `components/channel/CredentialFormDialog.vue` | Thin wrapper: adds platform choice and a test-before-bind step, delegates credential field rendering and validation to the existing dialog. |
| Channel bind / unbind / test | `api/channel.ts`, `stores/channel.ts`, `providers/*` | `api/settings.ts` targets the required `/api/v1/settings/channels*` paths, but every demo fallback reads and writes the same `demo.ts` channel registry, so both pages always show identical data. |
| Password change | `api/auth.ts#changePassword` | `settings.changePassword` demo fallback delegates to it. One credential store, no divergence. |
| Profile read / write | `api/auth.ts#getMe` / `#updateMe` | `settings.getProfile` / `updateProfile` demo fallbacks delegate to them, so the header avatar and nickname update immediately. |
| Sound + desktop notification switches | `stores/notification.ts` preferences | The preferences tab reads and writes `sound` / `browserPush` through the Sprint 9 store instead of keeping a second copy, and links to the full notification preferences page. |
| Language switch | `i18n` store `setLocale` | The preferences tab calls it directly; the saved value is mirrored into system preferences for the backend contract. |
| Avatar rendering | `components/KsAvatar.vue` | Reused for the current-avatar preview and its initial fallback. |
| Credential field definitions | `providers/*#getRequiredCredentials` | The bind dialog renders exactly those fields per platform. |

## 3. Conflicts found and how they were resolved

1. Two profile pages and two security pages would coexist
   (`/settings/profile`, `/settings/security` from Sprint 3 versus the new
   `/dashboard/settings` tabs). Sprint 3 is accepted and its routes are covered by
   `profileview.test.ts`, `securityview.test.ts` and `router.test.ts`, so the old
   routes were left untouched and still resolve. The new hub is the entry point that
   the user menu and the home grid now advertise. Recommended follow-up: deprecate
   the two Sprint 3 pages with redirects once the hub is signed off.
2. The task asks for a theme selector with a dark option, but `DESIGN_SYSTEM.md`
   defines no dark palette and the hard constraint forbids colours that the design
   system does not define. The selector therefore ships `light` and `system` enabled
   and renders `dark` disabled with an explanatory hint. The `ThemeMode` type and the
   `data-theme` hook already accept `dark`, so enabling it later is a token change
   only, not a refactor.
3. The task lists cropperjs for avatar cropping. Adding it means a new runtime
   dependency for one optional feature, so cropping and the 2MB compression required
   by item 15 are done with the native canvas API in `AvatarUploader.vue` instead.
   jsdom has no 2D context, so the component degrades to an object-URL preview when
   `getContext` returns null, which keeps the tests honest.
4. Two-factor authentication and the login-device list have no backend contract.
   They are implemented against `/api/v1/settings/security` with a localStorage demo
   fallback, and the QR panel renders a generated placeholder matrix with a visible
   waiting-for-backend-secret notice rather than pretending to be a real otpauth code.

## 4. New code added by this sprint

- `src/types/index.ts`: `SettingsProfile`, `SecuritySettings`, `LoginDevice`,
  `SystemPreferences`, `ThemeMode`, `ChannelAccount`, `ChannelTestResult`,
  `PasswordChangeRequest`, `BindChannelRequest`.
- `src/lib/settingsValidation.ts`: pure validators for name, email, phone,
  password strength, password match, avatar file and channel credentials.
- `src/lib/theme.ts`: `resolveTheme`, `applyTheme`, `readStoredTheme`.
- `src/api/settings.ts`: the 12 required endpoints, each with demo fallback.
- `src/api/demo.ts`: demo records for settings profile, security, preferences and
  channel accounts, all layered on the existing channel registry.
- `src/stores/settings.ts`: state, the 12 required actions and the three getters.
- `src/composables/`: `useSettings`, `useProfile`, `useSecurity`,
  `useChannelBinding`, each with a single responsibility over the store.
- `src/views/dashboard/settings/`: `index.vue` tab shell plus `ProfileTab.vue`,
  `SecurityTab.vue`, `PreferencesTab.vue`, `ChannelsTab.vue`.
- `src/components/settings/`: `AvatarUploader.vue`, `PasswordForm.vue`,
  `ChannelCard.vue`, `ChannelBindDialog.vue`.
- Routes `/dashboard/settings`, `/security`, `/preferences`, `/channels` (protected).
- Nav entries: user menu dropdown and the home grid.
- i18n: `settings.*`, `security.*`, `preferences.*`, `avatar.*`, `theme.*` keys for
  en / zh / fr.

## 5. Delivery evidence

All commands were run from `web/` on Windows with the bundled Node runtime.

### Test run

```
pnpm run test        # vitest run --coverage
Test Files  85 passed (85)
     Tests  872 passed (872)
  Duration  100.66s
```

New test files added by this sprint (161 tests):

| File | Tests | Covers |
| --- | --- | --- |
| `src/__tests__/settingsvalidation.test.ts` | 30 | name / email / phone / bio / password / credential rules |
| `src/__tests__/settingslibs.test.ts` | 34 | `lib/theme.ts`, `lib/qrPlaceholder.ts`, `lib/avatar.ts` |
| `src/__tests__/settingsstore.test.ts` | 34 | `stores/settings.ts` state, actions, getters, i18n error keys |
| `src/__tests__/settingsapi.test.ts` | 26 | all 13 endpoints: live backend, timeout retry, demo fallback |
| `src/__tests__/settingscomposables.test.ts` | 37 | `useSettings`, `useProfile`, `useSecurity`, `useChannelBinding` |

The composable suite keeps the real pinia store and mocks only `api/settings`
and `stores/auth`, so the composables run against the same state machine the
views use.

### Coverage

Global (provider v8, thresholds are global only: lines/statements 80,
functions/branches 70):

```
All files | % Stmts 98.43 | % Branch 92.3 | % Funcs 92.74 | % Lines 98.43
```

Sprint 10 files:

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered |
| --- | --- | --- | --- | --- | --- |
| `src/api/settings.ts` | 97.04 | 75.75 | 100 | 97.04 | 93-97, 231 |
| `src/stores/settings.ts` | 99.25 | 86.58 | 100 | 99.25 | 278-279 |
| `src/composables/useSettings.ts` | 100 | 100 | 100 | 100 | - |
| `src/composables/useProfile.ts` | 98.37 | 94.11 | 100 | 98.37 | 38, 46 |
| `src/composables/useSecurity.ts` | 100 | 96.42 | 100 | 100 | 75 |
| `src/composables/useChannelBinding.ts` | 100 | 100 | 100 | 100 | - |
| `src/lib/settingsValidation.ts` | 100 | 100 | 100 | 100 | - |
| `src/lib/theme.ts` | 100 | 100 | 100 | 100 | - |
| `src/lib/qrPlaceholder.ts` | 100 | 100 | 100 | 100 | - |
| `src/lib/avatar.ts` | 81.11 | 81.57 | 81.81 | 81.11 | 66-73, 86-94 |
| `src/components/settings/` (4 files) | 100 | 100 | 100 | 100 | - |
| `src/views/dashboard/settings/` (5 files) | 100 | 100 | 100 | 100 | - |
| `src/components/SettingsNav.vue` | 100 | 88.88 | 100 | 100 | 26 |

`lib/avatar.ts` stays at 81% because lines 66-73 and 86-94 are the canvas crop
and compress paths. jsdom has no 2D context, so `getContext` returns null and
the module takes its object-URL fallback, exactly as conflict 3 above describes.
The remaining uncovered lines elsewhere are the `finally` branches of a
preferences save that also updates the profile, and a defensive re-read.

### Typecheck and build

```
pnpm run typecheck   # vue-tsc --noEmit  -> exit 0, no diagnostics
pnpm run build       # vite build        -> exit 0
  dist/assets/index-Etit2q_N.js  1,281.77 kB | gzip: 427.55 kB
  PWA v0.20.5 generateSW, precache 6 entries (1618.63 KiB)
```

The over-500kB chunk warning is pre-existing (echarts plus the PWA precache) and
is not introduced by this sprint.

### Test hygiene notes

Two assertions were made deterministic while bringing the suite to green:

1. `settingsapi.test.ts` compared two consecutive `revokeLoginDevice` results with
   `toEqual`. The demo device list derives `lastActiveAt` from `Date.now()`, so a
   one-millisecond tick between the calls failed the run intermittently. The
   comparison now normalises that one volatile field and still asserts every
   stable field of the no-op revoke.
2. The stale channel probe after `unbindChannelAccount` asserts `NOT_FOUND`,
   because `demoUnbindChannel` delegates to `demoDisconnect`, which removes the
   record rather than marking it disconnected.

## 6. Manual acceptance path

1. Sign in with the demo account (`demo@kilisocial.app` / `Demo1234`).
2. Open the user menu and choose system settings, or use the home grid card.
3. Profile tab: pick an image, watch the cropped preview, save, confirm the header
   avatar changes.
4. Security tab: submit a weak password and read the inline reason, then a valid one.
5. Preferences tab: switch language, timezone and theme, toggle sound and desktop
   notifications, save, reload and confirm the values persisted.
6. Channels tab: bind a platform with credentials, run test connection, then unbind.
   Confirm `/dashboard/channels` shows the same state.
7. Resize below 768px and confirm the tab rail moves to the top and forms go single
   column.

