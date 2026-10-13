# KiliSocial 密钥清单与轮换手册

> 配套 `02_PROJECT_HANDOFF.md`。**本文只记录密钥的位置、用途和处置方式，不复制任何明文值。**
>
> 结论先行：有 **2 个真实的第三方平台密钥已经以明文形式提交进 git 历史**，GitHub PAT 曾在明文对话与命令行中出现过。迁移到新环境时，**这三项必须轮换**。

---

## 1. 密钥清单

### 1.1 已进入版本库（高风险）

| 位置 | 配置项 | 性质 | 处置 |
| --- | --- | --- | --- |
| `app/src/main/resources/application.yml` | `kili.social.facebook.app-secret` | **明文真实值**，Meta 测试应用 | 🔴 P0：在 Meta 开发者后台重置 App Secret，然后改为 `${FACEBOOK_APP_SECRET:}` 占位 |
| `app/src/main/resources/application.yml` | `kili.social.tiktok.client-secret` | **明文真实值**，TikTok 测试应用 | 🔴 P0：在 TikTok 开发者后台重置 Client Secret，然后改为 `${TIKTOK_CLIENT_SECRET:}` 占位 |
| `app/src/main/resources/application.yml` | `kili.social.facebook.app-id`、`kili.social.tiktok.client-key` | 半公开标识符（本身不算机密，但与 secret 配对后可用） | 🟡 建议一并外置为环境变量 |
| `app/src/main/resources/application.yml` | `kili.social.tiktok.redirect-uri` | 公开回调地址 `https://social.hengzhanwujin.com/social/tiktok/callback` | 🟢 无需处理 |

这两个 secret 是在提交 `c8cb1c5` 引入的，**已经存在于 git 历史**，即使现在改掉工作区文件也追不回来。由于仓库已推送到公网 GitHub（`skippersky/skipper_social`），必须按「已泄露」处理。

> 用户当时是主动提供并要求写入配置文件的，理由为「测试专用 API」。即便如此，公网仓库 + 明文 secret 的组合仍然不合规：`DEV_GUIDE.md` 第 4 节明确写着「密钥管理：API Key/密码禁止硬编码；使用环境变量或 Vault」，`PROJECT_BOUNDARIES.md` 的 🚫 NEVER DO 也包含类似条款。

### 1.2 未进入版本库，只存在于服务器 `.env`

`/opt/kilisocial/skipper_social/.env`（由 `.env.example` 复制生成，`.gitignore` 已排除）。清单如下：

| 变量 | 来源 | 用途 |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | `init-deploy.sh` 用 `openssl rand -hex 16` 自动生成 | MySQL root |
| `REDIS_PASSWORD` | 同上，自动生成 | Redis `requirepass` |
| `QWEN_API_KEY` | 需人工填 | 通义千问 DashScope 调用（`kili.qwen.api-key` 已正确写成 `${QWEN_API_KEY:}`） |
| `WA_VERIFY_TOKEN` | 需人工填 | WhatsApp Webhook 验证握手 |
| `WA_APP_SECRET` | 需人工填 | WhatsApp Webhook 签名校验（`X-Hub-Signature-256`） |
| `WA_ACCESS_TOKEN` | 需人工填 | WhatsApp 发送消息 |
| `WA_PHONE_NUMBER_ID` | 需人工填 | WhatsApp 号码 ID |
| `FACEBOOK_ACCESS_TOKEN` | 需人工填 | FB Graph API |
| `FACEBOOK_PAGE_ID` | 需人工填 | FB 主页 ID |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | 需人工填 | IG 商业账号 ID |
| `TIKTOK_WEBHOOK_SECRET` | 需人工填 | TikTok Webhook 签名 |
| `APP_PORT` / `WEB_PORT` / `MYSQL_PORT` / `REDIS_PORT` 及对应 `*_BIND_HOST` | 默认值 | 端口与绑定地址，非机密 |
| `JAVA_OPTS` | 默认 `-Xms256m -Xmx768m` | 非机密 |

**注意**：`docker-compose.yml` 目前只把 `QWEN_API_KEY` 和 4 个 `WA_*` 变量传进 app 容器。`FACEBOOK_*` / `INSTAGRAM_*` / `TIKTOK_*` 这几项**虽然在 `.env.example` 里定义了，但没有被 compose 传给容器**，也没有被 `application.yml` 引用（FB/TikTok 走的是硬编码明文那条路）。补后端社交渠道集成时需要把这条链路补齐。

`web/.env.example` 只有 `pk_test_REPLACE_ME` / `REPLACE_ME` 占位符，安全。

### 1.3 代码托管与 CI

| 项 | 位置 | 处置 |
| --- | --- | --- |
| GitHub PAT（`skippersky` 账号） | 仅出现在明文对话与 `git push https://skippersky:<PAT>@...` 命令行里 | 🔴 P0：**立即在 GitHub 上 revoke 并重新生成**。仓库内已确认无残留（`rg` 全库扫描无 `github_pat_` 命中），`.git/config` 的 remote 也没有内嵌 PAT。但要检查本机 shell 历史（PowerShell `ConsoleHost_history.txt` / bash `.bash_history`） |
| 新 PAT 的 scope | — | 需要 `repo` + **`workflow`**（否则推送含 `.github/workflows/` 的提交会被 403 拒绝） |
| GitHub Actions Secrets | 仓库 Settings → Secrets and variables → Actions | 需配置：`QWEN_API_KEY`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`REDIS_PASSWORD`、`DINGTALK_WEBHOOK_URL`、`FAILURE_EMAIL_TO`。`ci.yml` 全部通过 `${{ secrets.* }}` 引用，**无硬编码** |
| 内网 GitLab 凭证 | `origin` = `http://sz.git.egatee.cn:90/2b2c/quickbiz/kili-social` | 若新环境仍在内网，需要对应账号；若已脱离内网，可直接改 `origin` 指向 GitHub |

### 1.4 服务器上的其他敏感物料

| 项 | 路径 | 说明 |
| --- | --- | --- |
| TLS 私钥 | `/etc/letsencrypt/live/social.hengzhanwujin.com/privkey.pem` | certbot 管理，权限 600，别复制别入库 |
| MySQL 数据目录 | `/opt/kilisocial/skipper_social/data/mysql` | 真实数据，含用户表。迁移服务器时要一并备份，且备份文件本身是敏感物料 |
| Redis 数据目录 | `/opt/kilisocial/skipper_social/data/redis` | RDB 快照（AOF 已关闭，`save 60 1`） |
| 部署产物 | `/opt/kilisocial/skipper_social/.env` | 见 1.2 |

---

## 2. 轮换步骤（按顺序执行）

### 第 1 步：GitHub PAT

1. GitHub → Settings → Developer settings → Personal access tokens → 找到当前 token → **Revoke**。
2. 新建 token，勾选 `repo` 与 **`workflow`** scope。
3. 清理本机 shell 历史里的旧 token 字符串。
4. 用新 token 验证一次推送（建议推到临时分支再删掉，避免污染 `master`）。

### 第 2 步：Meta（Facebook / Instagram）App Secret

1. developers.facebook.com → 对应 App → Settings → Basic → App Secret → **Show / Reset**。
2. 重置后立刻把新值写进服务器 `.env`（新增一行 `FACEBOOK_APP_SECRET=...`）。

### 第 3 步：TikTok Client Secret

1. developers.tiktok.com → 对应 App → Credentials → Client Secret → 重置。
2. 新值写进服务器 `.env`（`TIKTOK_CLIENT_SECRET=...`）。

### 第 4 步：把 `application.yml` 改成环境变量占位

仓库里已经有两种正确的做法可以照抄：

- `application.yml` 里 `kili.qwen.api-key: ${QWEN_API_KEY:}`（配置文件占位）；
- `WaWebhookProperties` 里 `@Value("${WA_VERIFY_TOKEN:${wa.verify-token:}}")`（代码内读环境变量并带二级兜底）。WA 的 4 个密钥就是靠这条链路生效的，`application.yml` 里根本没有它们。

把 FB / TikTok 的明文替换为同样的占位符：

```yaml
kili:
  social:
    facebook:
      app-id: ${FACEBOOK_APP_ID:}
      app-secret: ${FACEBOOK_APP_SECRET:}
    tiktok:
      client-key: ${TIKTOK_CLIENT_KEY:}
      client-secret: ${TIKTOK_CLIENT_SECRET:}
```

同时在 `docker-compose.yml` 的 `app.environment` 下补上这四个变量（当前只传了 QWEN 和 WA_*），在 `.env.example` 里补上对应的 `change_me_*` 占位。

> ⚠️ 改完必须跑 `mvn -B verify` 与 `docker compose config`，并确认 `CopywritingController` / `WaWebhookController` 的测试仍然通过（它们不依赖这些社交凭证，理论上无影响）。

### 第 5 步：服务器自动生成的数据库口令

`MYSQL_ROOT_PASSWORD` 与 `REDIS_PASSWORD` 是 `init-deploy.sh` 随机生成的，本身强度足够。若要轮换：改 `.env` → `docker compose down` → 由于 MySQL 数据目录已初始化，**改 `.env` 不会改已存在的 root 密码**，需要进容器执行 `ALTER USER` 或清空 `./data/mysql` 重建（会丢数据，谨慎）。

### 第 6 步：确认没有新的泄露

```bash
# 全库扫描常见密钥模式（应无命中）
rg -n "github_pat_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|-----BEGIN" --hidden -g "!.git" .

# 确认 .env 没被跟踪（应无输出）
git ls-files | grep -E "(^|/)\.env$"

# 确认 application.yml 里不再有明文 secret（应只看到 ${...} 占位）
rg -n "app-secret|client-secret" app/src/main/resources/application.yml
```

---

## 3. 是否要清洗 git 历史

**建议：不做历史重写，改为「假定已泄露 + 全部轮换」。** 理由：

- 这两个 secret 属于**测试环境凭证**，影响面有限；
- 历史重写（`git filter-repo` / BFG）会改变所有 commit hash，而部署服务器是按 `git pull` 增量更新的，强推会直接打断线上部署流程，需要重新 clone；
- 仓库已推送到公网并被 CI/服务器引用，重写后所有下游都要同步。

如果产品/安全团队坚持要清洗，流程是：`git filter-repo` 清除该文件的历史版本 → 强推 GitHub → 服务器上删除 `/opt/kilisocial/skipper_social` 重新 clone → 重跑 `init-deploy.sh`。**但即便清洗了历史，密钥仍然必须轮换**（GitHub 可能已被爬取）。

---

## 4. 长期建议

1. `application.yml` 只保留结构与占位符，所有机密一律 `${ENV_VAR:}`；本地开发用不入库的 `application-local.yml` 或 `.env`。
2. 引入 Spring profile 分离（`dev` / `prod`），避免生产配置和代码同仓。
3. 服务器侧考虑用 Docker secrets 或外部密钥管理（Vault / SSM）替代明文 `.env`。
4. 在 CI 里加一步密钥扫描（gitleaks / trufflehog），把「明文密钥入库」变成构建失败而不是事后发现。
5. 建立密钥台账：谁持有、何时轮换、过期提醒。当前这份文档可作为台账起点。
