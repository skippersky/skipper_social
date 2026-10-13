# 11 · 术语表

> 项目里混用了中文、英文、斯瓦希里语和平台专有名词。本文统一口径，避免接手人误解。

---

## 产品与品牌

| 术语 | 含义 |
| --- | --- |
| **KiliSocial** | 产品名。面向非洲小微卖家的社交电商运营工具。仓库名 `kili-social` / `skipper_social`（GitHub 镜像） |
| **Kili** | 简称，取自 Kilimanjaro（乞力马扎罗）。PWA 的 `short_name` 就是 `Kili` |
| **卖家 / seller** | 目标用户：非洲小微商家，单店铺单品牌，靠 WhatsApp / FB / IG / TikTok 做私域成交 |
| **MVP** | 当前阶段。`PRD.md` 与 `ROADMAP.md` 定义，但 ROADMAP 已过时 |

## 语言

| 术语 | 含义 |
| --- | --- |
| **en / zh / fr** | UI 支持的三语。`zh` 是给运营方看的，`en`/`fr` 面向目标市场 |
| **sw / swahili（斯瓦希里语）** | 目标市场语言。**目前只在 AI 文案模板里有**（`application.yml` 的 `kili.copywriting.templates` 有 `locale: sw` 的 `social_post` 与 `caption_generation`），UI i18n 尚未支持 |
| **NDPR / GDPR** | 数据合规要求（尼日利亚数据保护条例 / 欧盟通用数据保护条例），`PROJECT_BOUNDARIES.md` 明确禁止收集非必要个人信息 |

## 社交平台与渠道

| 术语 | 含义 |
| --- | --- |
| **渠道 / channel** | 一个已连接的社交平台账号。platform ∈ `whatsapp` / `facebook` / `instagram` / `tiktok` |
| **WA / WhatsApp Business API** | Meta 官方的 WhatsApp 商用接口（Cloud API）。**禁止用个人号协议破解/模拟**（红线） |
| **Phone Number ID** | WA Cloud API 的号码标识，发消息必需 |
| **Verify Token** | Meta Webhook 订阅验证时自定义的握手令牌，`GET /api/v1/wa/webhook` 用它校验 `hub.challenge` |
| **App Secret** | Meta 应用密钥，用于计算 Webhook 签名 |
| **X-Hub-Signature-256** | Meta Webhook 请求头，值为 `sha256=<HMAC>`。校验实现在 `ai-service` 的 `WebhookSignatureVerifier` |
| **Graph API** | Meta 的统一 API（`https://graph.facebook.com`），FB 与 IG 都走它，当前配置版本 `v22.0` |
| **Page ID / Page Access Token** | FB 主页标识与令牌 |
| **Instagram Business Account ID** | IG 商业账号标识（个人号不支持 API 发布） |
| **Client Key / Client Secret** | TikTok 开放平台（`https://open.tiktokapis.com`，版本 `v2`）的应用凭证 |
| **PKCE** | OAuth 的 proof key 扩展。TikTok 配置里 `pkce-enabled: false` |
| **Provider** | 前端的渠道策略实现，见 `web/src/providers/`。每个 Provider 提供 `connect()`、`getRequiredCredentials()` 等 |
| **OAuth 模式 / 手动凭证模式** | 渠道连接的两种方式（Sprint 5b）。前者跳平台授权页，后者弹 `CredentialFormDialog` 让用户手填 |

## AI

| 术语 | 含义 |
| --- | --- |
| **Qwen / 通义千问** | 阿里云大模型。走 DashScope 接口（`dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`） |
| **qwen-turbo / qwen-max** | 两个模型档位，`QwenModelEnum` 定义，可切换 |
| **Token 计量** | 记录 `model` / `input_tokens` / `output_tokens` / `cost_usd`，实现见 `TokenUsage` + `TokenUsageLogger` |
| **语义缓存 / semantic cache** | 以 Prompt 语义为 key 的缓存，规则 `qwen:cache:{model}:{sha256(prompt)}`，TTL 24h。生成器 `SemanticCacheKeyGenerator`，接口 `SemanticCache`，当前实现 `InMemorySemanticCache`（将来换 Redis） |
| **降级 / fallback** | Qwen 调用失败时返回预设模板文案；文案服务失败时返回 `[CONTENT_UNAVAILABLE]` 并记 ERROR |
| **Prompt 模板** | `prompt_config` 表的记录：`name` + `version` + `model` + `system_prompt` + `user_template` + `is_active`，唯一索引 `uk_name_version` |
| **content-type** | 文案场景标识，如 `social_post`、`caption_generation`、`social_reply` |
| **变量替换** | `user_template` 里的 `{variable}` 占位；缺变量抛 `IllegalArgumentException("Missing variable: xxx")` |

## 业务领域

| 术语 | 含义 |
| --- | --- |
| **会话 / conversation** | 与一个联系人的一条对话线程 |
| **统一收件箱 / unified inbox** | 跨渠道聚合的会话列表（Sprint 6） |
| **消息类型** | `text` / `image` / `location` 三种；未知类型记 WARN 并返回 200（不阻塞 Meta 重推） |
| **消息状态** | `sending` / `sent` / `read` |
| **客户 / customer** | 会话对端的联系人档案（Sprint 7 客户目录） |
| **标签 / tag** | 客户分类标记，有固定色板（取自 `DESIGN_SYSTEM.md` token） |
| **营销活动 / campaign** | 一次批量群发（Sprint 11），有 start/pause/cancel/retry 生命周期与发送记录 |
| **受众 / recipients** | 营销活动的目标客户集合，支持 query 筛选与 validate 校验 |
| **限流群发 / throttled batch send** | 客户端节流发送（`lib/sendQueue.ts`），后端也需自己控速——**未经审核发送营销消息是红线（防封号）** |
| **工作流 / workflow** | 可视化编排的自动化规则（Sprint 12）：触发器 trigger → 条件 condition → 动作 action |
| **运行 / run** | 工作流的一次执行实例，有步骤明细与状态 |
| **组织 / organization** | 租户单位（Sprint 13）。一个用户可属于多个组织，通过 `X-Organization-Id` 头指定当前租户 |
| **成员 / member、角色 / role、权限 / permission** | RBAC 三要素。权限字符串格式 `resource:action`（如 `organization:view_members`），清单在 `web/src/lib/permissions.ts` |
| **邀请 / invitation** | 通过 token 链接加入组织，`/invitation/:token` 页面**未登录也可访问** |
| **套餐 / plan、订阅 / subscription、用量 / usage** | 商业化三件套。tier ∈ `free` / `basic` / `pro`；usage 追踪 AI 调用数 / 消息量 / 分发次数，≥80% 黄色警告，达上限红色警告 |

## 支付

| 术语 | 含义 |
| --- | --- |
| **M-Pesa** | 非洲主流移动支付（IN SCOPE） |
| **Paystack** | 非洲支付网关（IN SCOPE） |
| **Stripe** | ❌ OUT OF SCOPE，但 Sprint 5 按需求单做了 test-mode 形状的前端流程 → **未决事项**，见 `08_DECISION_LOG.md` D-13 |

## 技术

| 术语 | 含义 |
| --- | --- |
| **ApiResponse 信封** | 统一响应结构 `{ success, code, message, data, timestamp }`，后端 `common/ApiResponse.java`，前端 `api/http.ts` 的 `unwrap()` |
| **示例数据降级 / demo fallback** | 后端缺失时前端自动切到内置示例数据（`api/demo*.ts`），标记 `demo: true` 并显示可关闭提示条。开关在 `localStorage['ks-demo-mode']` |
| **`--ks-*`** | 设计 token 的 CSS 变量前缀，定义在 `web/src/styles/tokens.css`，取值见 `DESIGN_SYSTEM.md` |
| **`v-permission`** | 自定义指令（`directives/permission.ts`），按权限字符串控制元素渲染 |
| **utf8mb4** | MySQL 字符集，全库强制（`sql/init.sql` + compose 启动参数） |
| **Flyway** | 数据库迁移工具。**注意：依赖尚未引入**，`V1__create_prompt_config.sql` 目前是死文件 |
| **JaCoCo / Checkstyle** | 后端覆盖率与静态检查，门禁见 `09_TESTING_GUIDE.md` |
| **Sprint 0–13** | 实际执行的迭代编号（后端 0–1，前端 2b–13）。与 `ROADMAP.md` 里的「Sprint 0–4 / 8 周」是两套体系，**以实际编号为准** |
| **一键部署 / init-deploy** | `scripts/init-deploy.sh`，见 `03_ENVIRONMENT_SETUP.md` 第 6 节 |

---

## 缩写速查

`WA` WhatsApp ｜ `IG` Instagram ｜ `FB` Facebook ｜ `RBAC` 基于角色的访问控制 ｜
`ADR` 架构决策记录 ｜ `DTO` 数据传输对象 ｜ `DDL` 数据定义语言 ｜
`PWA` 渐进式 Web 应用 ｜ `SSG` 静态站点生成 ｜ `AOF/RDB` Redis 两种持久化 ｜
`PAT` 个人访问令牌 ｜ `PKCE` OAuth 证明密钥交换 ｜ `HMAC` 带密钥哈希 ｜
`KPI` 关键指标 ｜ `CSV` 逗号分隔值 ｜ `CI` 持续集成
