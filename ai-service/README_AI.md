# AI Service

`ai-service` contains the Qwen client wrapper used by KiliSocial.

## QwenClient Behavior

- Supports `qwen-turbo` and `qwen-max`.
- Validates request input before calling the HTTP transport.
- Retries transient failures up to 3 attempts.
- Uses exponential backoff: 100 ms, then 200 ms.
- Returns a preset fallback template when all attempts fail.
- Does not call the real Qwen API in unit tests.
- Does not require MySQL or Redis for `mvn test`.

## Token Usage Log

The client records model, input tokens, output tokens, and estimated USD cost.

Example:

```text
qwen_token_usage model=qwen-turbo input_tokens=120 output_tokens=80 cost_usd=8.399999999999998E-8
```

Formatted example used by tests:

```text
qwen_token_usage model=qwen-turbo input_tokens=120 output_tokens=80 cost_usd=0.0000000840
```

## Semantic Cache Key

Redis key format:

```text
qwen:cache:{model}:{sha256(prompt)}
```

Example:

```text
qwen:cache:qwen-turbo:a94eb709fb27abb1097000cbd3a43d5ba95444dcc70a5c670f3a2a8c4808e58c
```

TTL:

```text
24 hours
```

Unit tests validate the key format and simulate cache writes with an in-memory `Map`, without connecting to Redis.
