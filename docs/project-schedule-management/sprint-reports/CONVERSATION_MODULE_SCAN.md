# Sprint 6 Conversation Module Scan Report

Scope: unified inbox at `/dashboard/conversations` (list + filters, message thread,
send/retry, AI reply, quick replies, WebSocket live updates).

## Existing assets (reuse, do not rewrite)

- `src/lib/websocket.ts` — `ConversationSocket`, `backoffDelay()` (1s→30s cap),
  `defaultWsUrl()` (VITE_WS_URL override). Sprint 6 socket client reuses
  `backoffDelay` + `defaultWsUrl`; the legacy class stays untouched for `/chat`.
- `src/lib/relativeTime.ts` — localized relative time for list rows.
- `src/components/KsAvatar.vue` — initials avatar, reused by ConversationItem.
- `src/stores/channel.ts` + `src/providers/` — platform metadata/icons.
- `src/api/http.ts` — apiGet/apiPost/apiDelete envelope + session recovery.
- `src/api/demo.ts` — `isMissingBackend()` demo-fallback pattern.
- Sprint 5b Hotfix empty state (demo notice bar + dismiss → CTA empty state),
  same localStorage key `ks-chat-demo-hidden`.

## Existing conversation code (legacy, kept as-is)

- `src/views/ChatView.vue` + `components/ConversationList.vue` +
  `components/ChatWindow.vue` at route `/chat`, fed by
  `src/api/conversations.ts` (MOCK fallback, no pagination, no channels).
- No conversation/message/websocket Pinia stores existed.

## Conflicts and decisions

1. Two chat surfaces: legacy `/chat` remains for backward compatibility
   (verified Sprint 2c/5b logic untouched); the new inbox becomes the primary
   surface — the home "Conversations" card now links to
   `/dashboard/conversations`.
2. New components live under `src/components/conversation/` (spec naming);
   legacy `components/ConversationList.vue` keeps its name (different folder).
3. `MessageType`/`MessageStatus` unions are extended additively
   (`file`, `audio`, `failed`); legacy renderers ignore unknown variants.
4. `Conversation.platform` is optional so legacy MOCK data still type-checks;
   inbox rows hide the platform dot when absent.
5. WebSocket: new `useWebSocket()` composable owns a singleton client with
   heartbeat (30s ping / 10s pong timeout) and publishes typed events on a new
   `src/events/socket.ts` bus; stores subscribe to the bus (observer pattern).
6. Demo data: richer inbox dataset (platforms, archives, history for paging)
   added to `src/api/demo.ts`; never shown without the amber sample-data bar.