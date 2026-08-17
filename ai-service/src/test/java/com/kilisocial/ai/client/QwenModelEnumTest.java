package com.kilisocial.ai.client;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link QwenModelEnum}.
 */
class QwenModelEnumTest {

    @Test
    void supportsTurboAndMaxApiNames() {
        assertThat(QwenModelEnum.QWEN_TURBO.getApiName()).isEqualTo("qwen-turbo");
        assertThat(QwenModelEnum.QWEN_MAX.getApiName()).isEqualTo("qwen-max");
    }
}
