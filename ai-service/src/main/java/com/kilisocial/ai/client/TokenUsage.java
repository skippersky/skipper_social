package com.kilisocial.ai.client;

/**
 * Token usage metrics for one AI request.
 *
 * @param model model name
 * @param inputTokens input token count
 * @param outputTokens output token count
 * @param costUsd estimated cost in USD
 */
public record TokenUsage(
        String model,
        int inputTokens,
        int outputTokens,
        double costUsd
) {
}
