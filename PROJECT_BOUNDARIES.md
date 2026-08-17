# KiliSocial 项目边界红线 (Anti-Scope-Creep)

## ✅ IN SCOPE (MVP 允许)
- WhatsApp Business API 官方对接
- AI 文案/摘要/标签生成 (Qwen-Turbo/Max)
- M-Pesa / Paystack 支付集成
- 英语/法语/斯瓦希里语支持
- Vue3 PWA + Android WebView 壳
- 单店铺/单品牌管理模式

## ❌ OUT OF SCOPE (V2+ 规划)
- WhatsApp 个人号协议破解/模拟
- AI 图片/视频生成
- 通用型 CRM (工单/报表/团队协作)
- Stripe / PayPal / 加密货币支付
- iOS 原生 App / 桌面客户端
- 多店铺聚合 / ERP / 库存管理

## 🚫 NEVER DO (永久禁止)
- 存储用户明文密码/支付凭证
- 未经审核发送营销消息 (防封号)
- 绕过官方 API 限制 (防法律风险)
- 收集非必要个人信息 (NDPR/GDPR 合规)
- 在生产环境测试支付/AI 计费接口

## ⚠️ 变更控制
任何超出 IN SCOPE 的需求，必须提交 RFC 文档，经产品+技术负责人双重签字批准后方可纳入迭代。Codex 有权拒绝执行无 RFC 的越界任务。