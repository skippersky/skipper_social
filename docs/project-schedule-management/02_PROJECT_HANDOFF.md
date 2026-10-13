# KiliSocial 项目交接文档（开发环境迁移）

> 生成时间：2026-10-13 ｜ 交接基线提交：`a53e62a`（分支 `master`）｜ git 工作树干净
>
> 文档总入口是 `00_INDEX.md`。本文是项目现状总览，配套两份：
> - `03_ENVIRONMENT_SETUP.md` — 新环境从零跑起来的完整步骤与实测基线
> - `04_SECRETS_HANDLING.md` — 密钥清单、已泄露项、轮换步骤
>
> 阅读顺序：本文第 1、2、4、5 节 → `03_ENVIRONMENT_SETUP.md` → `04_SECRETS_HANDLING.md` → 本文第 8、9 节。

---

## 1. 30 秒读懂现状

- **后端是一个能跑通的骨架。** Spring Boot 3.3.5 / JDK 17 / Maven 6 模块，质量门禁齐全（Checkstyle + JaCoCo LINE ≥ 80%），但对外只有 **4 个真实 HTTP 端点**。
- **前端是一个功能完整的客户端。** Vue 3 + Vite + Pinia + Vant 4 + TS，Sprint 2b→13 共 13 个迭代、40+ 路由，105 个测试文件 / 1852 个用例全绿，语句覆盖率 97.84%。
- **二者的落差 = 本项目最大的技术债。** 前端 22 个接口模块里绝大多数对应的后端接口**尚未实现**；前端靠统一的「示例数据降级」机制正常运行（第 5 节）。
- **后端目前完全没有数据层。** MySQL / Redis 容器在跑，但 pom 里没有 JPA、JDBC、MySQL 驱动、Redis 客户端、Flyway、WebSocket 任何一项依赖（第 6 节）。这是接手后的第一优先事项。
- **已有一台测试服务器在线。** Ubuntu 24.04，域名 `social.hengzhanwujin.com`，4 个容器全部 healthy。
- **迁移到新环境，第一件事是轮换密钥。** 有明文密钥已进 git 历史（`04_SECRETS_HANDLING.md`），P0。

---

## 2. 仓库与分支（重要，容易踩）

本仓库**有两个远程**，日常推送必须显式指定 GitHub URL：

| 用途 | 地址 | 说明 |
| --- | --- | --- |
| `origin`（内网） | `http://sz.git.egatee.cn:90/2b2c/quickbiz/kili-social` | 原始内网 Git，部署服务器**访问不到**，别用它部署 |
| GitHub 镜像（部署源） | `https://github.com/skippersky/skipper_social.git` | 服务器 `init-deploy.sh` 从这里 clone / pull |

- 当前分支：**`master`**（不是 `main`），GitHub 上同样是 `master`。
- 推送命令（`origin` 被内网占用，所以 PAT 直接内嵌在 URL 里）：

```bash
git push https://skippersky:<PAT>@github.com/skippersky/skipper_social.git master
```

- **PAT 必须带 `workflow` scope**，否则推送包含 `.github/workflows/` 的提交会被 GitHub 以 403 拒绝（历史上踩过）。
- 新机器首次操作可能报 `detected dubious ownership`，用 `git config --global --add safe.directory <仓库绝对路径>` 解决。
- `.gitignore` 已排除 `target/ .m2/ .tools/ data/ .env node_modules dist coverage *.log`，**全新 clone 不带任何工具链和本地仓库缓存**，需按 `03_ENVIRONMENT_SETUP.md` 自备 JDK 17 / Maven / Node。

---

## 3. 技术栈与目录结构

### 3.1 后端（Java）

| 项 | 值 |
| --- | --- |
| Spring Boot | 3.3.5（继承 `spring-boot-starter-parent`） |
| JDK | 17（Temurin，实测 17.0.20） |
| 构建 | Maven 3.9.9，6 模块 reactor |
| 静态检查 | Checkstyle 10.18.2，规则 `config/checkstyle/checkstyle.xml`，绑定 `verify` 阶段 |
| 覆盖率门禁 | JaCoCo 0.8.12，`verify` 阶段 `BUNDLE / LINE / COVEREDRATIO ≥ 0.80` |
| API 文档 | springdoc-openapi（`/swagger-ui`、`/v3/api-docs`） |
| 父 pom 统一依赖 | actuator、validation、web、test（各模块只声明额外依赖） |

模块与职责（reactor 顺序）：

```
kili-social (parent pom)
├── common                  ApiResponse 统一响应信封、BusinessException、GlobalExceptionHandler
├── app                     启动类、HelloController、OpenApiConfig、application.yml（唯一配置文件）
├── ai-service              QwenClient（3 次指数退避重试 + 降级）、TokenUsage 计量与日志、
│                           SemanticCacheKeyGenerator、WebhookSignatureVerifier（纯函数，被下游复用）
├── wa-webhook-controller   GET/POST /api/v1/wa/webhook、WaMessageParser（text/image/location）、PhoneMasker
├── copywriting-service     CopywritingService：模板加载 + {var} 替换 + 语义缓存 + 降级 [CONTENT_UNAVAILABLE]
└── wa-ai-integration       WaAiMessageHandler：WA 消息 → 文案生成的路由适配层
```

代码量：main 源文件 35 个，测试类 18 个。

### 3.2 前端（`web/`）

| 项 | 值 |
| --- | --- |
| 框架 | Vue 3.4 + TypeScript 5.5 + Vite 5.4（**注意：不是 Next.js**，早期需求文档里写过 Next.js，实际落地为 Vue 3） |
| 状态 | Pinia 2.2，16 个 store |
| UI | Vant 4.9 + 基于 CSS 变量的设计 token（见 `DESIGN_SYSTEM.md` v2.0） |
| 图表 | ECharts 6 + vue-echarts |
| 流程图 | @vue-flow/core + background / controls / minimap（工作流可视化编排） |
| 离线能力 | localforage（草稿箱）+ vite-plugin-pwa（PWA 清单，`start_url: /`） |
| 测试 | Vitest 2 + @vue/test-utils + jsdom，覆盖率 provider v8 |
| 包管理 | **pnpm**（仓库只有 `pnpm-lock.yaml`，没有 `package-lock.json`） |
| 覆盖率门禁 | `vite.config.ts` 中 lines/statements ≥ 80，functions/branches ≥ 70 |

前端目录：

```
web/src/
├── api/          27 个文件 = 22 个接口模块 + 4 个示例数据源(demo*.ts, ~133KB) + http.ts 封装
├── components/   业务组件（channel / organization / marketing / workflow / settings ...）
├── composables/  31 个 use* 组合式函数
├── stores/       16 个 Pinia store
├── providers/    渠道策略：WhatsApp / Facebook / Instagram / TikTok + ChannelProviderFactory
├── router/       index.ts（全部路由）+ guards.ts（登录守卫 + 组织守卫）
├── i18n/         自研轻量 i18n（**不是 vue-i18n**），en / zh / fr 三语，词典约 218KB
├── websocket/    notificationWs.ts（指数退避重连，上限 30s）
├── directives/   permission.ts（v-permission 指令）
├── lib/          avatar / csv / echarts / metrics / permissions / sendQueue / theme / websocket ...
├── views/        landing / auth / checkout / dashboard / onboarding / invitation / errors
├── layouts/      LandingLayout.vue
├── events/       channel.ts / socket.ts（轻量事件总线）
├── types/        index.ts / organization.ts / workflow.ts
└── styles/       设计 token 与全局样式
```

---

## 4. Sprint 进度总表

> ⚠️ **两套 Sprint 编号并存**：根目录 `ROADMAP.md` 是最初的「8 周 4 冲刺」计划（复选框一个都没勾，已过时）；实际执行按下面的 Sprint 0–13 推进。以本表为准。

| Sprint | 范围 | 状态 | 关键产出 / 对应文档 |
| --- | --- | --- | --- |
| 0 | 后端基建与合规 | ✅ | 6 模块脚手架、Checkstyle+JaCoCo 门禁、`docker-compose.yml`、`.github/workflows/ci.yml`、`README_CONTAINER.md`、`SERVER_VALIDATION_CHECKLIST.md`、`CI_PIPELINE.md` |
| 1 | AI 引擎 + WA Webhook（离线） | ✅ | `COPYWRITING_SERVICE_DESIGN.md`、`WA_WEBHOOK_INTEGRATION.md`、`WA_AI_INTEGRATION_TEST_PLAN.md` |
| 2b | web 编辑器 + 离线草稿 PWA | ✅ | `/editor`、`/drafts`，localforage 持久化 |
| 2c | web API 联调层 | ✅ | `http.ts`（超时 10s / GET 重试 1 次 / 401 刷新）、`API_CONTRACT.md` |
| 3 | 用户模块 | ✅ | 登录 / 注册 / 忘记密码 / 资料 / 安全，路由守卫，401 恢复 |
| 4 | 落地页 | ✅ | `/`（Landing）、`/pricing`、`/privacy`、`/terms`，SEO meta |
| 5 | 订阅模块 | ✅ | `/dashboard/subscription`（管理 / 升级 / 用量）、`/checkout/*` |
| 5b | 渠道连接 + Hotfix | ✅ | `sprint-reports/CHANNEL_MODULE_SCAN.md`；OAuth 与手动凭证双模式；新手引导 |
| 6 | 统一收件箱 | ✅ | `sprint-reports/CONVERSATION_MODULE_SCAN.md`；筛选、分页、乐观发送、AI 回复、快捷回复、WS 实时更新 |
| 7 | 客户目录 | ✅ | `sprint-reports/CUSTOMER_MODULE_SCAN.md`；搜索 / 标签 / 详情 / 统计 / 历史 / 收件箱深链 |
| 8 | 数据分析 | ✅ | `sprint-reports/ANALYTICS_MODULE_SCAN.md`；KPI、趋势、渠道占比、响应时长、Top 客户 |
| 9 | 通知中心 | ✅ | `sprint-reports/NOTIFICATION_MODULE_SCAN.md`；铃铛、列表、偏好、WS 推送 |
| 10 | 系统设置与账号 | ✅ | `sprint-reports/SETTINGS_MODULE_SCAN.md`；资料 / 头像 / 安全 / 偏好 / 渠道绑定 |
| 11 | AI 智能营销 | ✅ | `sprint-reports/MARKETING_MODULE_SCAN.md`；内容生成、受众选择、限流群发、模板、历史、CSV 导出 |
| 12 | 自动化工作流 | ✅ | `sprint-reports/WORKFLOW_MODULE_SCAN.md`；可视化编排器、触发器 / 条件 / 动作、运行监控、模板 |
| 13 | 多租户 + RBAC | ✅ | `sprint-reports/ORGANIZATION_MODULE_SCAN.md`；组织切换、成员、角色、邀请、组织级路由守卫、`v-permission` |

**未启动**（ROADMAP 里规划但没做）：真实支付（M-Pesa / Paystack）、WA 消息队列与死信、IG/FB Graph API 实际发布、送达率监控、Android WebView 壳、安全审计与渗透测试。

---

## 5. 前后端落差与「示例数据降级」机制（必读）

这是理解本项目最关键的一节。

### 5.1 后端真实存在的端点只有 4 个

| 方法 | 路径 | 实现位置 |
| --- | --- | --- |
| GET | `/api/v1/hello` | `app/.../health/controller/HelloController.java` |
| POST | `/api/v1/ai/copywriting` | `copywriting-service/.../controller/CopywritingController.java` |
| GET | `/api/v1/wa/webhook` | `wa-webhook-controller/.../WaWebhookController.java`（Meta 验证握手） |
| POST | `/api/v1/wa/webhook` | 同上（消息接收，签名校验 + 脱敏日志） |

外加 Spring Actuator 的 `/actuator/health`、`/actuator/info`，以及 springdoc 的 `/swagger-ui`、`/v3/api-docs`。

**其余前端调用的所有接口（auth / conversations / customers / analytics / channels / marketing / workflows / organization / notifications / subscription / settings ...）后端一律不存在。**

### 5.2 前端如何在这种情况下正常工作

统一降级链路，全部集中在 `web/src/api/`：

1. `http.ts` 发起请求：默认**同源**（`apiBase()` 返回 `''`，由 nginx 或 vite dev proxy 转发到 `127.0.0.1:18080`），可用 `VITE_API_BASE` 覆盖。超时 10s，GET 遇网络错误/超时/5xx 自动重试 1 次，POST 不重试。
2. 404 / `NOT_FOUND` / `TIMEOUT` / 任意网络异常 → `demo.ts` 的 `isMissingBackend(error)` 判定为「后端缺失」。
3. 命中后调用 `enterDemoMode()`，在 `localStorage` 写入标记 `ks-demo-mode = '1'`，**之后整个会话都走示例数据**，不再反复打真实接口。
4. 示例数据来自 `demo.ts` / `demoMarketing.ts` / `demoOrganization.ts` / `demoWorkflow.ts`，返回的对象带 `demo: true` 标记。
5. 页面据此显示**可关闭的琥珀色「示例数据」提示条**（`van-notice-bar`），关闭后隐藏示例数据、显示空状态引导。

> 接手须知：这个机制是**刻意设计的离线验收能力**，不是 bug。但它也意味着「前端全绿」不等于「功能真的通了」。补后端时，每实现一个接口，就要把对应 api 模块的 demo 分支保留为兜底、并新增一条真实链路测试。

### 5.3 `http.ts` 里已有的基础设施（补后端时直接复用）

- `ApiResponse<T>` 信封：`{ success, code, message, data, timestamp }`，与后端 `common/ApiResponse.java` 一致。
- `ApiError` + `apiErrorI18nKey()`：把错误码映射到 i18n key（`api.timeout` / `api.401` / `api.403` / `api.404` / `api.500` / `api.network`）。
- `onUnauthorized(handler)`：全局 401 钩子；401 时先尝试 `POST /api/v1/auth/refresh` 一次，成功则重放请求，失败才登出。并发调用共享同一个刷新 Promise。
- `setOrganizationHeader(orgId)`：注入 `X-Organization-Id` 请求头（Sprint 13 多租户隔离）。**后端实现任何业务接口时都必须读这个头做数据隔离。**
- `credentials: 'include'`：认证走 httpOnly Cookie，前端不碰 token。

---

## 6. 数据层现状（重大缺口）

**后端 pom 里没有任何数据层依赖。** 已确认不存在：`spring-boot-starter-data-jpa`、`spring-boot-starter-jdbc`、`mysql-connector-j`、`spring-boot-starter-data-redis`、`flyway-core`、`spring-boot-starter-websocket`。

由此产生三个直接后果：

1. **`docker-compose.yml` 里的 MySQL 和 Redis 容器虽然在跑且 healthy，但应用从不连接它们**，`MYSQL_HOST` / `REDIS_HOST` 等环境变量目前只是被注入、无人消费。
2. **Flyway 迁移文件是死的**：`ai-service/src/main/resources/db/migration/V1__create_prompt_config.sql` 存在且语法正确，但没有 flyway 依赖 → 不会自动执行，`prompt_config` 表在真实库里并不存在。运行时的 Prompt 模板走的是 `application.yml` 里 `kili.copywriting.templates.*` 的内存配置（`ConfigurablePromptRepository`）。
3. **`/ws` 没有服务端**：nginx 已把 `/ws` 反代到 `127.0.0.1:18080`，前端 `lib/websocket.ts` 默认连同源 `/ws`（可用 `VITE_WS_URL` 覆盖），但后端没有 WebSocket starter 也没有 endpoint → 连接必然失败。这正是历史上「点击会话一直显示连接中 / 网络异常」的根因，前端已通过重试耗尽后显示「离线」来兜底。

`sql/init.sql` 只建库建用户（`kilisocial` + `kilisocial_app`，utf8mb4 / utf8mb4_unicode_ci），**刻意不建任何业务表**，并在注释里写明了后续建表必须遵守的规范（snake_case、`id BIGINT UNSIGNED AUTO_INCREMENT`、`created_at` / `updated_at` / `deleted_at`）。

> 补数据层的建议顺序：先加 `flyway-core` + `mysql-connector-j` 让 V1 真正生效 → 再加 `data-jpa` 与业务表迁移 → 然后 `data-redis` 接语义缓存（把 `InMemorySemanticCache` 换成 Redis 实现，接口 `SemanticCache` 已经抽好了）→ 最后 `starter-websocket` 实现 `/ws`。

---

## 7. 部署拓扑

### 7.1 容器（`docker-compose.yml`）

| 服务 | 容器名 | 镜像 / 构建 | 宿主端口 | 健康检查 |
| --- | --- | --- | --- | --- |
| app | `kilisocial_app` | `Dockerfile`（maven:3.9.9-temurin-17 构建 → temurin:17-jre 运行） | `127.0.0.1:18080` → 8080 | `curl /actuator/health`，10s/5s/12 次 |
| web | `kilisocial_web` | `Dockerfile.web`（node:20-alpine 构建 → nginx:1.27-alpine 托管） | `127.0.0.1:18081` → 8080 | `wget /`，10s/5s/5 次 |
| mysql | `kilisocial_mysql` | `mysql:8.0.32`，utf8mb4 + utf8mb4_unicode_ci | `127.0.0.1:13306` → 3306 | `mysqladmin ping`，10s/5s/5 次 |
| redis | `kilisocial_redis` | `redis:7.0`，**AOF 关闭**、RDB `save 60 1`、`requirepass` | `127.0.0.1:16379` → 6379 | `redis-cli ping | grep PONG` |

**所有端口都绑定 `127.0.0.1`**（可用 `*_BIND_HOST` / `*_PORT` 环境变量覆盖），刻意避让这台服务器上已有的其他项目——它们占用了 80/443/3306/6379/8080/8081。因此**不需要为本项目放行任何新的外网端口**，公网入口只有宿主 nginx 的 80/443。

后端 jar 用 `PropertiesLauncher` + `-Dloader.path=/app/libs` 加载其余 5 个模块 jar。`JAVA_OPTS` 默认 `-Xms256m -Xmx768m`（服务器剩余内存约 5G，已按此收敛）。

### 7.2 宿主 nginx（`deploy/nginx-social.conf`）

域名 `social.hengzhanwujin.com`，Let's Encrypt 证书由 certbot 管理。路由规则：

| location | 上游 |
| --- | --- |
| `/api/`、`/actuator/`、`/swagger-ui/`、`/v3/` | `127.0.0.1:18080`（Spring Boot） |
| `/ws` | `127.0.0.1:18080`，带 `Upgrade` / `Connection: upgrade`，读写超时 3600s |
| `/.well-known/acme-challenge/` | `/var/www/html`（保证续期可用） |
| `/`（其余全部） | `127.0.0.1:18081`（web 静态站） |
| 80 端口 | 301 跳转 https |

配置文件安装到 `/etc/nginx/conf.d/social.hengzhanwujin.com.conf`。

### 7.3 部署脚本

| 脚本 | 作用 |
| --- | --- |
| `scripts/init-deploy.sh` | **一键首次部署**：装 git/curl/docker → clone/pull 代码 → 生成 `.env`（缺失的 root/redis 密码用 `openssl rand -hex 16` 自动生成）→ 端口冲突检测 → `docker compose up -d --build` → 等 healthy（默认 240s）→ 装 nginx 配置（`nginx -t` 失败自动回滚）→ 冒烟测试 |
| `scripts/deploy.sh` | 日常更新：`docker compose --env-file .env up -d --build` |
| `scripts/stop.sh` | `docker compose --env-file .env down` |
| `scripts/logs.sh` | 跟踪 app 日志（`--tail=200 -f`） |

`init-deploy.sh` 可覆盖变量：`REPO_URL`（默认 GitHub 镜像）、`REPO_BRANCH`（默认 `master`）、`INSTALL_DIR`（默认 `/opt/kilisocial`，代码落在 `$INSTALL_DIR/skipper_social`）、`DOMAIN`、`HEALTH_TIMEOUT_SECONDS`。

脚本末尾有一段**域名归属自检**：如果 `https://$DOMAIN/actuator/health` 没返回本应用的 `"status":"UP"`，会直接 `die` 并提示「另一个 nginx server block 抢了这个域名」。历史上这台机器反复出现过「访问跳到别的项目」，就是靠这段兜住的。

---

## 8. 验证基线（2026-10-13 本机实测）

迁移到新环境后，请按 `03_ENVIRONMENT_SETUP.md` 复跑这两条，数字应当一致：

### 前端

```
pnpm test   # = vitest run --coverage
Test Files  105 passed (105)
     Tests  1852 passed (1852)
  Duration  132.74s
All files   | 97.84 % Stmts | 92.4 % Branch | 92.26 % Funcs | 97.84 % Lines
```

`pnpm typecheck`（`vue-tsc --noEmit`）与 `pnpm build`（`vite build`）均为 0 错误。

### 后端

```
mvn -s .mvn/settings.xml -o -B test
kili-social ............ SUCCESS      common ............ SUCCESS  (1 test)
app .................... SUCCESS (9)  ai-service ........ SUCCESS  (10)
wa-webhook-controller .. SUCCESS (8)  copywriting-service SUCCESS  (16)
wa-ai-integration ...... SUCCESS (5)
BUILD SUCCESS — 合计 49 个用例
```

> ⚠️ 上面这次运行**排除了 `JdkQwenHttpClientTest` 的 2 个用例**（`-Dtest=!JdkQwenHttpClientTest`）。原因见下一节，属于本机环境限制，不是代码问题；在正常 Linux/CI 环境下该测试类共 12 个用例应全部通过。

---

## 9. 已知问题与风险清单

### P0 — 迁移到新环境时必须先处理

1. **明文密钥已进 git 历史。** `app/src/main/resources/application.yml` 里 `kili.social.facebook.app-secret`、`kili.social.tiktok.client-secret` 是**真实测试凭证的明文**（用户在会话中主动提供并要求写入）。GitHub PAT 也曾以明文形式出现在推送命令里。处置步骤见 `04_SECRETS_HANDLING.md`。
2. **CI 从来没跑过。** `.github/workflows/ci.yml` 的触发条件是 `push: branches: [main, develop]` 和 `pull_request: branches: [main]`，但项目实际分支是 **`master`**。分支名不匹配 → workflow 永不触发。修法：把 `main` 改成 `master`（或同时保留）。
3. **后端无数据层**（第 6 节）。所有业务功能都只在前端示例数据里存在。

### P1 — 会在新环境立刻绊倒你

4. **`.mvn/settings.xml` 硬编码了绝对路径**：`<localRepository>C:/codex-workspace/kili-social/.m2/repository</localRepository>`。换机器或换目录后这个路径不存在，Maven 会去重新下载全部依赖（离线 `-o` 直接失败）。新环境要么改这一行，要么改用 `.mvn/settings-docker.xml`（容器构建用的那份），要么干脆 `-s` 指向自己的 settings。
5. **`Dockerfile.web` 构建不可复现**：里面是 `COPY web/package.json` + `npm install`，但仓库只有 `pnpm-lock.yaml`，没有 `package-lock.json`。npm 会按 semver 重新解析版本，构建结果随时间漂移，且和本地 pnpm 装的版本可能不一致。建议改成 `corepack enable && pnpm install --frozen-lockfile && pnpm build`，并把 `pnpm-lock.yaml` 一起 COPY 进去。
6. **`.tools/`、`.m2/`、`web/node_modules/` 都不在 git 里**。本机之所以能直接跑，是因为它们已经存在。新环境必须重新准备（`03_ENVIRONMENT_SETUP.md` 第 2 节）。
7. **Stripe 与项目边界冲突。** `PROJECT_BOUNDARIES.md` 明确把 `Stripe / PayPal / 加密货币支付` 列为 ❌ OUT OF SCOPE，而 IN SCOPE 的支付方案是 M-Pesa / Paystack。但 Sprint 5 的需求单点名要 Stripe test mode，于是前端做了 Stripe 形状的订阅/结账流程（`api/subscription.ts`、`stores/subscription.ts`、`views/checkout/demo.vue`，`VITE_STRIPE_PUBLIC_KEY` 仅存在于 `.env.example`，未硬编码真实 key）。**需要产品确认：要么补一份 RFC 把 Stripe 纳入范围，要么把这条链路改造成 M-Pesa / Paystack。**
8. **前端测试全绿 ≠ 功能可用。** 1852 个用例大量覆盖的是示例数据链路。验收任何"功能是否真的通了"，必须看它是否走到了真实后端。

### P2 — 技术债，可排期

9. `application.yml` 是唯一配置文件，**没有 dev/prod profile 分离**，生产配置和代码同仓。
10. `DEV_GUIDE.md` 要求「集成测试：Testcontainers 启动真实 MySQL/Redis」，**实际一个都没有**。
11. `web/src/i18n/messages.ts` 单文件 104KB，三语词典全部塞在一起，编辑冲突概率高，建议按模块拆分。
12. 本机 `web/src/views/error/` 是个**空目录且未入库**（真正在用的是 `views/errors/Forbidden.vue`），fresh clone 不会有，可忽略。
13. 根目录堆了 25 份 `*.md`（含 9 份 Sprint 扫描报告），阅读成本高，建议归档到 `docs/`。仓库共 470 个受版本控制的文件；`*.log` 已被 gitignore，根目录的 `testrun.log` 属本机残留、未入库。

---

## 10. 边界红线（务必遵守）

摘自 `PROJECT_BOUNDARIES.md`，原文为准：

- **✅ IN SCOPE**：WhatsApp Business API 官方对接、AI 文案/摘要/标签（Qwen-Turbo/Max）、M-Pesa / Paystack 支付、英语/法语/斯瓦希里语、Vue3 PWA + Android WebView 壳、单店铺单品牌管理。
- **❌ OUT OF SCOPE**：WA 个人号协议破解/模拟、AI 图片视频生成、通用型 CRM（工单/报表/团队协作）、Stripe / PayPal / 加密货币、iOS 原生与桌面客户端、多店铺聚合 / ERP / 库存。
- **🚫 NEVER DO**：存储明文密码或支付凭证、未经审核发送营销消息（防封号）、绕过官方 API 限制、收集非必要个人信息（NDPR/GDPR）、在生产环境测试支付/AI 计费接口。
- **⚠️ 变更控制**：任何超出 IN SCOPE 的需求必须提交 RFC，产品 + 技术双签。

> 注意：Sprint 7–13 实际做的「客户目录 / 数据分析 / 多租户 / RBAC / 工作流编排」已经明显超出「单店铺单品牌 + 非通用 CRM」的原始边界。这些是用户在会话中逐条下达并验收通过的，但**边界文档从未同步更新**。接手后建议补一次 RFC 或修订 `PROJECT_BOUNDARIES.md`，否则红线文档与实际产品已经脱节。

---

## 11. 文档索引

| 文档 | 内容 |
| --- | --- |
| `PRD.md` / `TECH_STACK.md` / `DEV_GUIDE.md` / `PROJECT_BOUNDARIES.md` / `ROADMAP.md` | 项目原始五件套。**`ROADMAP.md` 已过时**，`DEV_GUIDE.md` 仍是强制规范（命名/构造器注入/校验/脱敏/覆盖率） |
| `DESIGN_SYSTEM.md` | **v2.0（冻结）**：未来科技风 × 明亮色调 × 渐变强调 × 非洲元素克制点缀。所有 UI 迭代的唯一视觉基准，含完整色彩 token、字体、组件规范、动效、断点。取代了 v1.0 的暗色大地色方案 |
| `API_CONTRACT.md` | 前后端接口契约（响应信封、字段定义、超时/重试约定）。补后端时以此为准 |
| `DEPLOYMENT_GUIDE_ZH.md` / `ONE_CLICK_DEPLOY.md` / `README_CONTAINER.md` | 部署三件套：中文完整指南、一键部署说明、容器操作手册 |
| `ACCEPTANCE_CHECKLIST.md` / `ACCEPTANCE_CHECKLIST_CLIENT_V01.md` | 服务端与客户端 v0.1 的人工验收清单 |
| `SERVER_VALIDATION_CHECKLIST.md` | 服务器补验清单（compose 启动、utf8mb4、Flyway、冒烟 curl、Redis 连通） |
| `WA_WEBHOOK_INTEGRATION.md` / `WA_AI_INTEGRATION_TEST_PLAN.md` / `COPYWRITING_SERVICE_DESIGN.md` | Sprint 1 三份设计文档：Meta 后台配置 + curl 测试、端到端测试计划、Prompt 模板与缓存 Key 规则 |
| `CI_PIPELINE.md` | CI 设计说明（注意第 9 节 P0-2 的分支名问题） |
| `sprint-reports/*_MODULE_SCAN.md`（9 份，已归集到本目录） | 各 Sprint 的模块扫描/交付报告：ANALYTICS、CHANNEL、CONVERSATION、CUSTOMER、MARKETING、NOTIFICATION、SETTINGS、ORGANIZATION、WORKFLOW |
| `web/README.md` | 前端本地开发说明 |

---

## 12. 建议的下一步（新环境第一周）

按依赖顺序，前 3 项是阻塞项：

1. **轮换全部密钥**（`04_SECRETS_HANDLING.md`），并把 `application.yml` 里的明文改成 `${ENV_VAR:}` 占位。
2. **修 CI 分支名**（`main` → `master`），让流水线真正跑起来，拿到第一条绿色的 `mvn -B verify` 记录。
3. **打通数据层**：加 `flyway-core` + `mysql-connector-j`，让 `V1__create_prompt_config.sql` 真正执行；然后 `data-jpa` + 业务表迁移。
4. **实现 auth 接口**（`/api/v1/auth/login|register|refresh|me`），这是前端 `http.ts` 401 刷新链路和路由守卫的对端，也是所有受保护接口的地基。
5. **按 `API_CONTRACT.md` 逐个补业务接口**，优先级建议：conversations → messages → customers → channels → analytics。每补一个，就把对应前端 api 模块从 demo 分支切到真实链路，并补一条集成测试。
6. **实现 `/ws`**（`spring-boot-starter-websocket`），让收件箱和通知的实时更新真正工作，nginx 侧已经就绪。
7. **补 Testcontainers 集成测试**，兑现 `DEV_GUIDE.md` 的要求。
8. **产品决策**：Stripe 还是 M-Pesa/Paystack；边界文档是否需要修订。
