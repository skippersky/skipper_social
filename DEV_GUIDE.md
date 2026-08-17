# KiliSocial Java 研发规范 (基于阿里巴巴手册)

## 1. 命名规约
- 类名：UpperCamelCase；DO/DTO/VO/BO 后缀明确区分
- 方法名：lowerCamelCase；获取用 get，判断用 is/has/can
- 常量：全大写下划线分隔；枚举类 Enum 结尾
- 包名：全小写点分隔；com.kilisocial.{module}.{layer}

## 2. 代码规范
- 强制开启 Strict Mode；禁止使用 @Autowired 字段注入，改用构造器注入
- 所有外部输入/LLM 输出必须经 Hibernate Validator / Zod 校验
- 禁止在循环中执行 DB/Redis/HTTP 调用；批量操作使用 Batch API
- 异常处理：自定义 BusinessException；全局异常处理器统一响应格式
- 注释：公共方法必须 Javadoc；复杂逻辑行内注释说明 Why 而非 What

## 3. 数据库规范
- 表名/字段名：snake_case；禁止使用 MySQL 保留字
- 主键：BIGINT UNSIGNED AUTO_INCREMENT；禁止 UUID 作聚簇索引
- 必备字段：id, created_at, updated_at, deleted_at(逻辑删除)
- 索引：联合索引最左匹配；单表行数超 500w 必须分库分表预案
- SQL：禁止 SELECT *；UPDATE/DELETE 必须带 WHERE 条件

## 4. 安全规范
- 密钥管理：API Key/密码禁止硬编码；使用环境变量或 Vault
- 接口安全：HTTPS 强制；Rate Limiting；SQL 注入/XSS 防护
- 数据脱敏：日志中手机号/身份证/Token 必须掩码处理
- 依赖安全：定期 mvn dependency-check；禁用已知漏洞版本

## 5. 测试规范
- 单元测试：JUnit 5 + Mockito；覆盖率 ≥80%
- 集成测试：Testcontainers 启动真实 MySQL/Redis
- AI 测试：Prompt 快照测试；Mock LLM 响应验证解析逻辑
- CI 门禁：测试失败/覆盖率不达标禁止合并