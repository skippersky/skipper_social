package com.kilisocial.ai.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Logs token usage metrics.
 */
public class TokenUsageLogger {

    private static final Logger LOGGER = LoggerFactory.getLogger(TokenUsageLogger.class);

    /**
     * Logs one token usage event.
     *
     * @param usage token usage metrics
     */
    public void log(TokenUsage usage) {
        LOGGER.info("qwen_token_usage model={} input_tokens={} output_tokens={} cost_usd={}",
                usage.model(), usage.inputTokens(), usage.outputTokens(), usage.costUsd());
    }

    /**
     * Formats token usage for tests and operational examples.
     *
     * @param usage token usage metrics
     * @return formatted log message
     */
    public String format(TokenUsage usage) {
        return "qwen_token_usage model=%s input_tokens=%d output_tokens=%d cost_usd=%.10f"
                .formatted(usage.model(), usage.inputTokens(), usage.outputTokens(), usage.costUsd());
    }
}
