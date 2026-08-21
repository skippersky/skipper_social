package com.kilisocial.wa.webhook.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link PhoneMasker}.
 */
class PhoneMaskerTest {

    @Test
    void maskHidesMiddleDigits() {
        assertThat(new PhoneMasker().mask("254712345678")).isEqualTo("254****5678");
    }
}
