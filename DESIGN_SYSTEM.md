# KiliSocial Design System

> 版本 v1.0（冻结）。本文件是客户端所有 UI 开发的唯一视觉基准；修改需评审后升版本。
>
> 风格定位：科技风（futuristic / tech-forward）× 非洲元素（克制、抽象、现代）× 暖色调暗色主题。
> 对标产品：Chakra Chat（会话列表 + 聊天窗口双栏布局，响应式折叠）。
>
> 架构依据：仓库中无 CODEX.md / AGENTS.md，架构约定以 DEV_GUIDE.md、TECH_STACK.md、PROJECT_BOUNDARIES.md 为准。
> 技术基线：Vue 3 + Vite + Pinia + Vant 4，PWA，移动端 H5 优先（见 TECH_STACK.md）。
>
> 定稿参数：DESIGN_VARIANCE 7（有设计感但不夸张）｜ MOTION_INTENSITY 5（适度动效）｜ VISUAL_DENSITY 6（密度适中，留白合理）。

---

## 1. 色彩系统

深色（炭棕）为默认且唯一基准主题。所有色值以 CSS 变量 `--ks-*` 落地，映射表见第 9 节。

### 背景与层级

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| `bg.base` | `#16100D` | 全局背景（暖炭黑） |
| `bg.surface` | `#201914` | 卡片、侧栏、输入框容器（深棕） |
| `bg.elevated` | `#2A211A` | hover 提亮、浮层、联系人侧气泡 |
| `bg.overlay` | `rgba(0,0,0,0.55)` | 弹窗遮罩 |
| `border.default` | `rgba(244,237,228,0.10)` | 卡片/分隔线边框 |
| `border.input` | `rgba(244,237,228,0.14)` | 输入框边框 |

### 主色与辅色

| Token | 色值 | 使用场景 | 深底对比度 |
| --- | --- | --- | --- |
| `primary` | `#E8A33D` | 主按钮、选中态、链接、焦点环（琥珀） | 8.7:1 |
| `primary.hover` | `#F2B455` | 主按钮 hover | — |
| `primary.pressed` | `#D18F2C` | 主按钮按下 | — |
| `primary-ink` | `#241505` | 琥珀底上的文字/图标 | 8.2:1（对 primary） |
| `secondary` | `#E08B62` | 次级强调文字、文字链接（浅赤陶） | 6.6:1 |
| `ochre` | `#B5502E` | 仅图形装饰（赭红，3.4:1，禁止作小字文本） | 装饰用 |
| `sand` | `#D9B36C` | 装饰线条、图案、次级徽章（沙金） | 9.5:1 |

### 文字色

| Token | 色值 | 使用场景 | 对比度 |
| --- | --- | --- | --- |
| `text.primary` | `#F4EDE4` | 标题、正文、消息内容 | 16.2:1（对 bg.base） |
| `text.secondary` | `#C9BBA9` | 次要文字、列表摘要、占位说明 | 10.0:1 |
| `text.tertiary` | `#9A8B78` | 时间戳、角标、辅助信息 | 5.2:1（对 bg.surface） |

### 状态色

| Token | 色值 | 深底对比度 | 备注 |
| --- | --- | --- | --- |
| `success` | `#90C177` | 9.1:1 | 发送成功、在线 |
| `warning` | `#EBC15D` | 11.1:1 | 审核中、限流提示 |
| `error` | `#F0705A` | 6.4:1 | 失败、校验错误（须配文字，不只靠颜色） |

### 可选点缀

| Token | 色值 | 约束 |
| --- | --- | --- |
| `indigo` | `#4A5A8A` | 靛蓝（西非织物常见点缀色），全页占比 ≤5%，仅图形/徽章 |

---

## 2. 字体系统

中文与斯瓦希里语正文走系统字体栈（保证 PWA 离线与加载性能）；西文标题使用 Sora 提供科技感。

| 用途 | 字体栈 | 字重 |
| --- | --- | --- |
| Heading | `Sora, "PingFang SC", "Microsoft YaHei", sans-serif` | 600 / 700 |
| Body | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif` | 400 / 500 |
| Mono | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 400 |

Sora 加载方式：自托管 woff2（首选）或 Google Fonts + `display=swap`；加载中先用 fallback，不允许布局跳动。

### 字号层级（根 16px）

| 级别 | 字号/行高 | 字重 | 说明 |
| --- | --- | --- | --- |
| h1 | 28px / 36px | 700 | 页面主标题（mobile 降为 24px/32px） |
| h2 | 24px / 32px | 600 | 区块标题 |
| h3 | 20px / 28px | 600 | 卡片/会话组标题 |
| h4 | 17px / 24px | 600 | 列表项主文案 |
| body-lg | 16px / 24px | 400 | 引导文案 |
| body | 15px / 23px | 400 | 正文、消息气泡内容 |
| body-sm | 14px / 21px | 400 | 紧凑列表 |
| caption | 12px / 18px | 400 | 时间戳、状态说明 |
| overline | 11px / 16px | 500 | 分组标签，letter-spacing 0.08em，大写 |

---

## 3. 组件规范

### 按钮

| 类型 | 样式 |
| --- | --- |
| Primary | 背景 `#E8A33D`，文字 `#241505`，圆角 10px，高 44px，内边距 0 16px，字重 500 |
| Secondary | 透明底 + 1px 边框 `#E08B62`，文字 `#E08B62`，圆角 10px，高 44px |
| Ghost | 无边框，文字 `#C9BBA9`，hover 背景 `rgba(244,237,228,0.06)` |

- hover：Primary 变 `#F2B455` 并 `translateY(-1px)`；Secondary 背景 `rgba(224,139,98,0.12)`
- 按下：Primary 变 `#D18F2C`，无位移
- 禁用：opacity 0.4，不响应 hover
- 焦点：`focus-visible` 2px outline `#E8A33D`，offset 2px
- 触控目标一律 ≥ 44×44px

### 卡片（Card）

- 背景 `#201914`，边框 1px `rgba(244,237,228,0.10)`，圆角 12px
- 暗色主题不用阴影表达层级：层级 = 背景亮度递进（base → surface → elevated）
- 仅 Modal / Toast / 下拉浮层允许阴影：`0 8px 32px rgba(0,0,0,0.45)`
- hover（可点击卡片）：边框变 `rgba(244,237,228,0.18)`，背景不变

### 输入框（Input / Textarea）

- 背景 `#251C15`，边框 1px `rgba(244,237,228,0.14)`，圆角 10px，高 44px，内边距 0 12px
- 文字 `#F4EDE4`，placeholder `#9A8B78`
- focus：边框 `#E8A33D` + 外环 `0 0 0 3px rgba(232,163,61,0.25)`
- error：边框 `#F0705A` + 下方 caption 错误文案（颜色 `#F0705A`）

### 头像（Avatar）

- 尺寸：会话列表 48px，聊天头部 40px，行内 32px；圆形
- fallback：无图时显示名称首字母，背景按序取 `#E8A33D / #E08B62 / #D9B36C`，文字 `#241505`，字重 600
- 在线状态点：右下 10px `#90C177`，2px 背景色描边

### 消息气泡（Message Bubble）

| 侧 | 背景 | 文字 | 圆角 |
| --- | --- | --- | --- |
| 用户侧（我） | `#E8A33D` | `#241505` | 16px 16px 4px 16px（右下收角） |
| 联系人侧 | `#2A211A` | `#F4EDE4` | 16px 16px 16px 4px（左下收角） |

- 最大宽度 76%，内边距 10px 14px，正文 15px/23px
- 同发送者连续气泡间距 8px；切换发送者间距 16px
- 时间戳：气泡下方 caption 12px `#9A8B78`；发送状态用图标 + 颜色双编码（成功 `#90C177`、失败 `#F0705A`）

---

## 4. 非洲元素应用规则

原则：抽象几何优先，克制使用，同一屏不超过一种图案元素。

| 元素 | 形式 | 使用位置 | 强度 |
| --- | --- | --- | --- |
| 几何图案（bogolan/mudcloth 风格） | 内联 SVG data-URI：三角、菱形、之字线条 | 侧栏背景、空状态插图、分隔带 | 沙金/白色 4–8% 不透明度 |
| 编织纹理 | `repeating-linear-gradient` 45°/-45° 交叉细线 | 卡片头部、按钮 hover 叠层 | ≤3% 不透明度 |
| 强调色带（kente 抽象） | 琥珀/赤陶/沙金三色横条，高 3px | 页面标题下方、侧栏 logo 底部 | 每页至多 1 处 |
| 靛蓝点缀 | 纯色块 | 徽章、图形装饰 | 全页 ≤5% |

**禁止事项**：动物剪影、部落面具、羽饰、长矛/鼓等刻板印象符号；不直接使用真实织物照片；不使用被宗教/族群专属化的具体图腾。

---

## 5. 动效规范（MOTION_INTENSITY 5）

| 档位 | 时长 | 场景 |
| --- | --- | --- |
| fast | 150ms | hover、按下、开关 |
| normal | 300ms | 消息出现（fade + translateY 8px）、路由切换、气泡展开 |
| slow | 500ms | 侧栏展开/收起、全屏浮层 |

- 缓动：`cubic-bezier(0.4, 0, 0.2, 1)`（ease-in-out 系）；消息入场可用 `cubic-bezier(0.2, 0.8, 0.2, 1)`
- 消息列表滚动到底部：300ms 平滑；新消息自动滚动仅在用户位于底部时触发
- 必须支持 `prefers-reduced-motion: reduce`：除透明度外动画时长降为 0.01ms

---

## 6. 布局与响应式断点（对标 Chakra Chat）

双栏结构：左 = 会话列表（搜索框 + 列表 + 未读角标），右 = 聊天窗口（头部 + 消息区 + 输入区）。

| 断点 | 范围 | 行为 |
| --- | --- | --- |
| mobile | < 768px | 单栏：列表与聊天 push 切换，顶栏高 56px，返回按钮回到列表；触控优先 |
| tablet | 768–1024px | 双栏：侧栏固定 280px |
| desktop | > 1024px | 双栏：侧栏 320px（可拖拽 280–360px），聊天区内容最大宽度 960px 居中 |

- 会话列表项高 72px（头像 48 + 两行文案 + 时间/角标）
- 输入区吸底，最小高 56px，textarea 自适应最多 5 行后滚动

---

## 7. 暗色模式

- 是否支持：**是，且深色为默认唯一主题**。暖炭黑背景是本风格的构成部分，本期不提供亮色主题。
- 全部色值通过 `:root` 上的 `--ks-*` CSS 变量落地，未来如需亮色主题，新增一组变量（如 `[data-theme="light"]`）即可，不改组件代码。
- PWA `theme_color` 与浏览器地址栏配色统一为 `#16100D`。

---

## 8. 可访问性要点

- 对比度（WCAG AA）：正文/小字 ≥ 4.5:1（本系统最低 5.2:1），大字标题 ≥ 3:1；所有数值经实测计算，见第 1 节表格
- `#B5502E`（ochre）与 `#4A5A8A`（indigo）仅限图形装饰，禁止承载小字文本
- 所有交互元素具备 `focus-visible` 焦点环；键盘可达顺序与视觉顺序一致
- 触控目标 ≥ 44×44px；状态信息颜色 + 图标/文字双编码
- 动效遵循 `prefers-reduced-motion`（见第 5 节）

---

## 9. 落地映射（现状差异清单）

实现时必须执行，避免设计系统与代码两张皮：

1. 新建 `web/src/styles/tokens.css`：定义全部 `--ks-*` 变量 + Vant 覆盖：
   ```css
   :root {
     --van-primary-color: #E8A33D;
     --van-background: #16100D;
     --van-background-2: #201914;
     --van-text-color: #F4EDE4;
     --van-text-color-2: #C9BBA9;
     --van-text-color-3: #9A8B78;
     --van-border-color: rgba(244, 237, 228, 0.14);
     --van-button-primary-background: #E8A33D;
     --van-button-primary-color: #241505;
   }
   ```
2. `web/vite.config.ts` PWA `theme_color` 由现存 `#1989fa`（Vant 默认蓝）改为 `#16100D`；`manifest` 图标底色同步。
3. Sora 字体自托管于 `web/public/fonts/`（woff2，仅 600/700），或 `index.html` 以 `display=swap` 引入。
4. 现存 EditorView / DraftsView 使用 Vant 默认样式，重构时按本文件逐项替换，不允许引入本文件之外的色值。