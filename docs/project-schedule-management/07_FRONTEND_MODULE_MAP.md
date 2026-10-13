# 07 · 前端模块地图（改代码前先看这里）

> 基线：`web/` 共 52 个 view、71 个组件、31 个 composable、16 个 store、27 个 api 文件、51 个测试文件。
> 本文回答一个问题：**「我要改某个功能，该动哪些文件」**。

---

## 1. 路由全表

公开路由（`PUBLIC_PATHS`，定义在 `web/src/router/index.ts` 第 58 行起）：
`/`、`/home`、`/login`、`/register`、`/forgot-password`、`/pricing`、`/privacy`、`/terms`、
`/checkout/success`、`/checkout/cancel`、`/auth/callback/*`。
另外 `/invitation/*` 前缀由 `hasPublicPrefix()` 放行（邮件邀请链接常常在未登录状态打开）。
其余全部需要登录。

| 路径 | 视图 | 说明 |
| --- | --- | --- |
| `/` | `views/landing/index.vue` | 落地页（`LandingLayout`） |
| `/pricing` | `views/landing/pricing.vue` | 定价对比 |
| `/privacy`、`/terms` | `views/landing/privacy.vue`、`terms.vue` | 法务占位文本 |
| `/home` | `views/HomeView.vue` | 工作台首页（各模块入口） |
| `/login`、`/register`、`/forgot-password` | `views/LoginView.vue` 等 | 认证 |
| `/settings/profile`、`/settings/security` | `views/SettingsProfileView.vue`、`SettingsSecurityView.vue` | Sprint 3 的老设置页 |
| `/editor`、`/drafts` | `views/EditorView.vue`、`DraftsView.vue` | Sprint 2b 编辑器与离线草稿（localforage） |
| `/chat` | `views/ChatView.vue` | Sprint 2b/2c 会话页（登录后的默认落点） |
| `/dashboard/conversations` | `views/dashboard/conversations/index.vue` | Sprint 6 统一收件箱 |
| `/dashboard/customers`、`/customers/:id` | `views/dashboard/customers/index.vue`、`detail.vue` | Sprint 7 客户目录 |
| `/dashboard/analytics` | `views/dashboard/analytics/index.vue` | Sprint 8 数据分析 |
| `/dashboard/notifications`、`/notifications/preferences` | `views/dashboard/notifications/*.vue` | Sprint 9 通知中心 |
| `/dashboard/channels`、`/channels/connect/:platform` | `views/dashboard/channels/*.vue` | Sprint 5b 渠道连接 |
| `/dashboard/marketing`（+ `/create`、`/campaigns/:id`、`/templates`、`/history`） | `views/dashboard/marketing/*.vue` | Sprint 11 AI 营销 |
| `/dashboard/workflows`（+ `/builder`、`/runs`、`/runs/:runId`、`/templates`、`/:id`） | `views/dashboard/workflows/*.vue` | Sprint 12 工作流 |
| `/dashboard/subscription`（+ `/upgrade`、`/usage`） | `views/dashboard/subscription/*.vue` | Sprint 5 订阅 |
| `/dashboard/settings`（+ `/security`、`/preferences`、`/channels`） | `views/dashboard/settings/*.vue` | Sprint 10 设置中心（Tab 式） |
| `/dashboard/organization`（+ `/members`、`/roles`、`/settings`、`/switch`） | `views/dashboard/organization/*.vue` | Sprint 13 多租户 |
| `/onboarding/create-org` | `views/onboarding/CreateOrg.vue` | 无组织时的引导页 |
| `/invitation/:token` | `views/invitation/Accept.vue` | 邀请接受页（公开） |
| `/auth/callback/:platform` | `views/auth/callback.vue` | OAuth 回调 |
| `/checkout/demo`、`/success`、`/cancel` | `views/checkout/*.vue` | 结账演示与回调 |
| `/403` | `views/errors/Forbidden.vue` | 权限不足 |

---

## 2. 两层路由守卫（顺序很重要）

`web/src/router/index.ts` 末尾注册了两个 `beforeEach`，**执行顺序就是注册顺序**：

1. **认证守卫**（inline 在 `index.ts`）：`await auth.bootstrap()` 恢复会话 → 非公开路径且未登录则跳
   `/login?redirect=<原路径>` → 已登录访问 `/login` 或 `/register` 则跳 `/chat`。
2. **组织与权限守卫**（`router/guards.ts` 的 `registerOrgGuards`）：
   - 未登录直接放行（交给第一层）；
   - `ORG_FREE_PATHS`（`/onboarding/create-org`、`/403`、`/invitation/*`）放行，避免重定向死循环；
   - `await org.bootstrap()`（**已记忆化，一个会话只请求一次**）；
   - 需要租户但没有当前组织 → 跳 `/onboarding/create-org?redirect=<原路径>`；
   - `meta.permission` / `meta.permissions` 不满足 → 跳 `/403?from=&needed=`。

判定「是否需要租户」的规则（`requiresOrganization()`）：`meta.requiresOrg === true` 需要；
`=== false` 不需要；未声明时**看路径是否以 `/dashboard/` 开头**。

权限判定用组织 store 缓存的权限集合（`org.canAny(needed)`），**导航期间不发权限请求**。

---

## 3. 按领域模块的文件映射

改动某个功能时，通常需要同时碰这几层。表格里 `c/` = `components/`，`v/` = `views/`。

### 收件箱（Sprint 6）
- 视图：`v/dashboard/conversations/index.vue`、`v/ChatView.vue`
- 组件：`c/conversation/`（ConversationList、ConversationItem、MessageList、MessageBubble、MessageInput、AIReplyCard、QuickReplyPopup、TypingIndicator、ConnectionStatusBar）+ 根级 `c/ChatWindow.vue`、`c/ConversationList.vue`（Sprint 2b 旧版）
- store：`stores/conversation.ts`、`stores/message.ts`、`stores/websocket.ts`
- api：`api/conversation.ts`、`api/conversations.ts`（历史重复）、`api/message.ts`
- composable：`useConversation`、`useMessageList`、`useTypingIndicator`、`useWebSocket`、`messageGrouping`
- 示例数据：`api/demo.ts` 的 `demoInbox*()`

### 客户目录（Sprint 7）
- 视图：`v/dashboard/customers/index.vue`、`detail.vue`
- 组件：`c/customer/`（CustomerList、CustomerCard、CustomerItem、CustomerForm、CustomerStats、TagManager、TagSelector）
- store：`stores/customer.ts`、`stores/tag.ts`
- api：`api/customer.ts`、`api/tag.ts`
- composable：`useCustomer`、`useCustomerList`、`useCustomerTags`
- 示例数据：`api/demo.ts`

### 数据分析（Sprint 8）
- 视图：`v/dashboard/analytics/index.vue`
- 组件：`c/analytics/`（StatCard、TrendChart、ChannelPieChart、ResponseTimeGauge、TopCustomersTable、ChartPanel、DateRangePicker）
- store：`stores/analytics.ts`
- api：`api/analytics.ts`
- composable：`useDashboard`、`useDateRange`、`useChart`
- lib：`lib/echarts.ts`（按需注册 ECharts 模块）、`lib/metrics.ts`

### 渠道连接（Sprint 5b）
- 视图：`v/dashboard/channels/index.vue`、`connect.vue`；`v/auth/callback.vue`
- 组件：`c/channel/`（ChannelCard、ChannelStatusBadge、PlatformSelector、CredentialFormDialog、ConnectLimitWarning）
- store：`stores/channel.ts`
- api：`api/channel.ts`、`api/webhooks.ts`
- **策略层**：`providers/`（`types.ts` 定义 `ChannelProvider` 接口与 `CredentialField`；`WhatsAppProvider` / `FacebookProvider` / `InstagramProvider` / `TikTokProvider`；`ChannelProviderFactory`）
- composable：`useChannelBinding`；事件总线：`events/channel.ts`
- 示例数据：`api/demo.ts` 的 `demoChannels()` / `demoConnect()` 等

### AI 营销（Sprint 11）
- 视图：`v/dashboard/marketing/`（index、CreateCampaign、CampaignDetail、Templates、History）
- 组件：`c/marketing/`（AIContentGenerator、ContentEditor、RecipientSelector、ChannelPreview、CampaignCard、TemplateCard、SendProgressDialog）
- store：`stores/marketing.ts`
- api：`api/marketing.ts`
- composable：`useMarketing`、`useBatchSend`、`useTemplates`、`useAIContent`
- lib：`lib/marketingContent.ts`、`lib/marketingValidation.ts`、`lib/sendQueue.ts`（客户端限流）、`lib/csv.ts`（导出）
- 示例数据：`api/demoMarketing.ts`；i18n：`i18n/marketing.ts`

### 工作流（Sprint 12）
- 视图：`v/dashboard/workflows/`（index、Builder、Detail、Runs、RunDetail、Templates）
- 组件：`c/workflow/`（WorkflowCanvas、WorkflowGraph、NodePanel、NodeCard、NodePropertyPanel、ExecutionPath、RunTimeline、WorkflowCard、TemplateCard）
- store：`stores/workflow.ts`
- api：`api/workflow.ts`
- composable：`useWorkflow`、`useWorkflowBuilder`、`useWorkflowMonitor`、`useWorkflowTemplates`
- lib：`lib/workflowGraph.ts`、`lib/workflowNodes.ts`、`lib/workflowRun.ts`、`lib/workflowTemplates.ts`
- 类型：`types/workflow.ts`；示例数据：`api/demoWorkflow.ts`；i18n：`i18n/workflow.ts`

### 组织与权限（Sprint 13）
- 视图：`v/dashboard/organization/`（index、members、roles、settings、switch）、`v/onboarding/CreateOrg.vue`、`v/invitation/Accept.vue`、`v/errors/Forbidden.vue`
- 组件：`c/organization/`（OrgPageShell、OrgSwitcher、OrgCard、MemberTable、InviteDialog、PermissionTree、ActivityFeed）、`c/permission/`（PermissionGuard、RoleBadge）
- store：`stores/organization.ts`
- api：`api/organization.ts`、`api/member.ts`、`api/role.ts`、`api/permission.ts`
- composable：`useOrganization`、`useMember`、`useRole`、`usePermission`
- lib：`lib/organization.ts`、`lib/orgNav.ts`、`lib/permissions.ts`（**权限字符串清单在这里**）
- 指令：`directives/permission.ts`（`v-permission`）
- 类型：`types/organization.ts`；示例数据：`api/demoOrganization.ts`；i18n：`i18n/organization.ts`

### 订阅计费（Sprint 5）
- 视图：`v/dashboard/subscription/`（index、upgrade、usage）、`v/checkout/`（demo、success、cancel）
- 组件：`c/subscription/`（PlanCard、UsageBar、SubscriptionStatusBadge）
- store：`stores/subscription.ts`、`stores/usage.ts`
- api：`api/plan.ts`、`api/subscription.ts`、`api/usage.ts`
- 示例数据：`api/demo.ts` 的 `demoPlans()` / `demoCreateCheckout()` / `demoUsage()` 等

### 通知（Sprint 9）
- 视图：`v/dashboard/notifications/`（index、preferences）
- 组件：`c/notification/`（NotificationBell、NotificationDropdown、NotificationItem、NotificationToast）
- store：`stores/notification.ts`
- api：`api/notification.ts`
- composable：`useNotification`、`useNotificationList`、`useNotificationSocket`
- lib：`lib/notificationAlerts.ts`、`lib/notificationWindow.ts`

### 设置与账号（Sprint 3 + 10）
- 视图：`v/dashboard/settings/`（index + ProfileTab / SecurityTab / PreferencesTab / ChannelsTab）、`v/SettingsProfileView.vue`、`v/SettingsSecurityView.vue`（Sprint 3 老页面，仍在路由里）
- 组件：`c/settings/`（AvatarUploader、PasswordForm、ChannelBindDialog、ChannelCard）、根级 `c/SettingsNav.vue`、`c/UserMenu.vue`
- store：`stores/auth.ts`、`stores/settings.ts`
- api：`api/auth.ts`、`api/settings.ts`
- composable：`useProfile`、`useSecurity`、`useSettings`
- lib：`lib/settingsValidation.ts`、`lib/avatar.ts`

### 落地页（Sprint 4）
- 视图：`v/landing/`（index、pricing、privacy、terms）
- 组件：`c/landing/`（LandingHeader、LandingFooter）；布局 `layouts/LandingLayout.vue`
- SEO：`composables/usePageMeta.ts`（title 格式 `{页面名} - KiliSocial`）

---

## 4. 横切基础设施（改动前务必理解）

### 4.1 `api/http.ts` — 唯一的 HTTP 出口

所有请求都经过这里，能力包括：同源 base（`VITE_API_BASE` 可覆盖）、10s 超时（`AbortController`）、
GET 自动重试 1 次、`ApiResponse` 解包、`ApiError` + i18n 错误码映射、401 时先刷新会话再重放、
`X-Organization-Id` 租户头注入、`credentials: 'include'`。

关键导出：`apiGet` / `apiPost` / `apiPut` / `apiDelete`、`ApiError`、`apiErrorI18nKey`、
`onUnauthorized`、`setOrganizationHeader`、`setRequestContext`、`ORG_HEADER`、`REQUEST_TIMEOUT_MS`。

> **不要在任何模块里直接写 `fetch`**，唯一例外是 `api/message.ts` 的 `uploadMedia()`（multipart 上传，
> 需要手动构造 FormData 与响应处理）。新增类似场景时请沿用它的写法。

### 4.2 示例数据降级（`api/demo.ts`）

```
请求失败 → isMissingBackend(error)  // TIMEOUT / HTTP_404 / NOT_FOUND / 任意网络异常 → true
        → enterDemoMode()           // localStorage['ks-demo-mode'] = '1'
        → 之后整个会话走 demoXxx()
```

`demo*.ts` 返回的对象带 `demo: true` 标记，页面据此显示可关闭的「示例数据」提示条（`van-notice-bar`）。
**补后端时不要删掉 demo 分支**，它是弱网/后端缺失时的兜底，也是测试的夹具来源。

### 4.3 WebSocket（`lib/websocket.ts` + `websocket/notificationWs.ts` + `stores/websocket.ts`）

- 默认地址：同源 `/ws`（`wss://<host>/ws`），可用 `VITE_WS_URL` 覆盖；
- 指数退避重连，上限 30s；重试耗尽后 UI 显示「离线」（`c/conversation/ConnectionStatusBar.vue`）；
- 监听事件：`conversation_update`、`new_message`、`message_status_update`、通知推送；
- 可通过 `options.WebSocketImpl` 注入实现，便于测试；
- **后端目前没有 `/ws` 端点**，所以线上一定是「重试 → 离线」路径。nginx 侧已配好 upgrade 头。

### 4.4 国际化（`i18n/`）

自研轻量方案，**没有用 vue-i18n**：

- `i18n/index.ts`：`useI18nStore()`，`locale` / `setLocale()` / `t(key, params)`；
- 语言：`en` / `zh` / `fr`（`UI_LOCALES`），启动时 `detectLocale()` 读 `navigator.language`，之后存 `localStorage['ks-ui-locale']`；
- 词典：`messages.ts`（主，104KB）、`marketing.ts`、`workflow.ts`、`organization.ts`，按模块分文件；
- 缺 key 时回落英文，再回落 key 本身；参数用 `{name}` 占位；
- 切换入口：`components/LanguageSwitcher.vue`（全站右上角）。

**新增文案必须三语齐全**，否则该语言下会显示英文或裸 key。

### 4.5 设计 token（`styles/tokens.css`）

所有颜色/间距/圆角/阴影都是 `--ks-*` CSS 变量，取值定义在根目录 `DESIGN_SYSTEM.md`（v2.0，已冻结）。
组件内用 scoped CSS 引用变量，**禁止硬编码色值**。主题初始化在 `lib/theme.ts` 的 `initTheme()`，
`main.ts` 里在首次渲染前调用以避免闪烁。

### 4.6 应用启动顺序（`main.ts`）

```
initTheme()                      // 先画主题，避免闪烁
onUnauthorized(...)              // 注册 401 兜底：清会话 + 跳 /login
createApp → use(pinia) → use(router) → use(Vant)
registerPermissionDirective(app) // v-permission 依赖 pinia，必须在其后
app.mount('#app')
useAuthStore(pinia).bootstrap()  // 恢复登录态
```

顺序有依赖，改动时注意：`v-permission` 读组织 store，所以 pinia 必须先注册；组织 store 的 `bootstrap()`
会在第一次导航时由守卫触发，并把 `X-Organization-Id` 写进 `http.ts` 的请求上下文。

---

## 5. 快速定位表

| 我要改… | 去这里 |
| --- | --- |
| 全站配色 / 字号 / 圆角 | `styles/tokens.css`，取值对照 `DESIGN_SYSTEM.md` |
| 语言切换、新增文案 | `i18n/messages.ts`（或对应模块词典）+ `components/LanguageSwitcher.vue` |
| 请求超时 / 重试 / 错误提示 | `api/http.ts` |
| 示例数据内容 | `api/demo.ts`、`demoMarketing.ts`、`demoOrganization.ts`、`demoWorkflow.ts` |
| 登录后跳哪、哪些页面免登录 | `router/index.ts` 的 `PUBLIC_PATHS` 与末尾守卫 |
| 租户 / 权限拦截 | `router/guards.ts`、`stores/organization.ts`、`lib/permissions.ts`、`directives/permission.ts` |
| 头像 fallback | `lib/avatar.ts`、`components/KsAvatar.vue` |
| 相对时间显示 | `lib/relativeTime.ts` |
| CSV 导出 | `lib/csv.ts` |
| 图表按需引入 | `lib/echarts.ts`、`composables/useChart.ts` |
| PWA 清单 / Service Worker | `vite.config.ts` 的 `VitePWA` 配置 |
| 离线草稿存储 | `stores/drafts.ts`（localforage） |
| 环境变量 | `web/.env.example` → 复制为 `.env.local` |

---

## 6. 已知的结构冗余（改的时候别被绕进去）

1. `api/conversation.ts`（Sprint 6）与 `api/conversations.ts`（Sprint 2c）**并存且路径重叠**；
   `components/ConversationList.vue`（根级，Sprint 2b）与 `components/conversation/ConversationList.vue`（Sprint 6）同名不同物。
2. `views/SettingsProfileView.vue` / `SettingsSecurityView.vue`（Sprint 3）与 `views/dashboard/settings/` 的 Tab 版（Sprint 10）**同时在路由里**。
3. `views/error/` 是个空的本地残留目录（未入库），真正在用的是 `views/errors/Forbidden.vue`。
4. `api/settings.ts` 的 profile/channels 与 `api/auth.ts` 的 `PUT /me`、`api/channel.ts` 职责重叠。

这些是逐个 Sprint 增量交付的自然结果，**不要在没有用户确认的情况下做大范围合并重构**（会破坏已验收的测试）。
清理建议记录在 `10_OPEN_ISSUES_BACKLOG.md`。
