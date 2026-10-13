# 06 · 后端 API 缺口分析（前端期望 vs 后端现状）

> 本文是**后端开发的待办清单来源**。数据由脚本从 `web/src/api/*.ts`（排除 `demo*.ts` 与 `http.ts`）静态提取，
> 提取时间 2026-10-13，基线提交 `a53e62a`。路径中的 `{}` 表示路径参数。

---

## 1. 一句话结论

**前端调用 159 个业务接口，后端真实实现了 1 个**（`POST /api/v1/ai/copywriting`）。
另有 3 个后端接口前端不调用（`/api/v1/hello`、`GET|POST /api/v1/wa/webhook`）。
其余 158 个接口在前端全部走示例数据降级链路。

---

## 2. 后端已存在的接口

| 方法 | 路径 | 实现位置 | 前端是否调用 |
| --- | --- | --- | --- |
| GET | `/api/v1/hello` | `app/.../HelloController.java` | 否（仅冒烟测试） |
| POST | `/api/v1/ai/copywriting` | `copywriting-service/.../CopywritingController.java` | ✅ `api/copywriting.ts` |
| GET | `/api/v1/wa/webhook` | `wa-webhook-controller/.../WaWebhookController.java` | 否（Meta 验证握手） |
| POST | `/api/v1/wa/webhook` | 同上 | 否（Meta 推送入口） |
| GET | `/actuator/health`、`/actuator/info` | Spring Actuator | 是（健康检查） |
| GET | `/swagger-ui/**`、`/v3/api-docs` | springdoc | 否 |

---

## 3. 实现约定（所有新接口必须遵守）

1. **响应信封**：一律返回 `common` 模块的 `ApiResponse<T>`：

```json
{ "success": true, "code": "OK", "message": "success", "data": { }, "timestamp": "2026-10-13T10:00:00Z" }
```

   失败时 `success=false`，`code` 为业务错误码。前端 `http.ts` 的 `unwrap()` 只认这个结构。

2. **错误码**：前端 `apiErrorI18nKey()` 会把这些码映射成用户提示，请沿用：
   `UNAUTHORIZED` / `HTTP_401`、`FORBIDDEN` / `HTTP_403`、`NOT_FOUND` / `HTTP_404`、`HTTP_5xx`、`TIMEOUT`。
   其余业务码自定义（如 `VALIDATION_FAILED`、`QUOTA_EXCEEDED`），前端会落到通用网络提示。

3. **多租户隔离**：每个业务接口都要读 `X-Organization-Id` 请求头（常量见 `http.ts` 的 `ORG_HEADER`），
   在查询条件里带上 `organization_id`。前端在组织 bootstrap 和每次切换租户时都会更新这个头。

4. **认证**：httpOnly Cookie，前端 `fetch` 带 `credentials: 'include'`，**不返回 token 给前端**。
   必须实现 `POST /api/v1/auth/refresh`：401 时前端会自动打这个接口一次，成功则重放原请求，失败则登出。
   并发 401 共享同一个刷新请求（`http.ts` 已做去重）。

5. **时间字段**：统一 Unix 毫秒时间戳（number），见 `API_CONTRACT.md`。

6. **分页**：前端约定 `?page=&limit=`（或各模块自己的 `toQuery()` 参数），返回结构见对应 `demo*.ts` 里的形状——
   **`demo*.ts` 就是事实上的响应契约**，实现后端时请逐个函数对照其返回值类型。

7. **超时与重试**：前端超时 10s；GET 遇网络错误/超时/5xx 自动重试 1 次；POST/PUT/DELETE **不重试**。
   所以写接口要保证幂等性由前端负责的部分尽量少，非幂等 POST 别指望重试。

8. **数据库规范**：见 `DEV_GUIDE.md` 第 3 节，参照 `V1__create_prompt_config.sql`。

---

## 4. 完整接口清单（按前端模块）

图例：🔴 未实现 ｜ ✅ 已实现

### 4.1 `auth.ts` — 认证（8 个）🔴 **最高优先级**

前端地基。`http.ts` 的 401 刷新链路、`stores/auth.ts`、路由守卫全部依赖它。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 邮箱 + 密码，Set-Cookie |
| POST | `/api/v1/auth/register` | 注册后自动登录 |
| POST | `/api/v1/auth/logout` | 清 Cookie |
| GET | `/api/v1/auth/me` | 应用启动时恢复登录态 |
| PUT | `/api/v1/auth/me` | 更新昵称/公司/时区/语言 |
| POST | `/api/v1/auth/forgot-password` | 发送重置邮件 |
| POST | `/api/v1/auth/change-password` | 改密后清除其他设备登录态 |
| POST | `/api/v1/auth/oauth/google` | Google OAuth |
| POST | `/api/v1/auth/refresh` | **`http.ts` 直接调用，不在 `auth.ts` 里**，必须实现 |

### 4.2 `conversation.ts` + `conversations.ts` + `message.ts` — 收件箱（13 个调用点 / 10 个不同路径）🔴 **高优先级**

> 注意：`conversation.ts`（Sprint 6）与 `conversations.ts`（Sprint 2c）是**两个并存的历史版本**，路径重叠。
> 实现后端时按并集覆盖即可，但建议同时清理前端重复模块（见 `10_OPEN_ISSUES_BACKLOG.md`）。

| 方法 | 路径 | 来源 |
| --- | --- | --- |
| GET | `/api/v1/conversations` | 两者都有（支持筛选 + 分页 query） |
| GET | `/api/v1/conversations/{id}` | conversation.ts |
| POST | `/api/v1/conversations/{id}/read` | conversation.ts |
| POST | `/api/v1/conversations/{id}/archive` | conversation.ts |
| POST | `/api/v1/conversations/{id}/unarchive` | conversation.ts |
| POST | `/api/v1/conversations/{id}/assign` | conversation.ts |
| GET | `/api/v1/conversations/{id}/messages` | conversations.ts / message.ts（分页） |
| POST | `/api/v1/conversations/{id}/messages` | conversations.ts / message.ts（发送） |
| DELETE | `/api/v1/messages/{messageId}` | message.ts（撤回） |
| POST | `/api/v1/upload` | message.ts（**multipart 文件上传**，非 JSON） |

### 4.3 `customer.ts` + `tag.ts` — 客户目录（13 个）🔴

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/customers`（搜索 + 筛选 + 分页） |
| POST | `/api/v1/customers` |
| GET | `/api/v1/customers/{id}` |
| PUT | `/api/v1/customers/{id}` |
| DELETE | `/api/v1/customers/{id}` |
| GET | `/api/v1/customers/{id}/stats` |
| GET | `/api/v1/customers/{id}/conversations` |
| GET | `/api/v1/tags` |
| POST | `/api/v1/tags` |
| PUT | `/api/v1/tags/{id}` |
| DELETE | `/api/v1/tags/{id}` |
| POST | `/api/v1/customers/{customerId}/tags/{tagId}` |
| DELETE | `/api/v1/customers/{customerId}/tags/{tagId}` |

### 4.4 `channel.ts` + `webhooks.ts` — 渠道连接（7 个）🔴

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/channels` | 已连接渠道列表 |
| GET | `/api/v1/channels/{id}` | 详情 |
| POST | `/api/v1/channels/{platform}/connect` | platform ∈ whatsapp/facebook/instagram/tiktok |
| POST | `/api/v1/channels/{id}/refresh` | 刷新 token |
| DELETE | `/api/v1/channels/{id}` | 解绑 |
| POST | `/api/v1/webhooks/{platform}` | 注册 webhook |
| GET | `/api/v1/webhooks/{platform}/status` | webhook 状态 |

> 前端另有 `src/providers/` 策略层（WhatsApp/Facebook/Instagram/TikTok Provider + Factory），
> 支持 OAuth 与「手动填凭证」双模式（Sprint 5b）。手动模式的凭证字段定义见 `providers/types.ts` 的 `getRequiredCredentials()`。

### 4.5 `analytics.ts` — 数据分析（7 个）🔴

全部为 GET，全部带 `range` + 其他筛选 query：

`/api/v1/analytics/overview`、`/conversations/trend`、`/messages/trend`、`/channels/distribution`、`/response-time`、`/customers/top`、`/agents/performance`

### 4.6 `ai.ts` + `copywriting.ts` — AI 能力（4 个）🟡 部分已有基础

| 方法 | 路径 | 状态 |
| --- | --- | --- |
| POST | `/api/v1/ai/copywriting` | ✅ **已实现**（`copywriting-service`） |
| POST | `/api/v1/ai/reply` | 🔴 收件箱「AI 辅助回复」用；可直接复用 `CopywritingService`，新增 `content-type` |
| GET | `/api/v1/ai/templates` | 🔴 Prompt 模板列表，数据源就是 `prompt_config` 表 |
| POST | `/api/v1/ai/templates/{templateId}/apply` | 🔴 应用模板生成内容 |

### 4.7 `plan.ts` + `subscription.ts` + `usage.ts` — 订阅计费（9 个）🔴 ⚠️ 需产品决策

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/plans` |
| GET | `/api/v1/plans/{id}` |
| POST | `/api/v1/subscriptions`（返回 Stripe Checkout URL） |
| GET | `/api/v1/subscriptions/me` |
| PUT | `/api/v1/subscriptions/{id}`（升级/降级） |
| DELETE | `/api/v1/subscriptions/{id}`（取消） |
| POST | `/api/v1/subscriptions/{id}/resume`（恢复） |
| GET | `/api/v1/usage` |
| GET | `/api/v1/usage/history?period=` |

> ⚠️ `PROJECT_BOUNDARIES.md` 把 Stripe 列为 OUT OF SCOPE，IN SCOPE 是 M-Pesa / Paystack。**动手前先确认走哪条支付渠道。**

### 4.8 `notification.ts` — 通知中心（9 个）🔴

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/notifications`（分页，`PAGE_LIMIT = 20`） |
| GET | `/api/v1/notifications/unread-count` |
| GET | `/api/v1/notifications/{id}` |
| PUT | `/api/v1/notifications/{id}/read` |
| PUT | `/api/v1/notifications/read-all` |
| DELETE | `/api/v1/notifications/read`（清理已读） |
| DELETE | `/api/v1/notifications/{id}` |
| GET | `/api/v1/notifications/preferences` |
| PUT | `/api/v1/notifications/preferences` |

> 另有 **WebSocket `/ws`**：nginx 已反代到 18080，前端 `lib/websocket.ts` + `websocket/notificationWs.ts` 已就绪，
> 但后端**没有 `spring-boot-starter-websocket` 依赖也没有端点** → 目前必然连接失败。
> 前端事件名：`conversation_update`、`new_message`、`message_status_update`、通知推送。

### 4.9 `marketing.ts` — AI 智能营销（22 个）🔴

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/marketing/overview` |
| GET | `/api/v1/marketing/history` |
| GET | `/api/v1/marketing/channels` |
| POST | `/api/v1/marketing/content/generate` |
| POST | `/api/v1/marketing/content/preview` |
| GET / POST | `/api/v1/marketing/templates` |
| PUT / DELETE | `/api/v1/marketing/templates/{id}` |
| POST | `/api/v1/marketing/templates/{id}/use` |
| POST | `/api/v1/marketing/recipients/query` |
| POST | `/api/v1/marketing/recipients/validate` |
| GET / POST | `/api/v1/marketing/campaigns` |
| GET | `/api/v1/marketing/campaigns/{id}` |
| POST | `/api/v1/marketing/campaigns/{id}/start` |
| POST | `/api/v1/marketing/campaigns/{id}/pause` |
| POST | `/api/v1/marketing/campaigns/{id}/cancel` |
| POST | `/api/v1/marketing/campaigns/{id}/retry` |
| GET | `/api/v1/marketing/campaigns/{id}/stats` |
| GET / POST | `/api/v1/marketing/campaigns/{id}/records` |

> 群发必须限流（前端 `lib/sendQueue.ts` + `composables/useBatchSend.ts` 已做客户端节流），
> 后端仍需自己控速并落审核状态——`PROJECT_BOUNDARIES.md` 明确禁止「未经审核发送营销消息」。

### 4.10 `workflow.ts` — 自动化工作流（25 个）🔴 最复杂

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/workflow/triggers`（触发器目录） |
| GET | `/api/v1/workflow/conditions`（条件目录） |
| GET | `/api/v1/workflow/actions`（动作目录） |
| GET | `/api/v1/workflow/nodes`（节点目录） |
| GET | `/api/v1/workflows/overview` |
| GET / POST | `/api/v1/workflows` |
| POST | `/api/v1/workflows/validate` |
| GET / PUT / DELETE | `/api/v1/workflows/{id}` |
| POST | `/api/v1/workflows/{id}/enable` |
| POST | `/api/v1/workflows/{id}/disable` |
| POST | `/api/v1/workflows/{id}/duplicate` |
| POST | `/api/v1/workflows/{id}/layout`（保存画布布局） |
| GET | `/api/v1/workflows/{id}/summary` |
| GET / POST | `/api/v1/workflows/{id}/runs` |
| GET | `/api/v1/workflow-runs` |
| GET | `/api/v1/workflow-runs/stats` |
| GET | `/api/v1/workflow-runs/{runId}` |
| POST | `/api/v1/workflow-runs/{runId}/stop` |
| GET | `/api/v1/workflow-templates` |
| POST | `/api/v1/workflow-templates/{id}/instantiate` |
| POST | `/api/v1/workflow-templates/{id}/use` |

> 画布用 @vue-flow，节点/边的数据结构见 `types/workflow.ts` 与 `lib/workflowGraph.ts`、`lib/workflowNodes.ts`。
> 后端需要一个执行引擎（触发 → 条件判断 → 动作执行 → 运行记录），这是全项目最重的一块。

### 4.11 组织与权限：`organization.ts`(11) + `member.ts`(10) + `role.ts`(5) + `permission.ts`(4) = 30 个 🔴

组织：

| 方法 | 路径 |
| --- | --- |
| GET / POST | `/api/v1/organizations` |
| GET | `/api/v1/organizations/current` |
| GET / PUT / DELETE | `/api/v1/organizations/{id}` |
| GET | `/api/v1/organizations/{id}/overview` |
| GET | `/api/v1/organizations/{id}/activity` |
| GET / PUT | `/api/v1/organizations/{id}/settings` |
| POST | `/api/v1/organizations/{id}/switch` |
| POST | `/api/v1/organizations/{id}/transfer`（转让所有权） |

成员与邀请：

| 方法 | 路径 |
| --- | --- |
| GET | `/api/v1/organizations/{orgId}/members` |
| POST | `/api/v1/organizations/{orgId}/members/invite` |
| DELETE | `/api/v1/organizations/{orgId}/members/{memberId}` |
| PUT | `/api/v1/organizations/{orgId}/members/{memberId}/role` |
| PUT | `/api/v1/organizations/{orgId}/members/{memberId}/status` |
| GET | `/api/v1/organizations/{orgId}/invitations` |
| DELETE | `/api/v1/organizations/{orgId}/invitations/{invitationId}` |
| POST | `/api/v1/organizations/{orgId}/invitations/{invitationId}/resend` |
| GET | `/api/v1/invitations/{token}`（**公开**，邮件链接直接打开） |
| POST | `/api/v1/invitations/{token}/accept`（**公开**） |

角色与权限：

| 方法 | 路径 |
| --- | --- |
| GET / POST | `/api/v1/organizations/{orgId}/roles` |
| GET / PUT / DELETE | `/api/v1/organizations/{orgId}/roles/{roleId}` |
| GET | `/api/v1/permissions`（权限目录） |
| POST | `/api/v1/permissions/check` |
| POST | `/api/v1/permissions/check-batch` |
| GET | `/api/v1/users/me/permissions` |

> 权限字符串格式为 `resource:action`（如 `organization:view_members`、`organization:manage_roles`、
> `organization:update_settings`），前端在路由 `meta.permission` 与 `v-permission` 指令里直接使用，
> **后端必须返回完全一致的字符串**，否则路由守卫会把用户挡在 403。完整清单见 `lib/permissions.ts`。

### 4.12 `settings.ts` — 系统设置与账号（12 个）🔴

| 方法 | 路径 |
| --- | --- |
| GET / PUT | `/api/v1/settings/profile` |
| GET / PUT | `/api/v1/settings/security` |
| PUT | `/api/v1/settings/security/password` |
| DELETE | `/api/v1/settings/security/devices/{deviceId}` |
| GET / PUT | `/api/v1/settings/preferences` |
| GET | `/api/v1/settings/channels` |
| POST | `/api/v1/settings/channels/bind` |
| POST | `/api/v1/settings/channels/{id}/test` |
| DELETE | `/api/v1/settings/channels/{id}` |

> 与 `auth.ts` 的 `PUT /api/v1/auth/me`、`channel.ts` 的渠道接口存在职责重叠，
> 是不同 Sprint 分别做的。实现后端时建议统一到一个领域服务，避免两套逻辑。

---

## 5. 建议的实现路线图

按「解锁前端最多功能 / 依赖最少」排序：

| 阶段 | 内容 | 接口数 | 解锁的前端能力 |
| --- | --- | --- | --- |
| **P0** | Flyway + MySQL 驱动 + JPA 基础设施；`Flyway` 让 V1 生效 | 0 | 后续一切的地基 |
| **P1** | `auth.ts` 全套 + `/auth/refresh`（含 JWT/httpOnly Cookie、密码哈希、Google OAuth） | 9 | 登录/注册/守卫/401 恢复全部转真 |
| **P2** | 组织与权限（organization + member + role + permission） | 30 | 多租户与 RBAC 转真，`X-Organization-Id` 才有意义 |
| **P3** | 收件箱（conversation + message + upload）+ **WebSocket `/ws`** | 10 + WS | 核心业务闭环，用户能真正收发消息 |
| **P4** | 客户目录（customer + tag） | 13 | CRM 能力 |
| **P5** | 渠道连接（channel + webhooks）+ 真实 Meta/TikTok 对接 | 7 | 渠道绑定从演示转真实 |
| **P6** | AI 扩展（`/ai/reply`、`/ai/templates`）+ Redis 语义缓存 | 3 | 复用已有 `CopywritingService`，成本低 |
| **P7** | 通知中心 + WebSocket 推送 | 9 | 实时通知 |
| **P8** | 数据分析 | 7 | 看板转真 |
| **P9** | 营销 | 22 | 需先有渠道与审核流 |
| **P10** | 工作流引擎 | 25 | 最重，建议最后 |
| **待定** | 订阅计费（先决定 Stripe 还是 M-Pesa/Paystack） | 9 | 商业化闭环 |

---

## 6. 数据模型建议（最小表集）

按 `DEV_GUIDE.md` 规范，每张表都要有 `id BIGINT UNSIGNED AUTO_INCREMENT`、`created_at`、`updated_at`、`deleted_at`，并带 `organization_id` 做租户隔离（除 `users`、`plans`、`prompt_config` 等全局表）。

| 表 | 支撑的接口模块 | 关键索引 |
| --- | --- | --- |
| `prompt_config` | ai | ✅ 已有迁移 `V1__create_prompt_config.sql`，`uk_name_version` |
| `users` | auth, settings | `uk_email` |
| `user_credentials` | auth | 密码哈希独立成表，避免与 profile 混放 |
| `oauth_identities` | auth (Google) | `uk_provider_subject` |
| `organizations` | organization | — |
| `org_members` | member | `uk_org_user` |
| `org_roles` / `role_permissions` | role, permission | — |
| `invitations` | member | `uk_token`，需过期时间 |
| `channels` | channel, settings | `uk_org_platform_account` |
| `channel_credentials` | channel | **加密存储**，禁止明文（红线） |
| `conversations` | conversation | `idx_org_updated`、`idx_contact` |
| `messages` | message | `idx_conversation_created` |
| `customers` | customer | `idx_org_phone` |
| `tags` / `customer_tags` | tag | `uk_org_name`、`uk_customer_tag` |
| `notifications` / `notification_preferences` | notification | `idx_user_read` |
| `plans` / `subscriptions` / `usage_records` | plan, subscription, usage | — |
| `campaigns` / `campaign_records` / `marketing_templates` | marketing | — |
| `workflows` / `workflow_runs` / `workflow_run_steps` / `workflow_templates` | workflow | — |
| `analytics_daily` | analytics | 预聚合表，避免每次实时算 |

迁移文件命名：`V2__create_users.sql`、`V3__create_organizations.sql` …（**`V1` 已存在，不要重复创建或修改**）。

---

## 7. 怎么知道响应体该长什么样

`web/src/api/demo.ts`、`demoMarketing.ts`、`demoOrganization.ts`、`demoWorkflow.ts` 里的每个 `demoXxx()` 函数
返回值，就是该接口**事实上的响应契约**（共约 133KB，类型定义在 `web/src/types/`）。
实现后端时的正确姿势：

1. 在 `web/src/api/<module>.ts` 找到目标函数，看它的返回类型；
2. 到 `web/src/types/` 找到该类型的字段定义；
3. 到对应 `demo*.ts` 找到 `demoXxx()`，看真实数据形状（含分页包装、时间戳格式）；
4. 按这个形状实现后端 DTO，用 `ApiResponse<T>` 包起来。

**不要凭空设计字段名**，否则前端解析会静默失败并退回示例数据，问题很难发现。
