# WA AI Integration Test Plan

## Scope

`wa-ai-integration` connects parsed WhatsApp webhook messages to `CopywritingService`. It performs routing and variable
adaptation only. It does not call WhatsApp, Qwen, MySQL, or Redis directly.

## Message Mapping

| WA message type | Copywriting locale | Copywriting contentType | Variables | AI call |
| --- | --- | --- | --- | --- |
| `text` | `swahili` | `social_reply` | `{content: msg.payload}` | Yes |
| `image` | `swahili` | `caption_generation` | `{media_url: msg.payload}` | Yes |
| `location` | N/A | N/A | N/A | No |
| unknown | N/A | N/A | N/A | No |

`WaMessage.payload` is the integration contract from `wa-webhook-controller`. For image messages it is treated as the
media URL or media reference that the upstream parser/business layer provides.

## Server End-To-End Test Cases

### 1. Text Message Generates Social Reply

Input webhook message:

```json
{
  "from": "254712345678",
  "type": "text",
  "text": {"body": "Nahitaji tangazo la sabuni"}
}
```

Expected integration behavior:

```text
CopywritingService.generate("swahili", "social_reply", {"content": "Nahitaji tangazo la sabuni"})
```

Expected logs:

```text
DEBUG com.kilisocial.wa.ai.integration.WaAiMessageHandler
Routing WA text message to contentType=social_reply
```

### 2. Image Message Generates Caption

Input webhook message:

```json
{
  "from": "254712345678",
  "type": "image",
  "image": {"id": "https://cdn.example.test/media/image-1.jpg"}
}
```

Expected integration behavior:

```text
CopywritingService.generate("swahili", "caption_generation", {"media_url": "https://cdn.example.test/media/image-1.jpg"})
```

Expected logs:

```text
DEBUG com.kilisocial.wa.ai.integration.WaAiMessageHandler
Routing WA image message to contentType=caption_generation
```

### 3. Location Message Skips AI

Input webhook message:

```json
{
  "from": "254712345678",
  "type": "location",
  "location": {"latitude": -1.2921, "longitude": 36.8219}
}
```

Expected integration behavior:

```text
No CopywritingService call.
Return: Asante kwa ujumbe wako. Kwa sasa tunaweza kushughulikia maandishi au picha pekee.
```

Expected logs:

```text
INFO com.kilisocial.wa.ai.integration.WaAiMessageHandler
Skipping AI generation for WA message type=location
```

### 4. Unknown Message Type Skips AI

Input webhook message:

```json
{
  "from": "254712345678",
  "type": "audio",
  "audio": {"id": "audio_media_id"}
}
```

Expected integration behavior:

```text
No CopywritingService call.
Return: Asante kwa ujumbe wako. Kwa sasa tunaweza kushughulikia maandishi au picha pekee.
```

Expected logs:

```text
INFO com.kilisocial.wa.ai.integration.WaAiMessageHandler
Skipping AI generation for WA message type=audio
```

### 5. Copywriting Exception Propagates

Mock `CopywritingService.generate(...)` to throw:

```text
IllegalArgumentException("Prompt template not found")
```

Expected behavior:

```text
The integration handler propagates the exception to the caller.
```

## Non-Goals

- No business reply sending.
- No database, Redis, Qwen, or WhatsApp API connections.
- No changes to `ai-service`, `copywriting-service`, or `wa-webhook-controller` internals.
