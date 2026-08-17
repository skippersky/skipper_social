package com.kilisocial.ai.client;

/**
 * Qwen generation response.
 *
 * @param content generated content
 * @param fallback whether fallback template was used
 * @param tokenUsage token usage metrics
 */
public record QwenResponse(
        String content,
        boolean fallback,
        TokenUsage tokenUsage
) {
}
