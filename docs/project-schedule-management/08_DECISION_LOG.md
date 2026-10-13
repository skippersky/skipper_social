# 08 · 决策日志（为什么当初这么做）

> ADR 风格的轻量记录。每条包含：背景 → 决策 → 理由 → 后果/代价。
> 目的：让接手人不要「好心」把已经权衡过的选择改回去。

---

## D-01 前端用 Vue 3 + Vite，不是 Next.js

- **背景**：早期 Sprint 2b 的需求单里写的是 `Next.js 14 (App Router) + shadcn/ui`，但 `PROJECT_BOUNDARIES.md` 的 IN SCOPE 写的是「Vue3 PWA + Android WebView 壳」，Sprint 4 起的需求单也明确改成了 `Vue 3 + Vite + Pinia + vue-router + Vant + TypeScript`。
- **决策**：全量采用 Vue 3 + Vite，UI 库用 Vant 4（移动端优先），不引入 shadcn/ui、不用 React。
- **理由**：目标是移动端 H5 + PWA + 未来套 Android WebView 壳，Vant 的移动端组件更贴合；SSR 对这个后台型产品没有价值。
- **后果**：早期需求单里的 Next.js/React 描述**全部作废**，看到时不要照着做。

## D-02 「示例数据降级」而不是「Mock Server」

- **背景**：从 Sprint 0 起就有硬约束——本地没有 MySQL / Redis / 任何真实第三方 API，`mvn test` 与 `pnpm test` 必须离线全绿。
- **决策**：不搭 Mock Server，而是在 `web/src/api/demo.ts` 等 4 个文件里内置示例数据源；`http.ts` 请求失败时由 `isMissingBackend()` 判定后端缺失，写入 `localStorage['ks-demo-mode']`，之后整个会话走示例数据，并在页面上显示可关闭的「示例数据」提示条。
- **理由**：零额外进程、可在生产构建里当兜底、示例数据同时充当测试夹具、UI 可以在后端就绪前完整验收。
- **代价**：**前端测试全绿 ≠ 功能真的通了**。1852 个用例大量覆盖的是 demo 链路。这是本项目最大的认知陷阱，写进了 `01_AI_AGENT_ONBOARDING.md` 第 4 节。
- **约束**：补后端时**不要删 demo 分支**，它是弱网兜底和测试夹具。

## D-03 自研 i18n，不用 vue-i18n

- **背景**：需要 en / zh / fr 三语（zh 给运营方，en/fr 给目标市场，斯瓦希里语目前只在 AI 文案模板里）。
- **决策**：`web/src/i18n/index.ts` 用一个 Pinia store 实现 `locale` / `setLocale()` / `t(key, params)`，词典是按模块拆分的普通 TS 对象（`messages.ts` 104KB、`marketing.ts`、`workflow.ts`、`organization.ts`）。
- **理由**：只需要扁平 key + `{name}` 插值 + 英文回落，vue-i18n 的复数/格式化/懒加载能力用不上，少一个依赖。
- **代价**：`messages.ts` 单文件过大，多人协作易冲突；没有 key 存在性校验，缺 key 只会静默回落。

## D-04 设计系统 v1 → v2 大转向（v1 已废弃）

- **背景**：v1.0 是「暗色大地色 + 非洲几何网格背景」方案（琥珀/赤陶/沙金 + 深棕炭黑）。用户验收后明确否决：**「整体 UI 风格过于简单、背景是棕色的网格，有点为了非洲元素而舍弃了整体的审美」**，并要求「未来科技风、UI 色调渐变、明亮色调」。
- **决策**：`DESIGN_SYSTEM.md` 升 v2.0 并**冻结**：明亮冷调亮白背景 `#F6F7FB`、主强调 `#F4633A`、品牌渐变 `linear-gradient(135deg,#FFB238,#F4633A)`、科技靛蓝点缀 `#5B5BD6`（面积 ≤10%）、非洲元素仅作克制点缀。定稿参数 `DESIGN_VARIANCE 7 / MOTION_INTENSITY 5 / VISUAL_DENSITY 6`。
- **理由**：用户明确说这是「长期大方向，后续 UI 迭代一律遵循」。
- **后果**：**不要再做暗色大地色方案，不要铺非洲几何网格背景。** 所有色值必须来自 `styles/tokens.css` 的 `--ks-*` 变量。

## D-05 容器端口全部非标 + 绑 127.0.0.1

- **背景**：部署服务器（Ubuntu 24.04，剩余内存约 5G）上**跑着其他项目**，已占用 80/443/3306/6379/8080/8081。用户明确要求容器隔离、不影响其他项目。
- **决策**：app 18080、web 18081、mysql 13306、redis 16379，全部 `127.0.0.1` 绑定，容器名统一 `kilisocial_` 前缀，数据卷落在仓库内 `./data/`。公网入口只有宿主 nginx 的 80/443。
- **理由**：端口零冲突、不暴露任何新外网端口、卸载只需 `docker compose down` + 删目录。
- **后果**：**不需要为本项目放行任何新的外网端口**；本地直连数据库要用 13306/16379 而不是默认端口。

## D-06 域名用 social.hengzhanwujin.com

- **背景**：最初配置里 TikTok redirect-uri 写的是 `merchant4.test.kilimax.com`，用户指出那是**其他项目的域名**，要求换成 `social.hengzhanwujin.com`。
- **决策**：nginx `server_name`、certbot 证书、`init-deploy.sh` 的 `DOMAIN` 默认值、`application.yml` 的 `kili.social.tiktok.redirect-uri` 全部统一到 `social.hengzhanwujin.com`。
- **后果**：`deploy/nginx-social.conf` 与该域名强绑定；换域名要同时改 nginx 配置、certbot、TikTok 后台回调、`init-deploy.sh` 默认值四处。

## D-07 双远程：内网 origin + GitHub 镜像

- **背景**：代码原本托管在内网 Git（`sz.git.egatee.cn`），**部署服务器访问不到内网**，无法 `git clone`。
- **决策**：把代码整体推到公网 GitHub `skippersky/skipper_social`，服务器从 GitHub 拉取；`origin` 仍指向内网。推送用显式 URL + PAT。
- **理由**：不改动服务器网络策略，成本最低。
- **后果**：
  - `git push origin master` **推不到 GitHub**，必须写完整 URL；
  - PAT 需要 `workflow` scope，否则含 `.github/workflows/` 的提交被 403 拒绝（踩过）；
  - `.github/workflows/ci.yml` 的触发分支写的是 `main`/`develop`，与实际 `master` 不匹配 → **CI 从未运行过**（P0，待修）；
  - 代码同时存在于公网，这是密钥泄露面扩大的直接原因（见 `04_SECRETS_HANDLING.md`）。

## D-08 `app` 模块从根 pom 拆出

- **背景**：最初启动类和根 pom 在一起，导致 `mvn spring-boot:run` 与多模块 reactor 冲突、Docker 里 jar 路径混乱。
- **决策**：提交 `c8cb1c5` 把启动模块抽成独立的 `app`，根 pom 只做 aggregator；`Dockerfile` 用 `PropertiesLauncher` + `-Dloader.path=/app/libs` 把其余 5 个模块 jar 挂进来。
- **后果**：本地起应用是 `mvn -pl app spring-boot:run`，**不是** `mvn spring-boot:run`（README 已修正）。

## D-09 Redis 只用 RDB，关闭 AOF

- **背景**：Sprint 0 任务 2 的需求单明确写「禁用 AOF 仅用 RDB（开发环境）」。
- **决策**：`redis-server --appendonly no --save 60 1 --requirepass $REDIS_PASSWORD`。
- **理由**：语义缓存（TTL 24h）丢了可以重算，不需要 AOF 的持久性保证；省磁盘 IO。
- **后果**：Redis 重启最多丢 60 秒数据。**如果将来把 Redis 用于业务队列或会话存储，必须重新评估这个决定。**

## D-10 WA 签名校验做成纯函数并跨模块复用

- **背景**：Sprint 1 需求单明确「签名验证使用已实现的纯函数工具类，禁止重复造轮子」。
- **决策**：`ai-service` 的 `WebhookSignatureVerifier` 实现 HMAC-SHA256 校验，`wa-webhook-controller` 直接依赖 `ai-service` 复用它（pom 里能看到这条依赖）。
- **后果**：`ai-service` 不只是「AI」模块，它还承载了社媒平台的通用安全工具。**重命名或拆分模块时注意这条依赖。**

## D-11 测试凭证写进 application.yml（已知不合规）

- **背景**：用户主动提供 Facebook / Instagram / TikTok 测试凭证，并明确要求「可以写进配置文件，这是我测试专用的 api」。
- **决策**：按用户要求写入 `app/src/main/resources/application.yml`（提交 `c8cb1c5` 起）。
- **后果**：违反 `DEV_GUIDE.md` 第 4 节与 `PROJECT_BOUNDARIES.md` 的红线，且仓库已推到公网 GitHub → **按已泄露处理，必须轮换**。详见 `04_SECRETS_HANDLING.md`。这不是技术选择，是待偿还的债。

## D-12 ROADMAP.md 未随实际迭代更新

- **背景**：根目录 `ROADMAP.md` 是最初的「8 周 4 冲刺」计划，复选框一个都没勾。
- **决策**：实际执行改用 Sprint 0–13 的连续编号（后端 0–1，前端 2b–13），ROADMAP 保留原样未改。
- **后果**：**两套编号并存，ROADMAP.md 已过时，不要以它为准。** 真实进度看 `02_PROJECT_HANDOFF.md` 第 4 节。
- **建议**：接手后要么重写 ROADMAP，要么在文件顶部加一行「已过时，见 docs/project-schedule-management/」。

## D-13 Stripe 结账流程（与边界冲突，未决）

- **背景**：`PROJECT_BOUNDARIES.md` 把 Stripe/PayPal 列为 ❌ OUT OF SCOPE，IN SCOPE 的支付方案是 M-Pesa / Paystack。但 Sprint 5 需求单点名要「Stripe 支付集成（test mode）」。
- **决策**：按需求单实现前端 Stripe 形状的订阅/结账流程（`api/subscription.ts`、`stores/subscription.ts`、`views/checkout/demo.vue`），走 demo 降级，未接真实 Stripe；`VITE_STRIPE_PUBLIC_KEY` 只在 `.env.example` 里留 `pk_test_REPLACE_ME` 占位。
- **后果**：**未决事项。** 补后端之前必须让产品明确：引入 Stripe（需补 RFC）还是改造成 M-Pesa/Paystack（非洲市场更合理）。在此之前不要动这 9 个接口。
