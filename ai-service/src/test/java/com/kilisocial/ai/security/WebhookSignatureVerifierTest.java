package com.kilisocial.ai.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link WebhookSignatureVerifier}.
 */
class WebhookSignatureVerifierTest {

    private static final String PAYLOAD = "{\"hello\":\"world\"}";
    private static final String SECRET = "test_secret";

    @Test
    void isValidAcceptsMatchingSignature() {
        String signature = WebhookSignatureVerifier.sign(PAYLOAD, SECRET);

        assertThat(WebhookSignatureVerifier.isValid(PAYLOAD, signature, SECRET)).isTrue();
    }

    @Test
    void isValidRejectsWrongSignature() {
        assertThat(WebhookSignatureVerifier.isValid(PAYLOAD, "sha256=bad", SECRET)).isFalse();
    }
}
