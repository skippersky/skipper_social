# KiliSocial Web（客户端立项 v0.1）

Sprint 2 前端切片：消息编辑器 + 离线草稿（PWA，移动端 H5 优先）。纯后端 API 的配套客户端，技术栈遵循 TECH_STACK.md（Vue3 + Vite + Pinia）。

## 范围

- 消息编辑器：正文输入、en/sw 语言切换、AI 文案生成（POST /api/v1/ai/copywriting）、字数限制
- 草稿箱：IndexedDB 离线存储（localforage），断网可存可查；恢复编辑、删除
- PWA：manifest + service worker（vite-plugin-pwa autoUpdate）
- 发布入口：第三方平台账号审核中，编辑器内以通知条提示，发布链路后续 Sprint 接入

不在范围：登录鉴权（JWT/RBAC 后续 Sprint）、CRM、支付、业务管理台。

## 技术栈

Vue 3.4 + TypeScript + Vite 5 + Pinia + vue-router + Vant 4（移动端组件）+ localforage + vitest + @vue/test-utils + vite-plugin-pwa

## 目录

- src/views：EditorView / DraftsView
- src/stores/drafts.ts：草稿 store（离线持久化）
- src/api：统一 ApiResponse 信封客户端（与后端 GlobalExceptionHandler 输出一致）
- src/__tests__：vitest 用例

## 本地开发

```bash
cd web
pnpm install          # 或 npm install
pnpm dev              # http://localhost:5173，/api 代理到 127.0.0.1:18080
pnpm test             # vitest + 覆盖率门禁（lines/statements >= 80）
pnpm build            # 产出 dist + PWA 产物
```

## 部署

docker-compose.yml 的 `web` 服务：node 构建阶段 + nginx 运行时，宿主机端口 `127.0.0.1:18081`。
宿主 Nginx（deploy/nginx-social.conf）分流：`/` → 18081（静态），`/api|/actuator|/swagger-ui|/v3` → 18080（app）。

## 验收基线

- vitest 13 用例全过；覆盖率 statements 96.18% / branches 92.85% / functions 88%
- vite build 产出 manifest.webmanifest + sw.js
- 后端配套：POST /api/v1/ai/copywriting（copywriting-service），模板经 kili.copywriting.templates 配置，QWEN_API_KEY 缺失时返回 [CONTENT_UNAVAILABLE]，前端提示"AI 服务暂不可用"

## 后续路线

1. 发布队列 UI（WA/IG/FB/TikTok 账号绑定与发布状态）
2. 登录 + JWT（对齐 TECH_STACK 的 Spring Security 决策）
3. CRM 标签与看板（Sprint 3 配套）
