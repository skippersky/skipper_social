# KiliSocial 新环境搭建与验证手册

> 配套 `02_PROJECT_HANDOFF.md`。本文目标：在一台**全新的开发机**上，从零把项目跑起来并复现验证基线。
> 基线提交：`a53e62a`（`master`）。

---

## 1. 需要安装什么

| 工具 | 版本 | 用途 | 备注 |
| --- | --- | --- | --- |
| JDK | 17（Temurin / Adoptium） | 后端编译运行 | 必须 17，Spring Boot 3.3.5 要求 |
| Maven | 3.9.x（实测 3.9.9） | 后端构建 | 需要能访问 Maven Central |
| Node.js | 20+（实测 v24.19.0 可用） | 前端构建 | `Dockerfile.web` 用的是 node:20-alpine |
| pnpm | 9+ | 前端包管理 | **仓库只有 `pnpm-lock.yaml`，请统一用 pnpm** |
| Docker + Compose v2 | 任意近期版本 | 本地起 MySQL/Redis、服务器部署 | 本地开发可选（后端目前不连数据库） |
| git | 任意 | — | — |

> 注意：`.tools/`（内含 `jdk-17` 与 `apache-maven-3.9.9`）、`.m2/repository`、`web/node_modules/` **全部被 gitignore，不会随 clone 到达新机器**。旧机器上之所以能直接跑，是因为这些目录已经存在。如果新旧机器同为 Windows 且能直接拷贝，把 `.tools/` 和 `.m2/` 整个复制过去可以省掉重新下载依赖的时间（约 190MB JDK + 完整 Maven 本地仓库）。

---

## 2. 获取代码

```bash
git clone https://github.com/skippersky/skipper_social.git
cd skipper_social
git checkout master
```

若需要 PAT（私有仓库或需要 `workflow` scope 推送）：

```bash
git push https://skippersky:<PAT>@github.com/skippersky/skipper_social.git master
```

Windows 上报 `detected dubious ownership` 时：

```powershell
git config --global --add safe.directory <仓库绝对路径，用正斜杠>
```

---

## 3. 后端本地开发

### 3.1 先修 settings.xml 的硬编码路径（必做）

`.mvn/settings.xml` 里写死了旧机器的本地仓库路径：

```xml
<localRepository>C:/codex-workspace/kili-social/.m2/repository</localRepository>
```

新环境三选一：

1. 把这一行改成新机器的实际路径（或直接删掉这行，用 `~/.m2/repository` 默认值）；
2. 不用 `-s .mvn/settings.xml`，直接 `mvn ...`（走用户默认 settings）；
3. 容器内构建用的是另一份 `.mvn/settings-docker.xml`，与本机无关，不要混用。

### 3.2 常用命令

```bash
# 全量测试（含 Checkstyle 在 verify 阶段）
mvn -s .mvn/settings.xml -B test

# 完整门禁：Checkstyle + 测试 + JaCoCo LINE>=0.80 校验
mvn -s .mvn/settings.xml -B verify

# 单模块
mvn -s .mvn/settings.xml -B test -pl ai-service
mvn -s .mvn/settings.xml -B test -pl copywriting-service

# 本地起应用（默认 8080）
mvn -s .mvn/settings.xml -pl app spring-boot:run
```

依赖已下载过之后可以加 `-o`（离线）加速；**首次构建必须联网**。

### 3.3 预期结果（基线）

```
[INFO] Reactor Summary for kili-social 0.0.1-SNAPSHOT:
[INFO] kili-social ............... SUCCESS
[INFO] common .................... SUCCESS   (1 test)
[INFO] app ....................... SUCCESS   (9 tests)
[INFO] ai-service ................ SUCCESS   (12 tests)
[INFO] wa-webhook-controller ..... SUCCESS   (8 tests)
[INFO] copywriting-service ....... SUCCESS   (16 tests)
[INFO] wa-ai-integration ......... SUCCESS   (5 tests)
[INFO] BUILD SUCCESS      # 合计 51 个用例
```

JaCoCo 报告输出到各模块 `target/site/jacoco/index.html`。

### 3.4 已知环境陷阱：`JdkQwenHttpClientTest`

`ai-service` 的 `JdkQwenHttpClientTest`（2 个用例）会用 JDK 内置的 `com.sun.net.httpserver.HttpServer` 在 `127.0.0.1` 上起一个假 Qwen 服务端：

```java
server = HttpServer.create(new InetSocketAddress(0), 0);
```

在**受限沙箱 / 某些容器环境**里，这一步会抛：

```
java.io.IOException: Unable to establish loopback connection
  caused by java.net.SocketException: Invalid argument: connect
```

已在旧机器上确认这是**环境限制而非代码缺陷**（同一环境下 Node 起 TCP 回环监听正常，仅 JDK `HttpServer` 失败）。遇到时的处理：

- 正常 Linux / CI 环境下应该能通过，**不要为了绕过它而改测试**；
- 若新环境同样受限，用下面这条排除后继续，并在交接记录里注明：

```bash
mvn -s .mvn/settings.xml -B test "-Dtest=!JdkQwenHttpClientTest" "-Dsurefire.failIfNoSpecifiedTests=false"
# 结果：ai-service 10 tests，合计 49 tests，BUILD SUCCESS
```

### 3.5 后端目前不需要数据库

如 `02_PROJECT_HANDOFF.md` 第 6 节所述，pom 里没有任何数据层依赖，**应用启动不会连 MySQL/Redis，也不需要它们**。所以本地开发后端时无需起容器。等你补上 Flyway/JPA 之后，再用第 5 节的方式起 MySQL/Redis。

---

## 4. 前端本地开发

```bash
cd web
corepack enable          # 或 npm i -g pnpm
pnpm install --frozen-lockfile
pnpm dev                 # http://localhost:5173
```

`vite.config.ts` 已配好 dev proxy：`/api` 与 `/actuator` → `http://127.0.0.1:18080`。所以本地同时起了后端容器时，前端直接同源调用；没起后端时，前端自动降级到示例数据（`02_PROJECT_HANDOFF.md` 第 5 节）。

### 4.1 环境变量（`web/.env.local`，从 `web/.env.example` 复制）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE` | 空（同源） | 后端 API 基址。**留空即同源**，由 nginx / vite proxy 转发 |
| `VITE_WS_URL` | 空（同源 `/ws`） | WebSocket 地址，留空则用 `wss://<host>/ws` |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_test_REPLACE_ME` | 仅测试模式，禁止放 live key |
| `VITE_META_APP_ID` | `REPLACE_ME` | Meta（FB/IG）OAuth app id |
| `VITE_TIKTOK_CLIENT_KEY` | `REPLACE_ME` | TikTok OAuth client key |

### 4.2 验证命令与基线

```bash
pnpm typecheck    # vue-tsc --noEmit，预期 0 错误
pnpm test         # vitest run --coverage
pnpm build        # vite build，预期 0 错误
pnpm preview      # 预览构建产物
```

`pnpm test` 预期输出：

```
Test Files  105 passed (105)
     Tests  1852 passed (1852)
All files   | 97.84 % Stmts | 92.4 % Branch | 92.26 % Funcs | 97.84 % Lines
```

门禁写在 `vite.config.ts`：`lines/statements ≥ 80`，`functions/branches ≥ 70`，低于阈值 vitest 直接失败。

> 测试过程中会看到若干 `[Vue warn]: Failed to resolve component: van-skeleton` 之类的告警，这是测试环境未全量注册 Vant 组件导致的，**不影响断言，属已知噪音**。

---

## 5. 本地起 MySQL / Redis（补数据层之后才需要）

```bash
cp .env.example .env      # 填入 MYSQL_ROOT_PASSWORD / REDIS_PASSWORD
docker compose up -d mysql redis
docker compose ps         # 两者应为 healthy
```

宿主机连接（端口都绑 `127.0.0.1`，避让其他项目）：

```bash
mysql -h 127.0.0.1 -P 13306 -u root -p -e "SHOW VARIABLES LIKE 'character_set_database';"   # 期望 utf8mb4
redis-cli -h 127.0.0.1 -p 16379 -a "$REDIS_PASSWORD" ping                                    # 期望 PONG
```

`sql/init.sql` 只建库建用户，不建业务表。手工执行 Flyway 迁移验证：

```bash
mysql -h 127.0.0.1 -P 13306 -u root -p kilisocial < ai-service/src/main/resources/db/migration/V1__create_prompt_config.sql
```

---

## 6. 服务器部署（Ubuntu 24.04）

### 6.1 首次部署（一键）

服务器需能通过 SSH 访问 GitHub（已配置 ssh 信任凭证），或直接 HTTPS 匿名 clone 公开仓库。

```bash
# 方式 A：服务器上已能访问 raw.githubusercontent.com
curl -fsSL https://raw.githubusercontent.com/skippersky/skipper_social/master/scripts/init-deploy.sh -o init-deploy.sh

# 方式 B：走 SSH 先 clone，再执行仓库内脚本（旧机器上 A 方式曾 SSL 超时，用这个更稳）
git clone git@github.com:skippersky/skipper_social.git /opt/kilisocial/skipper_social
cd /opt/kilisocial/skipper_social
sudo bash scripts/init-deploy.sh
```

脚本会依次完成：装 git/curl/ca-certificates → 装 Docker + compose 插件 → clone/pull 代码 → 生成 `.env`（缺失的 MySQL root 密码与 Redis 密码用 `openssl rand -hex 16` 自动生成）→ 端口冲突检测 → `docker compose up -d --build` → 等 4 个容器 healthy（默认 240s）→ 安装 nginx 站点配置（`nginx -t` 失败自动回滚）→ 冒烟测试。

可覆盖变量：

```bash
sudo REPO_URL=https://github.com/skippersky/skipper_social.git \
     REPO_BRANCH=master \
     INSTALL_DIR=/opt/kilisocial \
     DOMAIN=social.hengzhanwujin.com \
     HEALTH_TIMEOUT_SECONDS=240 \
     bash scripts/init-deploy.sh
```

### 6.2 TLS 证书

首次部署时若还没有证书，脚本会先装 HTTP 版配置（`deploy/nginx-social-http.conf`）并提示：

```bash
sudo certbot --nginx -d social.hengzhanwujin.com
sudo bash scripts/init-deploy.sh      # 再跑一次，脚本会换成 TLS 版配置
```

certbot 交互式提问时选 `1`（reinstall）即可，别选 2（会触发续期限额）。

### 6.3 日常更新

```bash
cd /opt/kilisocial/skipper_social
git pull                       # 若报 local changes would be overwritten，先 git stash
bash scripts/deploy.sh         # docker compose up -d --build
bash scripts/logs.sh           # 跟踪 app 日志
bash scripts/stop.sh           # docker compose down
```

> 历史上出现过 `git pull` 因 `scripts/init-deploy.sh` 的本地修改（或文件权限位变化）而中止。仓库里已有两个提交专门给部署脚本设了 exec bit 来避免权限位漂移。如果仍冲突：`git stash` → `git pull` → `git stash pop` 手动合并，**不要** `git checkout --` 直接丢弃服务器上的本地修改。

### 6.4 部署后冒烟

```bash
# 把 .env 的变量载入当前 shell（可选，方便下面用 $REDIS_PASSWORD 等）
set -a; . ./.env; set +a
# 说明：当前 .env.example 里是 JAVA_OPTS="-Xms256m -Xmx768m"（带引号），
# bash 下 source 正常。历史上服务器上曾报 "-Xmx768m: command not found"，
# 那是早期未加引号的版本导致 shell 把 -Xmx768m 当成命令；现已修复。
# 若服务器上的 .env 是旧版本，手工给 JAVA_OPTS 的值补上双引号即可。

docker compose ps
curl -fsS http://127.0.0.1:18080/actuator/health        # {"status":"UP"}
curl -fsS http://127.0.0.1:18080/api/v1/hello           # ApiResponse 信封
curl -fsS http://127.0.0.1:18081/                       # 前端首页 HTML
curl -sk  https://social.hengzhanwujin.com/actuator/health
curl -sk  https://social.hengzhanwujin.com/             # 应返回前端页面，不是别的项目
```

### 6.5 端口与隔离

四个容器全部绑定 `127.0.0.1`，端口分别为 app 18080 / web 18081 / mysql 13306 / redis 16379，容器名带 `kilisocial_` 前缀，数据卷落在仓库内 `./data/mysql`、`./data/redis`。这样与同机上其他项目（占用 80/443/3306/6379/8080/8081）完全隔离。**本项目不需要放行任何新的外网端口**，公网入口只有宿主 nginx 的 80/443。

### 6.6 如果访问域名跳到了别的项目

说明宿主 nginx 里有另一个 server block 抢了这个 `server_name`。排查：

```bash
sudo grep -rn "social.hengzhanwujin.com" /etc/nginx/conf.d /etc/nginx/sites-enabled
sudo nginx -T | grep -n "server_name"
```

`init-deploy.sh` 第 8 步本身会做重复 `server_name` 检测并在 `nginx -t` 失败时回滚，正常流程下不会留下这种状态。

---

## 7. CI（`.github/workflows/ci.yml`）

流程：checkout → setup JDK 17（Temurin，带 Maven 缓存）→ `mvn -B verify`（Checkstyle + 测试 + 覆盖率门禁）→ `docker build -f Dockerfile.ci` → 收集并上传 artifacts（各模块 jar + `jacoco.xml` + `SERVER_VALIDATION_CHECKLIST.md`，保留 14 天）→ 失败通知占位步骤。

密钥全部从 GitHub Secrets 读取：`QWEN_API_KEY`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`REDIS_PASSWORD`、`DINGTALK_WEBHOOK_URL`、`FAILURE_EMAIL_TO`。**没有硬编码**，但新环境需要在仓库 Settings → Secrets 里把这些建出来（前四个不建也能跑，只是相关功能为空）。

> ⚠️ **当前 CI 永远不会触发**：触发分支写的是 `main` / `develop`，而项目实际分支是 `master`。接手后第一件事就是把它改成 `master`（见 `02_PROJECT_HANDOFF.md` 第 9 节 P0-2）。

---

## 8. 新环境就绪检查清单

按顺序打勾，全部通过即视为迁移成功：

- [ ] `git clone` 成功，`git log -1 --oneline` 显示 `a53e62a`（或更新）
- [ ] `java -version` → 17.x；`mvn -v` → 3.9.x；`node -v` → 20+；`pnpm -v` 可用
- [ ] 已处理 `.mvn/settings.xml` 的硬编码 `localRepository`（第 3.1 节）
- [ ] `mvn -s .mvn/settings.xml -B verify` → BUILD SUCCESS，Checkstyle 0 violation，JaCoCo 门禁通过
- [ ] `cd web && pnpm install --frozen-lockfile` 成功
- [ ] `pnpm typecheck` → 0 错误
- [ ] `pnpm test` → 105 files / 1852 tests passed，覆盖率 ≥ 阈值
- [ ] `pnpm build` → 0 错误
- [ ] `pnpm dev` 能打开 `http://localhost:5173`，首页与 `/dashboard/conversations` 正常渲染（无后端时应显示示例数据提示条）
- [ ] `docker compose config` 语法校验通过（若本机有 Docker）
- [ ] 已阅读并执行 `04_SECRETS_HANDLING.md` 的密钥轮换
- [ ] 已修 CI 触发分支为 `master`，并看到第一条绿色流水线
