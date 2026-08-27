package com.kilisocial.common.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link BusinessException}.
 */
class BusinessExceptionTest {

    @Test
    void constructorStoresCodeAndMessage() {
        BusinessException exception = new BusinessException("PAYMENT_LOCKED", "Payment operation is locked");

        assertThat(exception.getCode()).isEqualTo("PAYMENT_LOCKED");
        assertThat(exception.getMessage()).isEqualTo("Payment operation is locked");
    }
}
