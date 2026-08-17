package com.kilisocial.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.within;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link QwenClient}.
 */
class QwenClientTest {

    private static final String SUCCESS_RESPONSE = """
            {
              "output": {
                "text": "Fresh social copy"
              },
              "usage": {
                "input_tokens": 120,
                "output_tokens": 80
              }
            }
            """;
    private static final long FIRST_BACKOFF_MILLIS = 100L;
    private static final long SECOND_BACKOFF_MILLIS = 200L;
    private static final int EXPECTED_INPUT_TOKENS = 120;
    private static final int EXPECTED_OUTPUT_TOKENS = 80;
    private static final double EXPECTED_TURBO_COST_USD = 0.000000084D;
    private static final double COST_ASSERTION_OFFSET = 0.000000001D;

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void generateParsesNormalResponse() {
        RecordingTokenUsageLogger logger = new RecordingTokenUsageLogger();
        QwenClient client = newClient(body -> SUCCESS_RESPONSE, logger, millis -> { });

        QwenResponse response = client.generate(request(QwenModelEnum.QWEN_TURBO));

        assertThat(response.content()).isEqualTo("Fresh social copy");
        assertThat(response.fallback()).isFalse();
        assertThat(response.tokenUsage().model()).isEqualTo("qwen-turbo");
        assertThat(logger.usages()).hasSize(1);
    }

    @Test
    void generateRetriesTransientFailure() {
        AtomicInteger attempts = new AtomicInteger();
        RecordingTokenUsageLogger logger = new RecordingTokenUsageLogger();
        RecordingSleeper sleeper = new RecordingSleeper();
        QwenClient client = newClient(body -> {
            if (attempts.incrementAndGet() < 2) {
                throw new IOException("temporary unavailable");
            }
            return SUCCESS_RESPONSE;
        }, logger, sleeper);

        QwenResponse response = client.generate(request(QwenModelEnum.QWEN_MAX));

        assertThat(response.fallback()).isFalse();
        assertThat(attempts.get()).isEqualTo(2);
        assertThat(sleeper.backoffMillis()).containsExactly(FIRST_BACKOFF_MILLIS);
    }

    @Test
    void generateFallsBackAfterRetriesExhausted() {
        AtomicInteger attempts = new AtomicInteger();
        RecordingTokenUsageLogger logger = new RecordingTokenUsageLogger();
        RecordingSleeper sleeper = new RecordingSleeper();
        QwenClient client = newClient(body -> {
            attempts.incrementAndGet();
            throw new IOException("service unavailable");
        }, logger, sleeper);

        QwenResponse response = client.generate(request(QwenModelEnum.QWEN_TURBO));

        assertThat(response.fallback()).isTrue();
        assertThat(response.content()).contains("try again shortly");
        assertThat(attempts.get()).isEqualTo(3);
        assertThat(sleeper.backoffMillis()).containsExactly(FIRST_BACKOFF_MILLIS, SECOND_BACKOFF_MILLIS);
        assertThat(response.tokenUsage().costUsd()).isZero();
    }

    @Test
    void generateCalculatesTokenCost() {
        RecordingTokenUsageLogger logger = new RecordingTokenUsageLogger();
        QwenClient client = newClient(body -> SUCCESS_RESPONSE, logger, millis -> { });

        QwenResponse response = client.generate(request(QwenModelEnum.QWEN_TURBO));

        assertThat(response.tokenUsage().inputTokens()).isEqualTo(EXPECTED_INPUT_TOKENS);
        assertThat(response.tokenUsage().outputTokens()).isEqualTo(EXPECTED_OUTPUT_TOKENS);
        assertThat(response.tokenUsage().costUsd()).isCloseTo(EXPECTED_TURBO_COST_USD, within(COST_ASSERTION_OFFSET));
        assertThat(logger.format(logger.usages().get(0)))
                .isEqualTo("qwen_token_usage model=qwen-turbo input_tokens=120 output_tokens=80 cost_usd=0.0000000840");
    }

    private QwenClient newClient(
            QwenHttpClient httpClient,
            RecordingTokenUsageLogger logger,
            QwenSleeper sleeper) {
        return new QwenClient(httpClient, new ObjectMapper(), validator, logger, sleeper);
    }

    private QwenRequest request(QwenModelEnum model) {
        return new QwenRequest(model, "You are a helpful marketer.", "Write a launch message.");
    }

    private static class RecordingTokenUsageLogger extends TokenUsageLogger {

        private final List<TokenUsage> usages = new ArrayList<>();

        @Override
        public void log(TokenUsage usage) {
            usages.add(usage);
            super.log(usage);
        }

        List<TokenUsage> usages() {
            return usages;
        }
    }

    private static class RecordingSleeper implements QwenSleeper {

        private final List<Long> backoffMillis = new ArrayList<>();

        @Override
        public void sleep(long millis) {
            backoffMillis.add(millis);
        }

        List<Long> backoffMillis() {
            return backoffMillis;
        }
    }
}
