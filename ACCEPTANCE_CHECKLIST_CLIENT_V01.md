# 客户端 v0.1 验收清单（social.hengzhanwujin.com）

适用部署：前端编辑器 web（Vant/PWA）+ AI 文案接口 + Nginx 路由拆分（/ 走前端，API 走后端）。

## 预期结果总览

1. 打开 https://social.hengzhanwujin.com/ 不再返回 JSON，自动跳转到 /editor，显示文案编辑器界面
2. 四个容器 kilisocial_app / kilisocial_web / kilisocial_mysql / kilisocial_redis 全部 healthy
3. /api、/actuator、/swagger-ui、/v3 走后端 18080，其余路径走前端 18081
4. 新接口 POST /api/v1/ai/copywriting 可用（模板：en / swahili × social_post / caption_generation）
5. 存量接口（hello、WA webhook、health）回归正常，端口仍只监听 127.0.0.1

## 0. 前置检查（部署前/后各一次）

- [ ] 服务器代码已更新：`cd /opt/kilisocial/skipper_social` 后 `git log -1 --oneline` 为客户端 v0.1 提交
- [ ] `ls /opt/kilisocial/skipper_social/web` 非空（前端源码已随仓库拉取）
- [ ] `grep QWEN_API_KEY /opt/kilisocial/skipper_social/.env` 有真实 Key；没有则 AI 只会返回降级文案 [CONTENT_UNAVAILABLE]（属预期，不算失败）
- [ ] `sudo bash scripts/init-deploy.sh` 执行完成，末尾输出 deployment finished

## 1. 容器状态

- [ ] `docker compose ps` → app / web / mysql / redis 四个容器均为 healthy
- [ ] `docker compose logs --tail=30 web` → nginx 正常启动，无 error
- [ ] `docker compose logs app --tail=50 | grep -iE "error|exception"` → 无非预期错误

## 2. 域名与 TLS

- [ ] `curl -s https://social.hengzhanwujin.com/actuator/health` → `{"status":"UP"}`
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/` → 200
- [ ] `curl -s https://social.hengzhanwujin.com/ | grep -o 'id="app"'` → 输出 `id="app"`（返回前端 HTML 而非 JSON）

## 3. 前端路由与 PWA

- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/editor` → 200
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/drafts` → 200
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/manifest.webmanifest` → 200
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/sw.js` → 200

## 4. API（回归 + 新增）

- [ ] `curl -s https://social.hengzhanwujin.com/api/v1/hello` → success:true，含 "Hello from KiliSocial"
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/swagger-ui/index.html` → 200
- [ ] 文案生成（正常）：
  `curl -s -X POST https://social.hengzhanwujin.com/api/v1/ai/copywriting -H "Content-Type: application/json" -d "{"locale":"swahili","contentType":"social_post","variables":{"content":"Karibu duka letu"}}"`
  有 Qwen Key → 200 且 data 为斯瓦希里语文案；无 Key → 200 且 data 为 [CONTENT_UNAVAILABLE]，app 日志有 ERROR 降级记录
- [ ] 模板不存在：把上面 locale 改为 `fr` → HTTP 404，code=TEMPLATE_NOT_FOUND
- [ ] 参数校验：把 locale 改为空字符串 → HTTP 400
- [ ] WA 回归：`curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/api/v1/wa/webhook` → 400（缺验证参数）；带错误 token 时为 403，均属验证逻辑生效

## 5. 浏览器人工验收（直接打开域名）

- [ ] 首页自动跳转 /editor，可见：语言切换（English / Swahili）、内容类型、AI 生成按钮、保存草稿按钮、"平台账号审核中"提示
- [ ] 输入内容 → 保存草稿 → /drafts 页出现该草稿；刷新页面后仍存在（离线本地存储）
- [ ] 删除草稿立即从列表消失
- [ ] 点 AI 生成：有 Qwen Key 返回生成文案并展示；无 Key 显示降级提示，不白屏
- [ ] 界面没有"发布到 FB/IG/TikTok"的实际入口，或明确显示审核中（账号审核期间为预期设计，非缺陷）

## 6. 安全

- [ ] `ss -tuln | grep -E "18080|18081|13306|16379"` → 全部绑定 127.0.0.1，无 0.0.0.0
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://social.hengzhanwujin.com/.env` → 404

## 7. 失败处理

- 构建/启动失败：`docker compose logs --tail=100 app` 查看原因，修复后重跑 `sudo bash scripts/init-deploy.sh`
- 回滚：`git -C /opt/kilisocial/skipper_social checkout <上一个提交>` 后重跑 init-deploy.sh
