# Channel Module Scan Report (Sprint 5b)

Scanned `web/src/api/`, `web/src/stores/`, `web/src/views/`, `web/src/components/`
for existing channel / OAuth / webhook logic before implementing the Sprint 5b
channel connection module.

## Existing functionality inventory

| Area | Files | Relevance |
| --- | --- | --- |
| Conversations API | `api/conversations.ts` | Sprint 2c WhatsApp conversation list/messages (mock-first). Not channel connection. |
| Chat UI | `views/ChatView.vue`, `components/ConversationList.vue`, `components/ChatWindow.vue` | Conversation management UI. Consumes conversations only. |
| WebSocket client | `lib/websocket.ts` | Realtime conversation updates. Not channel related. |
| Subscription quotas | `api/demo.ts` DEMO_PLANS `quotas.channels`, `stores/subscription.ts` | Channel connection limit source. Reused as-is. |
| Pricing copy | `views/landing/pricing.vue`, `components/subscription/PlanCard.vue` | Mentions "channels" quota in copy only. |

## Duplicates vs new requirements

None. No channel API, store, provider, route or view existed before this sprint.
Nothing had to be replaced or merged.

## Conflicts

None. The only naming touchpoint is the subscription quota key
`quotas.channels`, which the new `availableSlots` getter reads instead of
duplicating.

## Decisions

- Keep all conversation/chat code untouched (Sprint 6 consumes channel tokens).
- Reuse the subscription store (`currentPlan.quotas.channels`, -1 = unlimited)
  for the connection limit; no new quota source.
- Follow the established demo-fallback policy (network error / timeout / 404
  only) used by auth and billing, so the OAuth loop works offline via the
  in-app callback `/auth/callback/{platform}`.
- Token storage format for Sprint 6: `Channel` records carry `platform`,
  `accountName`, `status`, `tokenExpiresAt` (see API_CONTRACT.md channel DTO).

## Architecture as implemented

- Strategy: one `ChannelProvider` implementation per platform behind
  `ChannelProviderFactory` (supports `register` for custom providers).
- Observer: typed event bus `src/events/channel.ts` (mitt-compatible
  on/off/emit surface, zero new runtime dependencies); store actions emit,
  the channels page subscribes.
- Layering: UI -> store -> provider/api; providers never import Vue.