# KiliSocial Backend

Spring Boot 3 backend scaffold for the KiliSocial MVP.

## Handoff / 交接入口

| 文档 | 用途 |
| --- | --- |
| `docs/project-schedule-management/00_INDEX.md` | **交接总入口**：阅读顺序 + 全库文档地图 |
| `docs/project-schedule-management/02_PROJECT_HANDOFF.md` | 项目进度、架构现状、已知风险、下一步建议 |
| `docs/project-schedule-management/03_ENVIRONMENT_SETUP.md` | 新环境从零搭建、验证基线、服务器部署与运维 |
| `docs/project-schedule-management/04_SECRETS_HANDLING.md` | 密钥清单、已泄露项、轮换步骤 |
| `DESIGN_SYSTEM.md` | 前端视觉基准 v2.0（已冻结，所有 UI 迭代的唯一依据） |
| `API_CONTRACT.md` | 前后端接口契约，补后端时以此为准 |

> 本仓库同时包含后端（根目录各 Maven 模块）与前端（`web/`，Vue 3 + Vite + Pinia + Vant）。
> 前端本地开发说明见 `web/README.md`；部署见 `DEPLOYMENT_GUIDE_ZH.md` 与 `ONE_CLICK_DEPLOY.md`。

## Requirements

- JDK 17
- Maven 3.9+

## Local Commands

```powershell
mvn validate
mvn test
mvn -pl app spring-boot:run
```

Smoke-test endpoint:

```text
GET http://localhost:8080/api/v1/hello
GET http://localhost:8080/api/v1/hello?locale=sw
```
