# KiliSocial Design System

> 版本 v2.0（冻结，取代 v1.0 暗色方案）。本文件是客户端所有 UI 开发的唯一视觉基准；修改需评审后升版本。
>
> 风格定位：未来科技风（futuristic / tech-forward）× 明亮色调 × 渐变强调 × 非洲元素克制点缀。
> 方向来源：v1.0 暗色大地色方案验收反馈后调整——明亮、渐变、科技感为长期大方向，后续 UI 迭代一律遵循。
>
> 架构依据：DEV_GUIDE.md / TECH_STACK.md / PROJECT_BOUNDARIES.md。技术基线：Vue 3 + Vite + Pinia + Vant 4，PWA，移动端 H5 优先。
> 定稿参数：DESIGN_VARIANCE 7 ｜ MOTION_INTENSITY 5 ｜ VISUAL_DENSITY 6。

---

## 1. 色彩系统（明亮）

| Token | 色值 | 使用场景 | 对比度 |
| --- | --- | --- | --- |
| `bg.base` | `#F6F7FB` | 全局背景（冷调亮白） | — |
| `bg.surface` | `#FFFFFF` | 卡片、侧栏、头部 | — |
| `bg.muted` | `#EEF0F6` | hover、chip、联系人侧气泡 | — |
| `border.default` | `#E5E7F0` | 卡片/分隔边框 | — |
| `border.strong` | `#D8DBE6` | 输入框边框、hover 边框 | — |
| `text.primary` | `#171A21` | 标题、正文 | 17.4:1（对白） |
| `text.secondary` | `#555B6E` | 次要文字、摘要 | 6.8:1 |
| `text.tertiary` | `#667085` | 时间戳、辅助信息 | 5.0:1 |
| `primary` | `#F4633A` | 强调条、选中指示、图标 | 图形用 |
| `primary.text` | `#C2410C` | 文字链接、激活态文字 | 5.2:1 |
| `grad.brand` | `linear-gradient(135deg, #FFB238, #F4633A)` | 主按钮、品牌标记、用户侧气泡 | 按钮文字 `#221507`，最差端点 5.7:1 |
| `grad.soft` | `linear-gradient(135deg, rgba(255,178,56,0.14), rgba(244,99,58,0.10))` | 选中行底色、hero 面板底 | — |
| `accent` | `#5B5BD6` | 科技靛蓝点缀（≤10% 面积） | 5.4:1 |
| `success` | `#15803D` | 成功、在线 | 5.0:1 |
| `warning` | `#B45309` | 审核中、提醒 | 5.0:1 |
| `error` | `#DC2626` | 错误（须配文字） | 4.8:1 |

暗色仅用于浮层文字：Toast 底 `#171A21` 文字 `#FFFFFF`。

## 2. 字体系统

| 用途 | 字体栈 | 字重 |
| --- | --- | --- |
| Heading | `Sora, "PingFang SC", "Microsoft YaHei", sans-serif` | 600 / 700 / 800 |
| Body | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif` | 400 / 500 |
| Mono | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 400 |

字号层级：h1 32/40（mobile 26/32）700；h2 24/32 600；h3 20/28 600；h4 17/24 600；body 15/23；body-sm 14/21；caption 12/18；overline 11/16 500 letter-spacing 0.08em 大写。

## 3. 组件规范

- 按钮 Primary：`grad.brand` 底 + 文字 `#221507`，圆角 12px，高 44px，hover 提亮并 `translateY(-1px)` + 柔光阴影 `0 8px 20px rgba(244,99,58,0.25)`；按下不位移
- 按钮 Secondary：白底 + 1px `border.strong` + 文字 `text.primary`，hover 边框 `primary`
- 按钮 Ghost：文字 `text.secondary`，hover 底 `bg.muted`
- 卡片：白底，1px `border.default`，圆角 14px，阴影 `0 8px 24px rgba(23,26,33,0.06)`；hover（可点击）阴影加深 + 边框 `border.strong`
- 输入框：白底，1px `border.strong`，圆角 12px，高 44px；focus 边框 `primary` + 外环 `0 0 0 3px rgba(244,99,58,0.15)`；error 边框 `error`
- 头部（全局）：sticky + 毛玻璃 `rgba(255,255,255,0.75)` + blur 12px，顶部 3px 品牌渐变条（`#FFB238 → #F4633A → #5B5BD6`）
- 头像：48/40/32 圆形；fallback 首字母，底按序取 `#FFB238 / #F4633A / #5B5BD6`，文字 `#221507`（靛蓝底用白字）
- 消息气泡：用户侧 `grad.brand` + 文字 `#221507`，圆角 16/16/4/16；联系人侧 `bg.muted` + `text.primary`，圆角 16/16/16/4；最大宽 76%
- 语言切换器：右上角分段控件（EN / 中文 / FR），激活项白底 + 阴影，容器 `bg.muted` 圆角 999

## 4. 非洲元素应用规则（v2：点缀而非底色）

- 品牌渐变条（kente 抽象三色）：全局头部顶线，唯一常驻元素
- 几何图案：仅 hero 区底部装饰带（内联 SVG，`primary/accent` 6% 不透明度）与空状态插图
- 禁止：整页网格/编织纹理背景、动物剪影、面具等刻板符号、真实织物照片
- 同一屏除头部顶线外至多一处图案元素

## 5. 动效规范

fast 150ms（hover/按下）｜ normal 300ms（消息出现、路由切换）｜ slow 500ms（侧栏/抽屉）。缓动 `cubic-bezier(0.4,0,0.2,1)`。`prefers-reduced-motion: reduce` 时非透明动画降为 0.01ms。

## 6. 布局与断点（桌面必须用满，不允许窄栏居中留白）

- mobile < 768px：单栏；会话页列表/聊天 push 切换；底部 tabbar 仅 editor/drafts
- tablet 768–1024px：会话页双栏，侧栏 280px；首页 hero 单栏 + 特性三列
- desktop > 1024px：内容容器最大 1120px；首页 hero 双栏（左文案右产品预览面板）+ 特性三列卡片；editor/drafts 工作台双栏（主区 2fr + 侧栏 1fr）；会话页侧栏 320px；desktop 隐藏底部 tabbar

## 7. 暗色模式

本期默认且仅明亮主题；色值全部经 `--ks-*` 变量落地，未来暗色以 `[data-theme="dark"]` 扩展。PWA `theme_color` = `#F6F7FB`。

## 8. 可访问性

正文/小字 ≥ 4.5:1（实测最低 4.8:1）；渐变按钮文字用最差端点校验；`focus-visible` 2px `#C2410C` offset 2px；触控目标 ≥ 44×44px；状态颜色 + 文字双编码；多语言（en/zh/fr）全站右上角可切换，UI 文案一律走 i18n 字典。

## 9. 落地映射

1. `web/src/styles/tokens.css`：`--ks-*` + `--van-*` 亮色覆盖（唯一令牌来源）
2. `web/src/i18n/`：en/zh/fr 字典 + store，localStorage 持久化，navigator 语言探测
3. 现存视图按本文件重构模板与样式，逻辑不变；禁止引入字典外文案与令牌外色值