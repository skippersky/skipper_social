# 01 · 新接手人 / 新模型上手简报

> 这份文档写给**完全没有上下文**的接手者（人类工程师或 AI 编码助手）。
> 读完本文 + `00_INDEX.md` 指向的必读项，你就应该能独立继续开发。
> 全程约需 40 分钟阅读 + 20 分钟跑通验证。

---

## 1. 你在接手什么

**KiliSocial** 是一个面向非洲小微卖家的社交电商运营工具。核心价值链：

```
卖家注册 → 连接社交渠道（WhatsApp / Facebook / Instagram / TikTok）
        → 客户消息进入统一收件箱
        → AI（通义千问 Qwen）辅助生成回复与营销文案
        → 一键分发 / 自动化工作流 / 批量营销
        → 客户目录 + 数据分析 + 订阅付费
```

目标市场语言：英语、法语、斯瓦希里语（UI 已支持 en / zh / fr 三语，zh 是给运营方看的）。

**当前状态一句话**：前端做到了「看起来完整」（13 个 Sprint、40+ 路由、1852 个测试全绿），后端只做了「跑得起来的骨架」（4 个真实接口、无数据库连接）。你的主要工作大概率是**把后端补齐**，让前端从示例数据切换到真实数据。

---

## 2. 必读顺序

| 顺序 | 文档 | 为什么必读 |
| --- | --- | --- |
| 1 | 本文（`01_AI_AGENT_ONBOARDING.md`） | 定位、约束、工作方式 |
| 2 | `02_PROJECT_HANDOFF.md` | 项目全貌：进度表、架构、风险、下一步 |
| 3 | `06_BACKEND_API_GAP_ANALYSIS.md` | **159 个前端期望接口 vs 4 个真实接口**的完整清单，就是你的待办列表 |
| 4 | `03_ENVIRONMENT_SETUP.md` | 把项目在本机跑起来，并复现验证基线 |
| 5 | `05_COLLABORATION_PROTOCOL.md` | 用户的工作节奏与交付标准，照做能省掉大量返工 |
| 6 | `07_FRONTEND_MODULE_MAP.md` | 改前端时快速定位文件 |
| 7 | `04_SECRETS_HANDLING.md` | 密钥在哪、哪些已泄露、怎么轮换 |

按需查阅：`08_DECISION_LOG.md`（为什么当初这么做）、`09_TESTING_GUIDE.md`（怎么写测试）、`10_OPEN_ISSUES_BACKLOG.md`（已知问题）、`11_GLOSSARY.md`（术语）。

项目根目录还有几份**规范类文档不在本文件夹内**，但同样是硬约束：

- `DEV_GUIDE.md` — Java 研发规范（命名、构造器注入、校验、脱敏、数据库规范、覆盖率门禁）
- `PROJECT_BOUNDARIES.md` — 范围红线
- `DESIGN_SYSTEM.md` — 前端视觉基准 v2.0（**已冻结**）
- `API_CONTRACT.md` — 接口契约
- `TECH_STACK.md` / `PRD.md` / `ROADMAP.md`（ROADMAP 已过时，见 `08_DECISION_LOG.md`）

---

## 3. 硬性约束（违反会被打回）

### 3.1 代码规范

- **后端**：严格遵守 `DEV_GUIDE.md`。要点：包名 `com.kilisocial.{module}.{layer}`；**禁止 `@Autowired` 字段注入，一律构造器注入**；所有外部输入与 LLM 输出必须经 Hibernate Validator 校验；自定义 `BusinessException` + `GlobalExceptionHandler` 统一响应；公共方法必须有 Javadoc；日志中手机号/Token 必须掩码（已有 `PhoneMasker`，直接复用）。
- **数据库**：表名字段名 snake_case，禁用 MySQL 保留字；主键 `BIGINT UNSIGNED AUTO_INCREMENT`（**禁止 UUID 做聚簇索引**）；每张业务表必须有 `id / created_at / updated_at / deleted_at`；禁止 `SELECT *`；`UPDATE/DELETE` 必须带 `WHERE`。参照物：`ai-service/src/main/resources/db/migration/V1__create_prompt_config.sql`。
- **前端**：所有颜色/字体/间距/圆角必须引用 `DESIGN_SYSTEM.md` 的 token（CSS 变量前缀 `--ks-*`），**禁止引入未定义的色值**。组件用 Vant 4 + 现有 `components/` 封装，不要新引 UI 库。
- **响应信封**：所有后端接口一律返回 `common` 模块的 `ApiResponse<T>`，即 `{ success, code, message, data, timestamp }`。前端 `http.ts` 的 `unwrap()` 依赖这个结构，不一致会导致全站解析失败。
- **多租户**：任何业务接口都必须读取 `X-Organization-Id` 请求头做数据隔离（前端 `http.ts` 已自动注入）。

### 3.2 覆盖率门禁（CI 会拦）

- 后端：JaCoCo `BUNDLE / LINE ≥ 0.80`，`mvn verify` 阶段校验；Checkstyle 0 violation。
- 前端：`vite.config.ts` 中 `lines/statements ≥ 80`、`functions/branches ≥ 70`，`pnpm test` 直接失败。

### 3.3 范围红线（`PROJECT_BOUNDARIES.md`）

- 🚫 永久禁止：存储明文密码/支付凭证、未经审核发送营销消息（防封号）、绕过官方 API 限制、收集非必要个人信息、在生产环境测试支付/AI 计费接口。
- ❌ 原始 OUT OF SCOPE：WA 个人号协议破解、AI 图片/视频生成、通用型 CRM、Stripe/PayPal/加密货币、iOS 原生、多店铺聚合/ERP。
- ⚠️ 超出范围的需求必须有 RFC，产品 + 技术双签。

> 现实提醒：Sprint 7–13 做的客户目录/数据分析/多租户/RBAC/工作流**已经超出**原始边界（是用户逐条下达并验收的，但边界文档没同步）。Sprint 5 的 Stripe 结账流程同样与红线冲突。**遇到这类矛盾，先问用户，不要自行判断。** 详见 `10_OPEN_ISSUES_BACKLOG.md`。

### 3.4 运行环境约束

- **不得连接任何真实第三方服务做测试**（Qwen / Meta / TikTok / WhatsApp）。所有外部调用必须 Mock。这是从 Sprint 0 就定下的规矩。
- 单元测试必须**离线可跑**（本机没有 MySQL/Redis 也能 `mvn test` 全绿）。
- 部署服务器内存有限（剩余约 5G）且**跑着其他项目**，端口必须避让，容器一律绑 `127.0.0.1`。

---

## 4. 三个最容易踩的坑

1. **「前端测试全绿」不代表功能通了。** 前端 1852 个用例大量覆盖的是示例数据链路。判断一个功能是否真的可用，要看它是否走到了真实后端接口。降级机制见 `02_PROJECT_HANDOFF.md` 第 5 节。
2. **`master` 不是 `main`。** 分支是 `master`；CI 却按 `main`/`develop` 触发，所以流水线从来没跑过。而且 `origin` 指向内网 GitLab，推 GitHub 必须显式写完整 URL + PAT（PAT 需 `workflow` scope）。
3. **`.mvn/settings.xml` 里硬编码了旧机器的绝对路径**（`C:/codex-workspace/kili-social/.m2/repository`）。换机器后必须先改这一行，否则离线构建直接失败。

---

## 5. 你的工作方式

### 5.1 接到任务时

用户习惯用固定格式的 Sprint 需求单下达任务（模板见 `05_COLLABORATION_PROTOCOL.md`），通常包含：Context（前置状态）、强制约束、Task（编号列表）、Acceptance Evidence（验收证据）、注意（禁止事项）。

**开工前先确认三件事**：
1. 「注意」里的禁止事项有没有和你打算做的事冲突；
2. Acceptance Evidence 要求的证据你能不能真的产出（比如要求覆盖率数值，就必须真跑一遍）；
3. 任务是否超出 `PROJECT_BOUNDARIES.md`，若超出先问。

### 5.2 交付时

- **必须给运行时证据**，不能只交代码。这是用户从 Sprint 0 就反复强调的：测试报告数值、命令实际输出、日志片段、截图。
- 证据要是真实执行结果。禁止用正则扫描代替 Checkstyle 执行、禁止编造覆盖率数字。
- 报告用中文，结构：做了什么 → 证据 → 遗留问题/风险。别堆砌细节，控制在几十行内。

### 5.3 提交代码时

- **默认由用户自己执行 git 提交**。你负责给出准确的提交命令和 commit message（用户明确要求过：以你生成的备注为准）。
- 提交信息用英文小写祈使句，与既有历史风格一致，例如：
  `web sprint 13: multi tenancy and rbac with org switcher members roles settings onboarding invitations route guards and permission directive`
- 推送命令固定为：

```bash
git push https://skippersky:<PAT>@github.com/skippersky/skipper_social.git master
```

- 一次 Sprint 一个提交（历史上都是这样），不要拆成碎片提交。

---

## 6. 建议的第一个任务

如果用户没有指定，按这个顺序推进最有价值（完整理由见 `02_PROJECT_HANDOFF.md` 第 12 节）：

1. 修 CI 触发分支 `main` → `master`，拿到第一条绿色流水线。
2. 轮换密钥 + 把 `application.yml` 明文改成 `${ENV:}` 占位（`04_SECRETS_HANDLING.md`）。
3. 加 `flyway-core` + `mysql-connector-j`，让 `V1__create_prompt_config.sql` 真正执行。
4. 实现 `/api/v1/auth/*`（login / register / refresh / me），这是前端 401 刷新链路和路由守卫的对端。
5. 按 `06_BACKEND_API_GAP_ANALYSIS.md` 的优先级逐个补业务接口。

---

## 7. 上手自检清单

全部打勾说明你已经真正接手了：

- [ ] 能说出后端目前真实存在的 4 个接口是哪 4 个
- [ ] 能解释前端「示例数据降级」是怎么触发的（`isMissingBackend` → `ks-demo-mode`）
- [ ] 能说出为什么 MySQL/Redis 容器在跑但应用不连它们
- [ ] 能说出 `/ws` 为什么连不上
- [ ] 知道推送代码的正确命令和 PAT 需要的 scope
- [ ] 知道 `.mvn/settings.xml` 需要先改什么
- [ ] 本机 `mvn -B verify` 与 `pnpm test` 都跑通并达到基线数字
- [ ] 知道哪些密钥已经泄露、需要轮换
- [ ] 读过 `DEV_GUIDE.md`、`PROJECT_BOUNDARIES.md`、`DESIGN_SYSTEM.md`
- [ ] 知道交付必须附运行时证据
