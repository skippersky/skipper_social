# 05 · 协作流程与交付标准

> 这份文档记录的是**用户的实际工作方式**，从 Sprint 0 到 Sprint 13 的协作历史里总结出来。
> 照着做能显著减少返工。它不是官方流程文档，而是「和这个甲方合作的说明书」。

---

## 1. 基本约定

- **沟通语言**：中文。技术名词保留英文（`mvn verify`、`docker compose`、`X-Organization-Id`）。
- **回复长度**：控制在几十行内，先结论后细节。不要罗列所有改动。
- **执行风格**：用户期望你**直接把事做完**（改代码、跑验证、给证据），而不是给方案让他选。
  只有触碰 `PROJECT_BOUNDARIES.md` 红线或需要外部凭证时才停下来问。
- **谁提交代码**：**用户自己执行 git 提交和部署**。你负责改代码、给验证证据、给出可直接粘贴的提交命令与 commit message。
- **谁跑部署**：用户在 Ubuntu 服务器上自己跑 `bash scripts/init-deploy.sh` 或 `scripts/deploy.sh`，然后把输出贴回来。
  你无法直接访问那台服务器。

---

## 2. Sprint 需求单的固定格式

用户下达任务时几乎总是这个结构，读懂它比读懂需求本身更重要：

```
Context: <前面哪些 Sprint 已验收通过，当前做什么>

调用 Skill：            ← 仅 UI 类任务出现
/ui-ux-pro-max  /taste-skill  /hallmark

强制约束：              ← 环境限制或不可逾越的边界，例如「本地无 DB/Redis」「不修改其他模块」
- ...

Requirements / Task:    ← 编号的实现要求，通常细到文件路径和字段名
1. ...
2. ...

Acceptance Evidence:    ← 必须产出的运行时证据，逐条对应
- ...

注意：                  ← 禁止事项，例如「不实现业务逻辑」「不连接真实服务」
- ...
```

**开工前的三个检查**：

1. 「注意」和「强制约束」里有没有和你打算做的事冲突的？有就先问，别自己绕。
2. Acceptance Evidence 的每一条你**能不能真的产出**？要求覆盖率就必须真跑一遍拿到数字；
   要求截图就必须真的截图；要求命令输出就必须真的执行。
3. 是否触碰 `PROJECT_BOUNDARIES.md`？触及就先确认（历史上 Stripe 就是这么进来的）。

---

## 3. 交付标准：必须有运行时证据

这是从 Sprint 0 就被反复强调的铁律。用户原话：**「禁止仅提交代码修改作为证据」**。

合格的证据形式：

| 类型 | 举例 |
| --- | --- |
| 测试报告 | `Test Files 105 passed (105)` / `Tests 1852 passed (1852)` + 覆盖率表格实际数值 |
| 构建输出 | `mvn ... BUILD SUCCESS` 的 Reactor Summary；`vite build` 的产物行 |
| 静态检查 | Checkstyle / `vue-tsc` 的**实际执行结果**，不是正则扫描的替代 |
| 命令输出 | `docker compose ps` 的 healthy 状态、`curl` 的真实响应体、`mysql -e "SHOW VARIABLES..."` 的返回值 |
| 日志片段 | Token 计量日志、脱敏日志示例、降级 ERROR 日志 |
| 截图 | 桌面端 + 移动端两个视图；正常态 / 加载态 / 错误态 |

不合格的证据：「代码已写完，应该能跑」、「覆盖率预计 85%」、「逻辑与文档一致」。

> 环境受限时要**明说**。历史上任务 2（MySQL/Redis 容器化）因本地没有 Docker 而跳过，
> 明确记录为「服务器部署时补验」并生成了 `SERVER_VALIDATION_CHECKLIST.md`——这是被接受的处理方式。
> 假装验证过则不被接受。

---

## 4. 提交与推送

### 4.1 提交命令（给用户的格式）

用户明确要求过：**commit message 以你生成的为准**，并且要给出可直接粘贴的完整命令。
注意 Windows PowerShell 下 `git commit -m "..."` 的引号处理，历史上出现过
`error: unknown switch 'm'` 和 `fatal: pathspec 'XXX.mdgit' did not match` —— 
都是多行命令被粘贴成一行导致的。所以**给单行命令，文件名之间留空格，message 用双引号包好**：

```powershell
git add <文件1> <文件2> <文件3>
git commit -m "web sprint N: <一句话英文小写描述>"
```

### 4.2 commit message 风格

与既有历史保持一致：英文、小写、祈使句、无标点、一句话说清做了什么。实例：

```
web sprint 13: multi tenancy and rbac with org switcher members roles settings onboarding invitations route guards and permission directive
web sprint 11: ai marketing module with content generator recipient selection throttled batch send templates history and csv export
fix(web): make pricing plan cards clickable and carry the chosen plan into the upgrade flow
web: add channels entry on home page and widen channels dashboard to two column grid
```

前缀惯例：`web sprint N:` 前端迭代、`feat(web):` / `fix(web):` 小改动、`deploy:` 部署相关、无前缀 后端/杂项。
**一个 Sprint 一个提交**，不拆碎片。

### 4.3 推送

```bash
git push https://skippersky:<PAT>@github.com/skippersky/skipper_social.git master
```

- 必须显式写完整 URL：`origin` 指向内网 GitLab（`sz.git.egatee.cn`），推不动 GitHub。
- PAT 需要 `repo` + **`workflow`** scope，否则含 `.github/workflows/` 的提交会被 403 拒绝。
- 分支是 `master`。

---

## 5. 部署与验收回路

典型的一轮迭代闭环：

```
你改代码 + 本地验证（pnpm test / mvn verify）+ 给证据
   ↓
用户 git add / commit / push（用你给的命令）
   ↓
用户在服务器执行：
   cd /opt/kilisocial/skipper_social
   git pull
   bash scripts/deploy.sh        # 或首次 bash scripts/init-deploy.sh
   ↓
用户贴回部署输出 + 浏览器截图
   ↓
你判断是否符合预期 → 不符合则定位 → 回到第一步
```

### 5.1 部署没生效的排查顺序（高频问题）

用户反馈「UI 没变化 / 还是老样子」时，按这个顺序查：

1. `cd /opt/kilisocial/skipper_social && git log -1 --oneline` —— 服务器代码是不是真的更新了？
2. `git pull` 有没有因为本地改动被 abort？（历史上 `scripts/init-deploy.sh` 被服务器本地改过，导致
   `error: Your local changes ... would be overwritten by merge`。处理：`git stash` → `git pull` → `git stash pop`，
   **不要** `git checkout --` 丢弃服务器上的修改。）
3. `docker compose ps` 有没有输出？容器是不是 healthy？
4. `docker compose up -d --build` 是否真的重建了 web 镜像？（`Dockerfile.web` 里 `npm install` 无锁文件，
   构建缓存可能让你以为更新了。）
5. 浏览器强刷 / 无痕窗口（PWA 有 Service Worker，`registerType: 'autoUpdate'`，可能缓存旧版本）。

### 5.2 域名被别的项目抢走

历史上反复出现「访问 `social.hengzhanwujin.com` 跳到了其他项目」。排查：

```bash
sudo grep -rn "social.hengzhanwujin.com" /etc/nginx/conf.d /etc/nginx/sites-enabled
sudo nginx -T | grep -n "server_name"
```

`scripts/init-deploy.sh` 已内置重复 `server_name` 检测 + `nginx -t` 失败自动回滚 + 域名归属冒烟自检。
证书相关：`sudo certbot --nginx -d social.hengzhanwujin.com` 交互时选 `1`（reinstall），别选 `2`（触发续期限额）。

---

## 6. 用户验收时最常提的四类反馈

从历史看，UI 类返工集中在这四点，**做完自检一遍能省一轮**：

1. **「太居中、左右空旷」** —— 桌面端要用满宽度，不要把所有内容挤在中间一条。
   历史上为此专门做过「渠道管理页改两栏网格」「桌面端多列布局」。
2. **「示例数据没标识」** —— 只要是 demo 数据，必须有醒目的可关闭提示条，不能让用户误以为是真实数据。
3. **「缺返回按钮 / 交互不闭环」** —— 从首页能进去的页面，必须能回得来；入口和出口都要检查。
4. **「多语言没处理」** —— 全站右上角要有语言切换，en/zh/fr 三语文案齐全。

另外用户明确要求过的**长期风格方向**（写进了 `DESIGN_SYSTEM.md` v2.0）：
未来科技风、明亮色调、渐变强调、非洲元素克制点缀；**不要**暗色大地色、不要为了「非洲元素」而铺棕色网格背景。

---

## 7. 什么时候该停下来问用户

- 需求触碰 `PROJECT_BOUNDARIES.md` 的 ❌ 或 🚫 条目（例：支付渠道选 Stripe 还是 M-Pesa）。
- 需要真实第三方凭证、账号、审核状态（Meta / TikTok / WhatsApp / Qwen / Google OAuth）。
- 需要做大范围重构或合并历史冗余模块（会破坏已验收的测试）。
- 需要在服务器上执行有风险的操作（清数据目录、强推、删容器卷）。
- 需求单里「注意」的禁止项和「Requirements」自相矛盾。

其他情况：**默认直接做完并给证据**。
