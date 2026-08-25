# KiliSocial 服务器首次部署手册

本文档面向 Ubuntu 24.04 服务器首次部署，覆盖从 Git 拉取代码到 Docker 一键启动与验收。

## 1. 前置条件

服务器建议配置：

- Ubuntu 24.04
- 剩余内存不低于 5GB
- 已安装 Git
- 已安装 Docker Engine 和 Docker Compose Plugin
- 当前服务器已有 `80`、`443`、`3306`、`6379`、`8080`、`8081` 端口占用时，保持本文档默认端口即可

检查 Docker：

```bash
docker --version
docker compose version
```

如果未安装 Docker：

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

可选：让当前用户免 `sudo` 执行 Docker。

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## 2. 从 Git 拉取代码

公网仓库地址：`https://github.com/skippersky/skipper_social.git`，默认分支 `master`。

### 方式 A：一键初始化脚本（推荐）

脚本自动完成：检查/安装 Docker、拉取代码、生成 `.env` 并为 MySQL/Redis 生成强随机密码、提示未填写的占位符、构建并启动容器、等待健康检查、执行冒烟测试。

先克隆再执行（推荐；服务器与 GitHub 已建立 SSH 信任时用 SSH 地址，避免 raw.githubusercontent.com 不可达）：

```bash
sudo mkdir -p /opt/kilisocial && sudo chown -R "$USER:$USER" /opt/kilisocial
git clone git@github.com:skippersky/skipper_social.git /opt/kilisocial/skipper_social
sudo bash /opt/kilisocial/skipper_social/scripts/init-deploy.sh
```

网络可达 raw.githubusercontent.com 时也可直接下载执行：

```bash
curl -fsSL https://raw.githubusercontent.com/skippersky/skipper_social/master/scripts/init-deploy.sh -o init-deploy.sh
sudo bash init-deploy.sh
```

可覆盖变量：

```bash
REPO_BRANCH=master INSTALL_DIR=/opt/kilisocial sudo -E bash init-deploy.sh
```

业务密钥（Qwen/WA/FB/IG/TikTok 等）脚本不会代填，执行完成后按下一节修改 `/opt/kilisocial/skipper_social/.env`，再运行一次 `./scripts/deploy.sh` 即可。

### 方式 B：手动克隆

选择一个部署目录：

```bash
mkdir -p /opt/kilisocial
cd /opt/kilisocial
```

首次拉取：

```bash
git clone https://github.com/skippersky/skipper_social.git skipper_social
cd skipper_social
```

如果代码已存在：

```bash
cd /opt/kilisocial/skipper_social
git fetch --all
git checkout master
git pull
```

如需指定分支：

```bash
git checkout <BRANCH_NAME>
git pull
```

## 3. 准备环境变量

复制模板：

```bash
cp .env.example .env
vi .env
```

当前服务器已有 `3306`、`6379`、`8080`、`8081` 占用，因此默认使用不冲突端口：

```bash
APP_BIND_HOST=127.0.0.1
APP_PORT=18080
MYSQL_BIND_HOST=127.0.0.1
MYSQL_PORT=13306
REDIS_BIND_HOST=127.0.0.1
REDIS_PORT=16379
```

至少替换以下值：

```bash
MYSQL_ROOT_PASSWORD=<strong_mysql_root_password>
REDIS_PASSWORD=<strong_redis_password>
QWEN_API_KEY=<your_qwen_api_key>
WA_VERIFY_TOKEN=<your_wa_verify_token>
WA_APP_SECRET=<your_meta_app_secret>
WA_ACCESS_TOKEN=<your_wa_access_token>
WA_PHONE_NUMBER_ID=<your_wa_phone_number_id>
FACEBOOK_ACCESS_TOKEN=<your_facebook_access_token>
FACEBOOK_PAGE_ID=<your_facebook_page_id>
INSTAGRAM_BUSINESS_ACCOUNT_ID=<your_instagram_business_account_id>
TIKTOK_WEBHOOK_SECRET=<your_tiktok_webhook_secret>
```

内存剩余约 5GB 时，建议保留：

```bash
JAVA_OPTS=-Xms256m -Xmx768m
```

## 4. 一键启动

给脚本加执行权限：

```bash
chmod +x scripts/*.sh
```

启动：

```bash
./scripts/deploy.sh
```

等价命令：

```bash
docker compose --env-file .env up -d --build
```

首次构建会下载基础镜像和 Maven 依赖，耗时较长是正常的。

## 5. 查看容器状态

```bash
docker compose ps
```

查看健康状态：

```bash
docker inspect --format='{{.Name}} {{.State.Health.Status}}' \
  kilisocial_app kilisocial_mysql kilisocial_redis
```

期望：

```text
/kilisocial_app healthy
/kilisocial_mysql healthy
/kilisocial_redis healthy
```

查看应用日志：

```bash
./scripts/logs.sh
```

或：

```bash
docker compose --env-file .env logs -f --tail=200 app
```

## 6. 基础验收

加载 `.env`：

```bash
source .env
```

应用健康检查：

```bash
curl -fsS "http://127.0.0.1:${APP_PORT}/actuator/health"
```

期望包含：

```json
{"status":"UP"}
```

业务冒烟接口：

```bash
curl -fsS "http://127.0.0.1:${APP_PORT}/api/v1/hello"
```

期望包含：

```json
{"success":true}
```

MySQL 字符集：

```bash
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW VARIABLES LIKE 'character_set_database';"
```

期望：

```text
utf8mb4
```

Redis：

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

期望：

```text
PONG
```

## 7. WhatsApp Webhook 验证

Meta 后台 Callback URL 如果通过公网域名访问，建议由现有 Nginx/网关转发到：

```text
http://127.0.0.1:18080
```

本机验证 URL：

```bash
source .env
curl -i "http://127.0.0.1:${APP_PORT}/api/v1/wa/webhook?hub.mode=subscribe&hub.verify_token=${WA_VERIFY_TOKEN}&hub.challenge=hello-wa"
```

期望：

```text
HTTP/1.1 200
hello-wa
```

如果返回 `403`，检查 `.env` 中的 `WA_VERIFY_TOKEN` 是否与 Meta 后台配置一致。

## 8. Nginx 反向代理示例

如果服务器已有 Nginx 占用 `80/443`，新增一个 location 转发到应用端口即可。

示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:18080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 更新部署

```bash
cd /opt/kilisocial/skipper_social
git fetch --all
git checkout master
git pull
./scripts/deploy.sh
```

## 10. 停止服务

```bash
./scripts/stop.sh
```

等价命令：

```bash
docker compose --env-file .env down
```

## 11. 重置数据

危险操作：会删除 MySQL 和 Redis 本地数据。

```bash
docker compose --env-file .env down
sudo rm -rf data/mysql data/redis
./scripts/deploy.sh
```

## 12. 常见问题

### 端口冲突

查看占用：

```bash
ss -lntp | grep -E '18080|13306|16379|8080|3306|6379'
```

如果冲突，修改 `.env`：

```bash
APP_PORT=18081
MYSQL_PORT=13307
REDIS_PORT=16380
```

然后重启：

```bash
./scripts/deploy.sh
```

### 容器未 healthy

查看日志：

```bash
docker compose --env-file .env logs --tail=200 app
docker compose --env-file .env logs --tail=200 mysql
docker compose --env-file .env logs --tail=200 redis
```

### Maven 构建慢

首次 Docker 构建需要下载依赖。后续构建会复用 Docker 缓存。

### 内存不足

降低 JVM 上限：

```bash
JAVA_OPTS=-Xms128m -Xmx512m
```

然后重新部署：

```bash
./scripts/deploy.sh
```

## 13. 部署完成检查清单

- `docker compose ps` 显示三个容器运行中
- `kilisocial_app` 为 `healthy`
- `kilisocial_mysql` 为 `healthy`
- `kilisocial_redis` 为 `healthy`
- `curl http://127.0.0.1:18080/actuator/health` 返回 `UP`
- `curl http://127.0.0.1:18080/api/v1/hello` 返回成功
- WA Webhook verify 返回 `hello-wa`
- Nginx 或网关已把公网域名转发到 `127.0.0.1:18080`
