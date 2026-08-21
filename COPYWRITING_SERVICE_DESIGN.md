# Copywriting Service Design

## Scope

`copywriting-service` prepares AI-generated copy for later business integration. It does not connect to a real
database, Redis, or Qwen API in local tests. `PromptRepository`, `SemanticCache`, and `QwenClient` are mocked by unit
tests.

## Core Flow

1. `generate(locale, contentType, variables)` loads the active prompt template from `prompt_config`.
2. Variables in `user_template` are rendered with `{variable}` syntax.
3. The full prompt is built as:

```text
{system_prompt}

{rendered_user_template}
```

4. The semantic cache key is generated with the Sprint 0 rule.
5. Cache hit returns cached copy without calling Qwen.
6. Cache miss calls `QwenClient.generate(...)`.
7. Qwen failures return `[CONTENT_UNAVAILABLE]` and write an `ERROR` log.

## Prompt Template Examples

English example:

```text
name: en_social_post
model: qwen-turbo
system_prompt: You write concise, factual merchant copy.
user_template: Create a {tone} post for {product} targeting {audience}.
version: 1
is_active: true
```

Swahili example:

```text
name: sw_social_post
model: qwen-turbo
system_prompt: Unaandika matangazo mafupi na sahihi kwa wafanyabiashara.
user_template: Tengeneza tangazo la mtindo wa {tone} kwa bidhaa {product} kwa wateja {audience}.
version: 1
is_active: true
```

These examples are documentation only. Business-specific prompts are intentionally not implemented here.

## Cache Key Rule

The service reuses `com.kilisocial.ai.cache.SemanticCacheKeyGenerator`.

```text
qwen:cache:{model}:{sha256(prompt)}
```

Example:

```text
model = qwen-turbo
prompt = system_prompt + "\n\n" + rendered_user_template
ttl = 24h
```

The TTL comes from `SemanticCacheKeyGenerator.CACHE_TTL`.

## Error Codes And Fallback

| Case | Exception / Response | Behavior |
| --- | --- | --- |
| Missing template variable | `IllegalArgumentException("Missing variable: xxx")` | No Qwen call |
| Prompt template not found | `IllegalArgumentException("Prompt template not found")` | No Qwen call |
| Unsupported Qwen model | `IllegalArgumentException("Unsupported Qwen model: xxx")` | No Qwen call |
| QwenClient runtime failure | `[CONTENT_UNAVAILABLE]` | `ERROR` log and fallback response |

Fallback response format:

```text
[CONTENT_UNAVAILABLE]
```

Fallback log example:

```text
ERROR com.kilisocial.copywriting.service.CopywritingService
Copywriting generation failed locale=en contentType=social_post
java.lang.IllegalStateException: mock qwen failure
```

## Integration Notes

This design does not conflict with `WA_WEBHOOK_INTEGRATION.md`. WA webhook receipt remains responsible only for Meta
verification, signature validation, message parsing, logging, and `200 OK` acknowledgement. Copywriting generation is a
separate service prepared for later orchestration.
