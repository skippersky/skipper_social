# WhatsApp Webhook Integration

This module exposes the Meta WhatsApp webhook receiver:

```text
GET  /api/v1/wa/webhook
POST /api/v1/wa/webhook
```

No business reply logic is implemented in this module.

## Meta Console Setup

1. Open Meta for Developers.
2. Select the app that owns the WhatsApp Business API test number.
3. Go to WhatsApp > Configuration.
4. Set Callback URL:

```text
https://<your-domain>/api/v1/wa/webhook
```

5. Set Verify Token to the server value of `WA_VERIFY_TOKEN`.
6. Subscribe to message webhook fields.
7. Save and verify.

## Required Environment Variables

```bash
WA_VERIFY_TOKEN=<replace_on_server>
WA_APP_SECRET=<replace_on_server>
```

Do not commit real tokens or app secrets.

## Verification Curl

```bash
curl -i "https://<your-domain>/api/v1/wa/webhook?hub.mode=subscribe&hub.verify_token=${WA_VERIFY_TOKEN}&hub.challenge=hello-wa"
```

Expected:

```text
HTTP/1.1 200
hello-wa
```

## Local POST Curl

Create a payload file:

```bash
cat > wa-text-payload.json <<'JSON'
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "254712345678",
          "type": "text",
          "text": {"body": "hello"}
        }]
      }
    }]
  }]
}
JSON
```

Generate the Meta-style signature:

```bash
SIGNATURE="sha256=$(openssl dgst -sha256 -hmac "${WA_APP_SECRET}" -binary wa-text-payload.json | xxd -p -c 256)"
```

Send the request:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${SIGNATURE}" \
  --data @wa-text-payload.json \
  "https://<your-domain>/api/v1/wa/webhook"
```

Expected:

```text
HTTP/1.1 200
ok
```

## Supported Message Types

- `text`
- `image`
- `location`

Unknown message types are logged as `WARN` and still return `200 OK` to prevent Meta retry storms.

## Logging And Masking

Request and response bodies are logged at `DEBUG` level. Phone numbers are masked before logging.

Example:

```text
WA webhook request body={"from":"254****5678","type":"text"}
WA message parsed from=254****5678 type=text payload=hello
```

## Signature Verification Reuse

`wa-webhook-controller` reuses the pure utility below instead of implementing HMAC logic locally:

```text
com.kilisocial.ai.security.WebhookSignatureVerifier
```
