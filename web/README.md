# KiliSocial Web（客户端 v0.2）

Sprint 2b 前端：首页入口 + 会话工作台骨架 + 消息编辑器 + 离线草稿（PWA，移动端 H5 优先）。技术栈遵循 TECH_STACK.md（Vue3 + Vite + Pinia），视觉遵循 DESIGN_SYSTEM.md v1.0（暖色调暗色主题，非洲元素克制应用）。

## 范围

- 首页（/）：品牌首屏 + 进入会话 / AI 文案工作台 / 草稿箱入口
- 会话工作台（/chat）：Chakra Chat 式双栏（会话列表 + 聊天窗口占位），移动端单栏 + 返回切换；数据为 Mock 兜底，GET /api/v1/conversations 就绪后自动切换
- WebSocket 客户端（lib/websocket.ts）：conversation_update 事件 + 指数退避重连（1s→30s 封顶），后端未就绪时静默降级不报错
- 消息编辑器（/editor）：正文输入、en/sw 语言切换、AI 文案生成（POST /api/v1/ai/copywriting）、字数限制
- 草稿箱（/drafts）：IndexedDB 离线存储（localforage），断网可存可查；恢复编辑、删除
- 设计系统落地：src/styles/tokens.css（--ks-* 令牌 + --van-* 覆盖）、PWA theme_color #16100D、Sora 标题字体、全局 focus-visible 与 prefers-reduced-motion
- PWA：manifest + service worker（vite-plugin-pwa autoUpdate）

不在范围：消息真实收发（Sprint 3）、登录鉴权（JWT/RBAC 后续 Sprint）、CRM、支付。

## 技术栈

Vue 3.4 + TypeScript + Vite 5 + Pinia + vue-router + Vant 4（移动端组件）+ localforage + vitest + @vue/test-utils + vite-plugin-pwa

说明：Sprint 2b 原始 prompt 提议 Next.js 14 + Tailwind + shadcn/ui，经评估与 TECH_STACK.md / 现有部署管线冲突，已按既定 Vue 技术栈实现等价能力；环境变量沿用 VITE_API_BASE（nginx 同源代理 /api）。

## 目录

- src/views：HomeView / ChatView / EditorView / DraftsView
- src/components：ConversationList / ChatWindow / KsAvatar
- src/stores/drafts.ts：草稿 store（离线持久化）
- src/api：统一 ApiResponse 信封客户端（与后端 GlobalExceptionHandler 输出一致）
- src/lib：websocket.ts（重连客户端）、relativeTime.ts
- src/types：Conversation / Message 契约
- src/styles/tokens.css：设计令牌唯一来源
- src/__tests__：vitest 用例

## 本地开发

```bash
cd web
pnpm install          # 或 npm install
pnpm dev              # http://localhost:5173，/api 代理到 127.0.0.1:18080
pnpm test             # vitest + 覆盖率门禁（lines/statements >= 80）
pnpm typecheck        # vue-tsc --noEmit
pnpm build            # 产出 dist + PWA 产物
```

## 部署

docker-compose.yml 的 `web` 服务：node 构建阶段 + nginx 运行时，宿主机端口 `127.0.0.1:18081`。
宿主 Nginx（deploy/nginx-social.conf）分流：`/` → 18081（静态），`/api|/actuator|/swagger-ui|/v3` → 18080（app）。

## 验收基线

- vitest 47 用例全过；覆盖率 statements 95.76% / branches 90.62% / functions 91.66%
- vue-tsc 类型检查零错误
- vite build 产出 manifest.webmanifest + sw.js（theme_color #16100D）
- 后端配套：POST /api/v1/ai/copywriting（copywriting-service），QWEN_API_KEY 缺失时返回 [CONTENT_UNAVAILABLE]，前端提示"AI 服务暂不可用"

## 后续路线

1. Sprint 3：消息真实收发（GET /api/v1/conversations + WebSocket 事件契约对齐）
2. 发布队列 UI（WA/IG/FB/TikTok 账号绑定与发布状态）
3. 登录 + JWT（对齐 TECH_STACK 的 Spring Security 决策）