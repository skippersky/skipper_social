# 09 · 测试规范与门禁

> 覆盖率门禁是 CI 的一部分，不达标直接构建失败。本文说明怎么写测试才能过。

---

## 1. 门禁数值

| 侧 | 工具 | 阈值 | 配置位置 | 校验时机 |
| --- | --- | --- | --- | --- |
| 后端 | JaCoCo 0.8.12 | `BUNDLE / LINE / COVEREDRATIO ≥ 0.80` | 根 `pom.xml` 的 `check-coverage` execution | `mvn verify` |
| 后端 | Checkstyle 10.18.2 | 0 violation | `config/checkstyle/checkstyle.xml` | `mvn verify` |
| 前端 | Vitest 2 + @vitest/coverage-v8 | `lines ≥ 80`、`statements ≥ 80`、`functions ≥ 70`、`branches ≥ 70` | `web/vite.config.ts` 的 `test.coverage.thresholds` | `pnpm test` |
| 前端 | vue-tsc | 0 类型错误 | `web/tsconfig.json` | `pnpm typecheck` |

前端覆盖率 `include: ['src/**/*.{ts,vue}']`，`exclude: ['src/main.ts', 'src/env.d.ts']`。

当前基线：前端 **97.84% stmts / 92.4% branch / 92.26% funcs**（105 文件 / 1852 用例）；
后端 7 模块 `BUILD SUCCESS`，51 用例（本机受限环境下为 49，见 `03_ENVIRONMENT_SETUP.md` 第 3.4 节）。

---

## 2. 后端测试约定

### 2.1 位置与命名

`<module>/src/test/java/com/kilisocial/<同主代码包路径>/<Class>Test.java`，包级可见（`class XxxTest`，不加 `public`）。
现有 18 个测试类，分布：

```
common               ApiResponseTest
app                  BusinessExceptionTest, GlobalExceptionHandlerTest, OpenApiConfigTest, HelloControllerTest
ai-service           SemanticCacheKeyGeneratorTest, QwenClientTest, QwenModelEnumTest,
                     JdkQwenHttpClientTest, WebhookSignatureVerifierTest
wa-webhook-controller WaWebhookControllerTest, PhoneMaskerTest
copywriting-service  InMemorySemanticCacheTest, CopywritingRuntimeConfigTest, CopywritingControllerTest,
                     ConfigurablePromptRepositoryTest, CopywritingServiceTest
wa-ai-integration    WaAiMessageHandlerTest
```

### 2.2 风格（照 `QwenClientTest` 抄）

- 断言库用 **AssertJ**（`assertThat(...)`、`within(...)`），不用 `assertEquals`。
- JSON 夹具用 **Java text block**（`"""`）声明为 `private static final String`。
- **魔法值一律提成常量**（`FIRST_BACKOFF_MILLIS`、`EXPECTED_INPUT_TOKENS`、`COST_ASSERTION_OFFSET`…）——
  这是 Checkstyle 会拦的，不是风格偏好。
- 每个公共测试类和方法都要有 Javadoc（`/** Tests for {@link QwenClient}. */`）。
- 用**可注入的测试接缝**替代 Mock 框架：
  - `QwenSleeper` / `ThreadQwenSleeper` —— 重试退避的 sleep 抽成接口，测试里传 `millis -> { }` 直接跳过等待；
  - `QwenHttpClient` / `JdkQwenHttpClient` —— HTTP 层抽成接口，测试里传 lambda 返回固定 body；
  - `TokenUsageLogger` —— 计量日志抽成接口，测试里用 `RecordingTokenUsageLogger` 收集后断言。
- 校验用真实的 `Validation.buildDefaultValidatorFactory().getValidator()`，不要 Mock 校验器。

### 2.3 外部依赖一律不联网

`DEV_GUIDE.md` 与历次需求单都要求：**单元测试不得调用真实 Qwen / Meta / TikTok / WhatsApp，不得依赖 Redis 或 MySQL**。
语义缓存用 `InMemorySemanticCache`（`SemanticCache` 接口已抽出，将来换 Redis 实现时测试不用改）。

### 2.4 集成测试（目前缺失）

`DEV_GUIDE.md` 要求「Testcontainers 启动真实 MySQL/Redis」，**目前一个都没有**。
补数据层时请一并补上，建议放在各模块 `src/test/java/.../*IT.java`，用 `maven-failsafe-plugin` 跑，
避免拖慢 `mvn test`。

---

## 3. 前端测试约定

### 3.1 位置与命名

全部平铺在 `web/src/__tests__/`，共 105 个文件，命名 `<subject>.test.ts`，**subject 全小写无分隔符**：

```
analyticsapi.test.ts    analyticsstore.test.ts   analyticsview.test.ts   analyticscomponents.test.ts
authapi.test.ts (auth.test.ts)  authguard.test.ts   authstore.test.ts
channelapi.test.ts  channelstore.test.ts  channelsview.test.ts  channelevents.test.ts
conversationcomponents.test.ts  chatview.test.ts  chatwindow.test.ts  inboxsocket.test.ts
websocket.test.ts  http.test.ts  ...
```

一个功能域通常拆成 4 个文件：`api` / `store` / `view` / `components`（或 `composables`）。**新增模块请沿用这个拆法**，
否则单文件会迅速膨胀到难以维护。

### 3.2 测试环境（`web/src/__tests__/setup.ts`，已配好，别绕过）

- `environment: 'jsdom'`；
- 补齐 jsdom 缺失的 `ResizeObserver` 与 `window.matchMedia`（Vue Flow 画布和 builder 需要）；
- **接管 `setTimeout` / `setInterval` 并在 `afterEach` 统一清理**，再等一个宏任务让微任务和 Vue flush 落地。
  这是为了避免 Vant notice bar 的滚动检测、看板防抖、WebSocket 心跳在 jsdom 拆除后触发
  `window is not defined` / `removeChild NotFoundError`。**如果你的测试出现这类报错，先检查是不是自己起了未清理的定时器。**

### 3.3 HTTP 测试写法（照 `http.test.ts` 抄）

```ts
function stubFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok, status, statusText: 'status', json: async () => payload
  }));
}

describe('apiPost', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns data on success envelope', async () => {
    stubFetch({ success: true, code: 'OK', message: 'success', data: 'hello' });
    await expect(apiPost('/x', { a: 1 })).resolves.toBe('hello');
  });

  it('throws ApiError when envelope fails', async () => {
    stubFetch({ success: false, code: 'TEMPLATE_NOT_FOUND', message: 'nope', data: null });
    await expect(apiPost('/x', {})).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
  });
});
```

要点：
- 一律 `vi.stubGlobal('fetch', ...)`，**不要 mock `http.ts` 本身**（除非测的就是调用方）；
- `afterEach` 必须 `vi.unstubAllGlobals()`，涉及假定时还要 `vi.useRealTimers()`；
- 响应体必须是完整的 `ApiResponse` 信封，`unwrap()` 会检查 `success`；
- 测降级链路时构造 `ok: false, status: 404` 或让 fetch reject，然后断言返回了 `demoXxx()` 的数据且带 `demo: true`。

### 3.4 组件测试

用 `@vue/test-utils` 的 `mount`。Vant 在测试里**没有全量注册**，所以会出现
`[Vue warn]: Failed to resolve component: van-skeleton` 之类告警——**这是已知噪音，不影响断言，不要去"修"它**。
如果确实需要某个 Vant 组件的行为，用 `global.stubs` 或 `global.plugins` 局部注册。

---

## 4. 新增一个模块时的测试清单

以「实现后端 `/api/v1/customers` 并让前端切到真实数据」为例：

后端：
- [ ] `CustomerControllerTest`：正常返回信封、参数校验失败、未授权、组织隔离（不同 `X-Organization-Id` 看不到彼此数据）
- [ ] `CustomerServiceTest`：业务规则、逻辑删除（`deleted_at`）
- [ ] `CustomerRepositoryIT`（Testcontainers）：真实 SQL、索引、分页
- [ ] Flyway 迁移能在干净库上跑通
- [ ] `mvn verify` 通过（Checkstyle 0 violation + JaCoCo ≥ 80%）

前端：
- [ ] `customersapi.test.ts`：真实响应解析 + 后端缺失时降级到 `demoXxx()`
- [ ] `customersstore.test.ts`：状态流转、loading/error
- [ ] `customersview.test.ts`：加载骨架屏、错误重试按钮、空状态、示例数据提示条
- [ ] 三语文案 key 齐全（缺 key 会显示裸 key，测试里可断言）
- [ ] `pnpm test` 覆盖率仍 ≥ 阈值

---

## 5. 交付时怎么给测试证据

必须贴真实输出，节选关键行即可：

```
Test Files  105 passed (105)
     Tests  1852 passed (1852)
All files   | 97.84 % Stmts | 92.4 % Branch | 92.26 % Funcs | 97.84 % Lines
```

```
[INFO] Reactor Summary for kili-social 0.0.1-SNAPSHOT:
[INFO] common ............ SUCCESS   [INFO] app ............ SUCCESS
[INFO] BUILD SUCCESS
```

**禁止**：用正则扫描代替 Checkstyle 执行结果、估算覆盖率、只说「测试通过」不给数字。
