# KiliSocial MVP 8周迭代路线图

## Sprint 0: 基建与合规 (W1)
- [ ] Spring Boot 3 脚手架搭建 (含阿里规范 Checkstyle)
- [ ] MySQL 8 + Redis 7 容器化部署脚本
- [ ] WA Business API 申请与沙箱调通
- [ ] Qwen API 接入 + Prompt 配置表设计
- [ ] CI/CD Pipeline (GitLab CI / GitHub Actions)
- 🎯 里程碑：Hello World API 可访问；WA 测试号收发消息成功

## Sprint 1: AI 引擎核心 (W2-W3)
- [ ] 文案生成 API (含多语言模板 + Token 计量)
- [ ] 对话摘要 + 意图识别 API
- [ ] Prompt 版本管理 + 快照测试
- [ ] AI 降级策略 + 语义缓存实现
- 🎯 里程碑：AI 接口压测通过；生成质量人工验收合格

## Sprint 2: 社媒消息闭环 (W4-W5)
- [ ] WA 消息队列 (BullMQ + 重试 + 死信)
- [ ] IG/FB Graph API 发布集成
- [ ] 前端消息编辑器 + 离线草稿
- [ ] 弱网模拟测试 + 送达率监控
- 🎯 里程碑：100条消息压测无丢失；P99 < 100ms

## Sprint 3: CRM + 支付变现 (W6)
- [ ] 客户标签 + 跟进提醒 CRUD
- [ ] M-Pesa/Paystack 支付回调 + 订阅管理
- [ ] 额度扣减原子事务 + 账单推送
- [ ] 基础数据看板 API
- 🎯 里程碑：支付→开通→使用全流程跑通；账单准确

## Sprint 4: 打磨与内测 (W7-W8)
- [ ] Vue3 PWA 打包 + 性能优化
- [ ] 安全审计 (RLS/密钥轮换/渗透测试)
- [ ] 种子用户邀请 + 反馈收集
- [ ] 文档完善 + 运维手册交付
- 🎯 里程碑：10个真实卖家完成首单；NPS > 30；零 P0 故障