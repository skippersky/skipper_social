# KiliSocial 技术栈与架构规范

## 1. 核心技术栈

| 层级 | 技术选型 | 版本要求 | 说明 |
| :--- | :--- | :--- | :--- |
| 客户端 | Vue3 + Vite + Pinia | Vue ≥3.4 | PWA + 移动端 H5 优先 |
| 服务端 | Java + Spring Boot 3 | JDK 17, SB ≥3.2 | RESTful API + 异步消息处理 |
| 数据库 | MySQL 8 | ≥8.0.32 | InnoDB 引擎；utf8mb4 字符集 |
| 缓存 | Redis | ≥7.0 | BullMQ 消息队列 + 业务缓存 |
| AI 服务 | Qwen API + bge-m3 | - | Turbo 日常生成；Max 复杂策略 |
| 部署 | Docker + Nginx | - | Hetzner/Azure Africa Region |

## 2. 关键架构决策
- 消息队列：Redisson + BullMQ 实现 WA 消息异步发送，支持延迟重试与死信队列
- AI 调用：独立 AI Service 模块，统一封装 Prompt 管理、Token 计量、降级策略
- 认证鉴权：Spring Security + JWT；RBAC 权限模型
- 配置管理：Nacos / Apollo 动态配置；敏感信息 Vault 加密存储
- 日志监控：SLF4J + Logback；Prometheus + Grafana 指标采集

## 3. 第三方服务依赖
- WhatsApp: Meta Official Business API Provider (如 Twilio/Baileys Enterprise)
- 支付: Paystack / Flutterwave (聚合 M-Pesa)
- 短信/邮件: SendGrid / Africa's Talking
- 对象存储: Cloudflare R2 / AWS S3 (媒体文件)