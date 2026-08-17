package com.kilisocial.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;

import java.io.IOException;
import java.util.Set;

/**
 * Client facade for Qwen text generation.
 */
public class QwenClient {

    private static final int MAX_ATTEMPTS = 3;
    private static final long INITIAL_BACKOFF_MILLIS = 100L;
    private static final String FALLBACK_TEMPLATE = "We are preparing your marketing copy. Please try again shortly.";

    private final QwenHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final TokenUsageLogger tokenUsageLogger;
    private final QwenSleeper sleeper;

    /**
     * Creates a Qwen client.
     *
     * @param httpClient HTTP transport
     * @param objectMapper JSON mapper
     * @param validator request validator
     * @param tokenUsageLogger token usage logger
     * @param sleeper retry sleeper
     */
    public QwenClient(
            QwenHttpClient httpClient,
            ObjectMapper objectMapper,
            Validator validator,
            TokenUsageLogger tokenUsageLogger,
            QwenSleeper sleeper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.tokenUsageLogger = tokenUsageLogger;
        this.sleeper = sleeper;
    }

    /**
     * Generates text through Qwen, retrying transient failures and falling back after retries are exhausted.
     *
     * @param request generation request
     * @return generation response
     */
    public QwenResponse generate(QwenRequest request) {
        validate(request);
        String requestBody = serializeRequest(request);
        long backoffMillis = INITIAL_BACKOFF_MILLIS;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return parseResponse(request.model(), httpClient.post(requestBody));
            } catch (IOException | RuntimeException exception) {
                if (attempt == MAX_ATTEMPTS) {
                    return fallback(request.model());
                }
                sleep(backoffMillis);
                backoffMillis = backoffMillis * 2;
            }
        }
        return fallback(request.model());
    }

    private void validate(QwenRequest request) {
        Set<ConstraintViolation<QwenRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
    }

    private String serializeRequest(QwenRequest request) {
        try {
            return objectMapper.writeValueAsString(new QwenApiRequestDTO(
                    request.model().getApiName(),
                    request.systemPrompt(),
                    request.userPrompt()
            ));
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to serialize Qwen request", exception);
        }
    }

    private QwenResponse parseResponse(QwenModelEnum model, String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        String content = root.at("/output/text").asText();
        int inputTokens = root.at("/usage/input_tokens").asInt();
        int outputTokens = root.at("/usage/output_tokens").asInt();
        TokenUsage usage = new TokenUsage(
                model.getApiName(),
                inputTokens,
                outputTokens,
                model.estimateCostUsd(inputTokens, outputTokens)
        );
        tokenUsageLogger.log(usage);
        return new QwenResponse(content, false, usage);
    }

    private QwenResponse fallback(QwenModelEnum model) {
        TokenUsage usage = new TokenUsage(model.getApiName(), 0, 0, 0D);
        tokenUsageLogger.log(usage);
        return new QwenResponse(FALLBACK_TEMPLATE, true, usage);
    }

    private void sleep(long backoffMillis) {
        try {
            sleeper.sleep(backoffMillis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Retry sleep interrupted", exception);
        }
    }

    private record QwenApiRequestDTO(String model, String systemPrompt, String userPrompt) {
    }
}
