# 10 · 已知问题与待办清单

> 状态截至基线提交 `a53e62a`（2026-10-13）。分四类：阻塞项 / 功能问题 / 技术债 / 待产品决策。
> 优先级：P0 阻塞交付，P1 会绊倒人，P2 可排期。

---

## A. 阻塞项（P0，动手前必须处理）

| # | 问题 | 影响 | 处理 |
| --- | --- | --- | --- |
| A1 | `application.yml` 里 FB `app-secret`、TikTok `client-secret` 是明文真实值，自提交 `c8cb1c5` 起在 git 历史里，仓库已推到公网 GitHub | 凭证泄露 | 轮换 + 改 `${ENV:}` 占位，见 `04_SECRETS_HANDLING.md` |
| A2 | GitHub PAT 曾在明文对话与命令行中出现 | 账号风险 | Revoke 重发，新 token 需 `repo` + `workflow` scope |
| A3 | `.github/workflows/ci.yml` 触发分支是 `main`/`develop`，实际分支是 `master` | **CI 从未运行过**，所有门禁形同虚设 | 改成 `master`（或加上 `master`） |
| A4 | 后端 pom 无任何数据层依赖（JPA/JDBC/MySQL/Redis/Flyway/WebSocket 全缺） | MySQL/Redis 容器空转，`V1` 迁移不会执行，`/ws` 无服务端 | 见 `06_BACKEND_API_GAP_ANALYSIS.md` 第 5 节路线图 |
| A5 | 159 个前端接口里 158 个后端未实现 | 全部功能跑在示例数据上 | 同上 |

---

## B. 功能问题（验收过程中出现过的）

| # | 现象 | 根因 | 状态 |
| --- | --- | --- | --- |
| B1 | 点击会话一直显示「连接中」/「网络异常」 | 后端没有 `/ws` 端点（无 `spring-boot-starter-websocket`），nginx 已反代但对端不存在 | 🔴 **未解决**。前端已做兜底：重试耗尽后显示「离线」（提交 `c7573d0`）。真正修复要等 A4 |
| B2 | 首页「简单定价」三个套餐卡片点不动 | 卡片没绑跳转 | ✅ 已修（`51288b6`：卡片可点并把所选套餐带进升级流程） |
| B3 | 「AI 文案工作台」「草稿箱」没有返回按钮 | 页面缺导航出口 | ✅ 已修（`c7573d0`） |
| B4 | 会话台展示示例数据但无任何标识，用户误以为是真实数据 | 缺提示条 | ✅ 已修（`b83d870` / `88e4d67`：可关闭的 `van-notice-bar` + 空状态兜底） |
| B5 | 渠道管理页点「连接」后没有填凭证的入口 | Provider 缺手动凭证模式 | ✅ 已修（`b83d870`：`CredentialFormDialog.vue` + `getRequiredCredentials()`） |
| B6 | 注册成功直接跳会话台，新用户面对空数据 | 跳转目标不合理 | ✅ 已修（`b83d870`：改跳 `/dashboard/channels?first_login=true` + 新手引导） |
| B7 | 页面内容全挤在中间、左右空旷 | 桌面端没用满宽度 | 🟡 部分修复（`e8caec6` 渠道页改两栏、`0b8257e` 桌面端多列布局）。**新页面要主动检查这一点**，用户对此敏感 |
| B8 | UI 风格过于简单、棕色网格背景难看 | v1 设计方向问题 | ✅ 已重做（`0b8257e` 明亮未来科技风 + 三语 i18n + `DESIGN_SYSTEM.md` v2.0）。见 `08_DECISION_LOG.md` D-04 |
| B9 | 访问域名跳到了其他项目 | 宿主 nginx 有别的 server block 抢 `server_name` | 🟡 已缓解（`9103428`：`init-deploy.sh` 内置重复检测 + `nginx -t` 失败回滚 + 域名归属冒烟自检）。换机器部署时仍需按 `05_COLLABORATION_PROTOCOL.md` 第 5.2 节排查 |
| B10 | `curl` 拉 `raw.githubusercontent.com` SSL 超时 | 服务器到 GitHub raw 的网络不稳 | ✅ 已缓解（`init-deploy.sh` 支持先 SSH clone 再跑仓库内脚本） |
| B11 | `source .env` 报 `-Xmx768m: command not found` | 早期 `.env` 里 `JAVA_OPTS` 值没加引号 | ✅ 已修（现 `.env.example` 是 `JAVA_OPTS="-Xms256m -Xmx768m"`）。服务器上的旧 `.env` 需手工补引号 |
| B12 | `git commit -m "..."` 报 `unknown switch 'm'` / `pathspec 'X.mdgit'` | 多行命令被粘成一行 | ✅ 规避方式：给用户**单行**命令（见 `05_COLLABORATION_PROTOCOL.md` 第 4.1 节） |

---

## C. 技术债（P1/P2）

| # | 项 | 说明 | 建议 |
| --- | --- | --- | --- |
| C1 | `api/conversation.ts` 与 `api/conversations.ts` 并存且路径重叠 | Sprint 2c 与 Sprint 6 分别产出 | 补后端时合并为一个模块，同步改测试 |
| C2 | `components/ConversationList.vue`（根级）与 `components/conversation/ConversationList.vue` 同名不同物 | Sprint 2b 与 Sprint 6 | 重命名根级那个（如 `LegacyConversationList.vue`）或删除 |
| C3 | `views/SettingsProfileView.vue` / `SettingsSecurityView.vue`（Sprint 3）与 `views/dashboard/settings/*Tab.vue`（Sprint 10）同时在路由里 | 两套设置页 | 确认哪套是正式入口，另一套下线 |
| C4 | `api/settings.ts` 的 profile/channels 与 `api/auth.ts` 的 `PUT /me`、`api/channel.ts` 职责重叠 | 分 Sprint 增量交付的自然结果 | 后端实现时统一到单一领域服务 |
| C5 | `i18n/messages.ts` 单文件 104KB | 三语词典全塞一起 | 按模块拆分，与 `marketing.ts`/`workflow.ts`/`organization.ts` 的做法对齐 |
| C6 | 没有任何集成测试 | `DEV_GUIDE.md` 要求 Testcontainers | 补数据层时一并补 `*IT.java` + failsafe |
| C7 | `application.yml` 无 dev/prod profile 分离 | 生产配置与代码同仓 | 引入 `application-{profile}.yml`，机密全部走环境变量 |
| C8 | `Dockerfile.web` 用 `npm install` 但仓库只有 `pnpm-lock.yaml` | 构建不可复现，版本随 semver 漂移 | 改 `corepack enable && pnpm install --frozen-lockfile`，并 COPY 锁文件 |
| C9 | `.mvn/settings.xml` 硬编码绝对路径 `C:/codex-workspace/kili-social/.m2/repository` | 换机器即失效 | 删掉该行用默认，或改为相对/环境变量 |
| C10 | `ROADMAP.md` 过时，与实际 Sprint 0–13 编号体系脱节 | 两套编号并存易误解 | 重写，或顶部加「已过时」提示 |
| C11 | `PROJECT_BOUNDARIES.md` 与实际产品脱节 | Sprint 7–13 的客户目录/数据分析/多租户/RBAC/工作流已超出「单店铺 + 非通用 CRM」的原始边界 | 补 RFC 或修订边界文档 |
| C12 | 根目录仍有 18 份 `.md` | 规范类 + 部署类 + 验收类混放 | 可继续归档到 `docs/`（注意 `SERVER_VALIDATION_CHECKLIST.md` 被 `ci.yml` 引用，移动要同步改 CI） |
| C13 | `web/src/views/error/` 是空的本地残留目录 | 未入库，fresh clone 没有 | 本机删掉即可 |
| C14 | 后端 `JdkQwenHttpClientTest` 在受限沙箱环境跑不了 | `com.sun.net.httpserver.HttpServer` 建不了回环连接 | 环境问题，非代码缺陷；正常 Linux/CI 应通过。见 `03_ENVIRONMENT_SETUP.md` 第 3.4 节 |

---

## D. 待产品决策（动手前必须问）

| # | 议题 | 冲突点 |
| --- | --- | --- |
| D1 | 支付渠道走 Stripe 还是 M-Pesa / Paystack | `PROJECT_BOUNDARIES.md` 把 Stripe 列为 OUT OF SCOPE，IN SCOPE 是 M-Pesa/Paystack；但 Sprint 5 需求单点名要 Stripe test mode。影响 9 个接口 |
| D2 | 第三方平台账号审核状态 | Meta / TikTok / WhatsApp 的开放平台账号审核在用户侧推进中，未获批前所有渠道对接只能停在 demo |
| D3 | UI 是否要加斯瓦希里语 | 目标市场语言含 sw，AI 文案模板已有 `sw`，但 UI i18n 只有 en/zh/fr |
| D4 | 多租户是否属于 MVP | 原始边界写「单店铺/单品牌管理」，Sprint 13 已做多租户 + RBAC。要么修订边界，要么砍掉 |
| D5 | 是否清洗 git 历史 | 见 `04_SECRETS_HANDLING.md` 第 3 节，建议不做，改为全量轮换 |

---

## E. ROADMAP 里规划但从未启动的

- WhatsApp 消息队列（BullMQ + 重试 + 死信）
- IG / FB Graph API 真实发布集成（配置已就绪，代码未实现）
- 弱网模拟测试 + 送达率监控
- M-Pesa / Paystack 支付回调 + 订阅管理 + 额度扣减原子事务 + 账单推送
- 对话摘要 + 意图识别 API（Sprint 1 只做了文案生成）
- Prompt 版本管理 UI + 快照测试（表结构已设计，无 UI）
- AI 接口压测（P99 < 100ms、100 条消息压测无丢失）
- Android WebView 壳
- 安全审计（RLS / 密钥轮换 / 渗透测试）
- 种子用户邀请与反馈收集
