# KiliSocial 人工验收 Checklist（服务器端）

在部署服务器逐项执行并勾选。所有命令默认当前目录为 `/opt/kilisocial/skipper_social`，先加载环境变量：

```bash
cd /opt/kilisocial/skipper_social
source .env
```

端口约定：应用 `127.0.0.1:${APP_PORT}`（默认 18080），MySQL `127.0.0.1:13306`，Redis `127.0.0.1:16379`。

## 1. 容器与启动状态

- [ ] `docker compose ps` 显示 app / mysql / redis 三个服务 Up
- [ ] `docker inspect --format='{{.Name}} {{.State.Health.Status}}' kilisocial_app kilisocial_mysql kilisocial_redis` 三个均 `healthy`
- [ ] `docker compose logs app | grep -iE "flyway|started"` 可见 Flyway 迁移成功与 Spring Boot 启动成功日志
- [ ] `docker compose logs app | grep -i error` 无非预期 ERROR（降级演练产生的除外）

## 2. 基础 API

- [ ] `curl -fsS "http://127.0.0.1:${APP_PORT}/actuator/health"` 返回 `{"status":"UP"}`
- [ ] `curl -fsS "http://127.0.0.1:${APP_PORT}/api/v1/hello"` 返回成功响应

## 3. MySQL

- [ ] 字符集：`docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SHOW VARIABLES LIKE 'character_set_database';"` 返回 `utf8mb4`
- [ ] 库表存在：`docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "USE kilisocial; SHOW TABLES;"` 包含 `prompt_config` 与 `flyway_schema_history`
- [ ] 迁移记录：`... -e "SELECT version, description, success FROM kilisocial.flyway_schema_history;"` 中 V1 `create_prompt_config` 的 success=1
- [ ] 表结构规范：`... -e "SHOW CREATE TABLE kilisocial.prompt_config\G"` 字段 snake_case、含 `id`/`created_at`/`updated_at`、唯一键 `uk_name_version`
- [ ] 绑定检查：`ss -lntp | grep 13306` 仅监听 `127.0.0.1`

## 4. Redis

- [ ] `docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping` 返回 `PONG`
- [ ] 仅 RDB：`... CONFIG GET appendonly` 为 `no`；`... CONFIG GET save` 非空
- [ ] 持久化挂载：写入任意 key 后 `... BGSAVE`，宿主机 `ls data/redis` 可见 `dump.rdb`
- [ ] 绑定检查：`ss -lntp | grep 16379` 仅监听 `127.0.0.1`

## 5. WA Webhook

验证接口：

- [ ] 成功：`curl -i "http://127.0.0.1:${APP_PORT}/api/v1/wa/webhook?hub.mode=subscribe&hub.verify_token=${WA_VERIFY_TOKEN}&hub.challenge=hello-wa"` → 200 且响应体为 `hello-wa`
- [ ] 失败：把 `hub.verify_token` 改错 → 403

消息接收（先造 payload 与签名）：

```bash
cat > wa-text-payload.json <<'EOF'
{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"254712345678","type":"text","text":{"body":"hello"}}]}}]}]}
EOF
SIGNATURE="sha256=$(openssl dgst -sha256 -hmac "${WA_APP_SECRET}" -binary wa-text-payload.json | xxd -p -c 256)"
curl -i -H "Content-Type: application/json" -H "X-Hub-Signature-256: ${SIGNATURE}" \
  --data @wa-text-payload.json "http://127.0.0.1:${APP_PORT}/api/v1/wa/webhook"
```

- [ ] text 消息 → 200 `ok`
- [ ] image 消息（`"type":"image","image":{"link":"https://example.com/test.jpg"}`）→ 200
- [ ] 未知类型（`"type":"sticker","sticker":{}`）→ 200 且日志有 WARN
- [ ] 签名错误（SIGNATURE 随便改一位）→ 403 `invalid signature`
- [ ] 脱敏：`docker compose logs app --tail=200 | grep -i "wa"` 手机号形如 `254****5678`，全日志无明文手机号

## 6. AI 文案端到端

已配置 `QWEN_API_KEY` 时：

- [ ] 发送 text 消息后 `docker compose logs -f app` 出现 Token 计量日志（含 model / input_tokens / output_tokens / cost_usd）
- [ ] 相同内容再发一次命中语义缓存：日志显示跳过 API 调用；`docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" --scan --pattern 'qwen:cache:*'` 有 key，且 `TTL` 接近 86400 秒

未配置或 API 不可达时（降级演练）：

- [ ] 返回 `[CONTENT_UNAVAILABLE]` 并记录 ERROR，webhook 本身仍 200

## 7. 社交平台配置（FB / IG / TikTok）

- [ ] 启动日志无 `kili.social` 配置绑定错误（凭证已随 application.yml 加载）
- [ ] 非阻塞项：TikTok OAuth 授权回调、FB/IG 发布链路待业务模块上线后联调验收，本次仅确认配置加载

## 8. 持久化与重启

- [ ] `docker compose restart` 后 60 秒内三个容器重新 healthy
- [ ] 向 `prompt_config` 插入一条记录后重启，记录仍在（数据卷生效）
- [ ] `./scripts/stop.sh` 再 `./scripts/deploy.sh` 可幂等启动

## 9. 共存与资源

- [ ] `docker stats --no-stream` 中 app 内存在 `JAVA_OPTS` 上限内，三容器总增量与 5G 剩余内存相容
- [ ] `ss -lntp` 确认原有 80/443/8080/8081/3306/6379 服务不受影响
- [ ] 服务器上其他 Docker 项目运行正常

## 10. 反向代理与公网

- [ ] 现有 Nginx/网关已将公网域名转发到 `127.0.0.1:18080`，外网 `curl -i https://<域名>/actuator/health` 返回 200
- [ ] 可选：Meta 后台用公网地址完成 WA Webhook 验证（正式接入时）

## 11. 安全收尾

- [ ] `chmod 600 .env` 且仅部署用户可读
- [ ] 本次用过的 GitHub PAT 已删除
- [ ] FB/IG/TikTok 测试凭证在测试结束后轮换

## 12. 排障速查

```bash
docker compose logs -f --tail=200 app                      # 应用日志
docker compose exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" kilisocial
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}"
./scripts/deploy.sh                                        # 重新构建部署
```

验收结论记录：阻塞项 ___ 个，非阻塞项 ___ 个，验收人 / 日期：__________