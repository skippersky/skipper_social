# API Contract (Sprint 3 target)

Web 客户端 (`web/`) 已按本契约实现调用与降级逻辑。后端接口将在 Sprint 3 提供；
接口上线前，前端自动降级为示例数据（degraded 模式），不影响离线验收。

## 通用约定

- Base path：`/api/v1`，同源访问。开发环境由 vite dev server 代理到 `127.0.0.1:18080`；
  生产环境由服务器 nginx 反向代理到应用容器（127.0.0.1:18080）。
- 响应信封与现有后端 `ApiResponse` 保持一致：

```json
{ "success": true, "code": "OK", "message": "success", "data": [], "timestamp": "2026-09-01T10:00:00Z" }
```

- 失败时 `success=false`，`code` 为业务错误码（如 `NOT_FOUND`、`UNAUTHORIZED`）。
- 时间字段统一为 Unix 毫秒时间戳（number）。
- 客户端行为：请求超时 10s；GET 遇网络错误/超时/5xx 自动重试 1 次；POST 不重试。

## Endpoints

### GET /api/v1/conversations

返回 `data: Conversation[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 会话 ID |
| contactName | string | 联系人名称 |
| contactPhone | string | 电话号码（展示格式） |
| lastMessage | string | 最后一条消息预览 |
| lastMessageTime | number | 毫秒时间戳 |
| unreadCount | number | 未读数 |
| avatarUrl | string? | 可选，头像 URL，缺省用首字母头像 |

### GET /api/v1/conversations/{id}/messages

返回 `data: Message[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 消息 ID |
| conversationId | string | 所属会话 ID |
| content | string | 文本内容 / 图片文件名 / 地点名称 |
| type | 'text' \| 'image' \| 'location' | 消息类型 |
| sender | 'user' \| 'contact' | 发送方 |
| timestamp | number | 毫秒时间戳 |
| status | 'sending' \| 'sent' \| 'read' | 消息状态 |
| mediaUrl | string? | image：图片 URL；location：地图链接 |

### POST /api/v1/conversations/{id}/messages

请求体：`{ "content": string, "type": "text" | "image" | "location" }`
返回 `data: Message`（新建消息，status 建议 `sending` 或 `sent`）。
UI 的发送输入框在该接口联调通过前保持禁用。

## WebSocket /ws

帧格式：`{ "event": "<name>", "data": <payload> }`

| event | data 载荷 | 前端行为 |
| --- | --- | --- |
| conversation_update | `{ conversationId, lastMessage, lastMessageTime, unreadCount? }` | 更新会话列表预览/时间/未读数 |
| new_message | `Message` | 追加到当前打开会话的消息区 |
| message_status_update | `{ messageId, status }` | 更新对应消息的状态图标 |

客户端断线后按指数退避重连（1s 起，封顶 30s），静默重试不弹错。

## 错误码 → 前端提示映射

| code / 状态 | 前端提示（i18n key） |
| --- | --- |
| TIMEOUT | api.timeout |
| UNAUTHORIZED / HTTP_401 | api.401 |
| FORBIDDEN / HTTP_403 | api.403 |
| NOT_FOUND / HTTP_404 | api.404 |
| HTTP_5xx | api.500 |
| 其他（网络中断等） | api.network |

列表/消息加载失败时展示示例数据并允许手动重试；发送失败将错误直接抛给调用方。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| VITE_API_BASE | 空（同源） | API 前缀，仅跨域部署时需要配置 |
| VITE_WS_URL | 同源 `/ws`（http→ws / https→wss） | WebSocket 地址，仅跨域部署时需要配置 |
## Auth endpoints (Sprint 3 user module)

### Session model

- JWT is carried in an httpOnly cookie set by the backend (`Set-Cookie`); the client
  never touches tokens directly. All requests use `credentials: include`.
- `AuthResponse` DTO: `{ user, accessToken?, refreshToken?, demo? }` — tokens are
  optional because the cookie flow may omit them.
- Any 401 outside `/api/v1/auth/*` triggers one automatic `POST /api/v1/auth/refresh`
  probe plus a single retry of the original request; if that still fails the client
  clears the session and navigates to `/login`.
- Demo mode: when auth endpoints answer 404 or the network is unreachable, the client
  degrades to an on-device demo directory (localStorage, flagged with a Demo badge)
  and switches to the real backend automatically once it ships. 401/400/5xx answers
  never fall back to demo.

### Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | /api/v1/auth/login | `{ email, password }` | AuthResponse; 401 `UNAUTHORIZED` on bad credentials, `NOT_ACTIVATED` when disabled |
| POST | /api/v1/auth/register | `{ email, password, nickname, phone? }` | AuthResponse; `EMAIL_EXISTS` on duplicates |
| POST | /api/v1/auth/oauth/google | `{ provider: 'google', token }` | AuthResponse |
| POST | /api/v1/auth/refresh | `{}` | 200 rotates the session cookie |
| POST | /api/v1/auth/logout | `{}` | clears the cookie |
| GET | /api/v1/auth/me | - | User |
| PUT | /api/v1/auth/me | UpdateMeRequest | User |
| POST | /api/v1/auth/forgot-password | `{ email }` | always succeeds (no email enumeration) |
| POST | /api/v1/auth/change-password | `{ oldPassword, newPassword }` | `WRONG_PASSWORD` when the current password is wrong |

Password policy (client + server): minimum 8 characters with at least one upper-case
letter, one lower-case letter and one digit. Nickname: 2-20 characters.

### User DTO

| Field | Type | Notes |
| --- | --- | --- |
| id | string | user id |
| email | string | login identifier |
| phone | string? | optional |
| nickname | string | 2-20 chars |
| avatarUrl | string? | URL for now; file upload later |
| company | string? | optional |
| timezone | string | IANA name, e.g. Africa/Dar_es_Salaam |
| language | string | en / sw / zh / fr |
| subscriptionTier | 'free' \| 'basic' \| 'pro' | entitlements land in Sprint 5 |
| createdAt | number | epoch ms |

### Route guard

Public: `/`, `/login`, `/register`, `/forgot-password`. Everything else requires a
session; anonymous visits redirect to `/login?redirect=<original path>`. Authenticated
visits to `/login` or `/register` redirect to `/chat`.