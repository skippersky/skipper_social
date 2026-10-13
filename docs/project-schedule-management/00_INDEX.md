# 00 · 交接总入口（先读这个）

> **KiliSocial** 项目管理与交接文档集。
> 基线：提交 `a53e62a`，分支 `master`，整理时间 2026-10-13。
>
> 目标：一个**完全没有上下文**的新环境（新机器 + 新工程师 / 新 AI 助手），只读本文件夹就能理解项目全貌并接着开发。

---

## 1. 最短上手路径（40 分钟）

| 步骤 | 读什么 | 得到什么 |
| --- | --- | --- |
| ① | `01_AI_AGENT_ONBOARDING.md` | 项目是什么、硬约束、工作方式、最容易踩的三个坑 |
| ② | `02_PROJECT_HANDOFF.md` 第 1、4、5、6 节 | 进度全貌、前后端落差、数据层缺口 |
| ③ | `06_BACKEND_API_GAP_ANALYSIS.md` 第 1、5 节 | 159 个待实现接口的总账 + 实现路线图 |
| ④ | `03_ENVIRONMENT_SETUP.md` 第 1–4 节 + 第 8 节清单 | 把项目在本机跑起来并复现基线 |

赶时间只读一条：**「前端功能完整、后端只有 4 个接口，你的工作主要是补后端」**，然后看 ③。

---

## 2. 本文档集清单

| 文件 | 内容 | 什么时候读 |
| --- | --- | --- |
| `00_INDEX.md` | 本文。总入口 + 全库文档地图 | 第一份 |
| `01_AI_AGENT_ONBOARDING.md` | 新接手人简报：定位、必读顺序、硬约束、工作方式、第一个任务、自检清单 | 上手第一份 |
| `02_PROJECT_HANDOFF.md` | **项目现状总览**：仓库与双远程、技术栈与目录、Sprint 0–13 进度表、前后端落差与降级机制、数据层缺口、部署拓扑、实测验证基线、P0/P1/P2 风险、边界红线、下一步建议 | 上手第二份 |
| `03_ENVIRONMENT_SETUP.md` | 新环境从零搭建：工具版本、获取代码、后端/前端本地开发、验证命令与预期输出、本地起 MySQL/Redis、服务器一键部署与运维、CI、就绪检查清单 | 搭环境时 |
| `04_SECRETS_HANDLING.md` | 密钥台账（只记位置不记明文）、已泄露项、六步轮换流程、是否清洗 git 历史的取舍、长期建议 | 搭环境后立刻 |
| `05_COLLABORATION_PROTOCOL.md` | 协作流程：Sprint 需求单格式、运行时证据标准、提交与推送约定、部署验收回路、部署没生效的排查顺序、用户最常提的四类反馈、什么时候该停下来问 | 开始接任务前 |
| `06_BACKEND_API_GAP_ANALYSIS.md` | **后端待办总账**：159 个前端期望接口 vs 4 个真实接口，按模块逐个列出，含实现约定、10 阶段路线图、最小数据表集、如何从 demo 反推响应契约 | 做后端时（常驻） |
| `07_FRONTEND_MODULE_MAP.md` | 前端地图：路由全表、两层路由守卫、9 个领域模块的 view/component/store/api/composable 对照、横切基础设施、快速定位表、已知结构冗余 | 改前端时（常驻） |
| `08_DECISION_LOG.md` | 13 条架构决策（ADR 风格）：背景 → 决策 → 理由 → 代价。避免把权衡过的选择改回去 | 想改架构时 |
| `09_TESTING_GUIDE.md` | 测试规范：门禁数值、后端测试风格（AssertJ + 可注入接缝）、前端测试写法（stubFetch + setup.ts 约定）、新增模块的测试清单、怎么给证据 | 写测试时 |
| `10_OPEN_ISSUES_BACKLOG.md` | 已知问题与待办：5 项 P0 阻塞、12 项验收过的功能问题（含已修/未修）、14 项技术债、5 项待产品决策、ROADMAP 未启动项 | 排期时 |
| `11_GLOSSARY.md` | 术语表：产品/语言/平台/AI/业务/支付/技术 + 缩写速查 | 看不懂名词时 |
| `sprint-reports/` | 9 份 Sprint 交付扫描报告（ANALYTICS / CHANNEL / CONVERSATION / CUSTOMER / MARKETING / NOTIFICATION / ORGANIZATION / SETTINGS / WORKFLOW） | 深挖某个模块的实现细节与设计取舍时 |

---

## 3. 仓库其他文档（仍在根目录，同样是硬约束）

这些是项目的「宪法」与专项说明，**没有搬进本文件夹**，因为 `README.md`、CI、脚本与文档之间存在既有引用。

### 3.1 规范类（必读，硬约束）

| 文件 | 内容 |
| --- | --- |
| `DEV_GUIDE.md` | Java 研发规范（阿里手册风格）：命名、构造器注入、输入校验、异常处理、数据库规范、安全规范、测试与 CI 门禁 |
| `PROJECT_BOUNDARIES.md` | 范围红线：IN SCOPE / OUT OF SCOPE / NEVER DO / 变更控制（超范围需 RFC 双签） |
| `DESIGN_SYSTEM.md` | **v2.0 已冻结**：未来科技风 × 明亮色调 × 渐变强调 × 非洲元素克制点缀。完整色彩 token、字体、组件规范、动效、断点、暗色模式。所有 UI 迭代的唯一视觉基准 |
| `API_CONTRACT.md` | 前后端接口契约：响应信封、字段定义、超时/重试约定（Sprint 3 目标，覆盖 conversations/messages） |
| `TECH_STACK.md` | 技术选型说明 |
| `PRD.md` | 产品需求 |
| `ROADMAP.md` | ⚠️ **已过时**：原始「8 周 4 冲刺」计划，复选框全未勾。实际进度看 `02_PROJECT_HANDOFF.md` 第 4 节 |

### 3.2 部署与验收类

| 文件 | 内容 |
| --- | --- |
| `DEPLOYMENT_GUIDE_ZH.md` | 中文完整部署指南 |
| `ONE_CLICK_DEPLOY.md` | 一键部署说明（`scripts/init-deploy.sh`） |
| `README_CONTAINER.md` | 容器操作手册（启动/停止/重置） |
| `SERVER_VALIDATION_CHECKLIST.md` | 服务器补验清单（compose 启动、utf8mb4、Flyway、冒烟 curl、Redis 连通）。**被 `.github/workflows/ci.yml` 引用**，移动需同步改 CI |
| `ACCEPTANCE_CHECKLIST.md` | 服务端人工验收清单 |
| `ACCEPTANCE_CHECKLIST_CLIENT_V01.md` | 客户端 v0.1 人工验收清单 |
| `CI_PIPELINE.md` | CI 设计说明（注意 CI 目前因分支名不匹配从未运行） |

### 3.3 Sprint 1 设计文档

| 文件 | 内容 |
| --- | --- |
| `COPYWRITING_SERVICE_DESIGN.md` | 文案服务设计：Prompt 模板示例（en/swahili 双语）、语义缓存 Key 规则、错误码与降级响应格式 |
| `WA_WEBHOOK_INTEGRATION.md` | WhatsApp Webhook 集成：Meta 后台配置步骤 + curl 测试命令 |
| `WA_AI_INTEGRATION_TEST_PLAN.md` | WA 消息 → AI 文案的端到端测试计划与预期日志 |

### 3.4 代码内文档

| 文件 | 内容 |
| --- | --- |
| `README.md` | 仓库说明，顶部已加「交接入口」表指向本文件夹 |
| `web/README.md` | 前端本地开发说明 |

---

## 4. 一分钟项目速览

```
产品    KiliSocial — 非洲小微卖家的社交电商运营工具
链路    注册 → 连接渠道(WA/FB/IG/TikTok) → 统一收件箱 → AI 辅助回复/文案
        → 一键分发 / 自动化工作流 / 批量营销 → 客户目录 + 数据分析 + 订阅付费
后端    Spring Boot 3.3.5 / JDK 17 / Maven 6 模块 / Checkstyle + JaCoCo(LINE>=0.80)
        真实接口 4 个，无数据层依赖（MySQL/Redis 容器空转）
前端    Vue 3.4 + Vite 5 + Pinia + Vant 4 + TS / 52 view / 71 组件 / 16 store / 31 composable
        105 测试文件 1852 用例全绿，覆盖率 97.84%
        159 个接口调用，158 个走「示例数据降级」
部署    Ubuntu 24.04 / docker compose 4 容器 / 全绑 127.0.0.1 非标端口
        域名 social.hengzhanwujin.com（宿主 nginx + certbot TLS）
仓库    origin=内网 GitLab（服务器访问不到）；部署源=GitHub skippersky/skipper_social；分支 master
风险    明文密钥已进 git 历史（P0）；CI 因分支名不匹配从未运行（P0）；后端 158 个接口待补
```

---

## 5. 维护约定

- 本文件夹是**活的**。每完成一个 Sprint，请更新 `02_PROJECT_HANDOFF.md` 第 4 节进度表，并把交付报告放进 `sprint-reports/`。
- 每修一个 P0/P1，请更新 `10_OPEN_ISSUES_BACKLOG.md` 的状态列。
- 每做一个新的架构选择，请在 `08_DECISION_LOG.md` 追加一条 D-xx。
- 后端每实现一批接口，请更新 `06_BACKEND_API_GAP_ANALYSIS.md` 的 🔴 → ✅。
- 文档里的数字（测试数、覆盖率、接口数）都是**实测值**，改动代码后请重新跑一遍再更新，不要估算。
