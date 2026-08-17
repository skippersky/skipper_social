package com.kilisocial.ai.cache;

import com.kilisocial.ai.client.QwenModelEnum;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link SemanticCacheKeyGenerator}.
 */
class SemanticCacheKeyGeneratorTest {

    private static final int CACHE_TTL_HOURS = 24;

    @Test
    void generateUsesModelAndPromptSha256() {
        SemanticCacheKeyGenerator generator = new SemanticCacheKeyGenerator();

        String key = generator.generate(QwenModelEnum.QWEN_TURBO, "hello prompt");

        assertThat(key).isEqualTo(
                "qwen:cache:qwen-turbo:a94eb709fb27abb1097000cbd3a43d5ba95444dcc70a5c670f3a2a8c4808e58c");
    }

    @Test
    void cacheTtlIsTwentyFourHours() {
        assertThat(SemanticCacheKeyGenerator.CACHE_TTL).isEqualTo(Duration.ofHours(CACHE_TTL_HOURS));
    }

    @Test
    void generatedKeyCanAddressInMemorySemanticCache() {
        SemanticCacheKeyGenerator generator = new SemanticCacheKeyGenerator();
        Map<String, String> cache = new HashMap<>();
        String prompt = "hello prompt";
        String key = generator.generate(QwenModelEnum.QWEN_TURBO, prompt);

        cache.put(key, "cached copy");

        assertThat(cache.get(generator.generate(QwenModelEnum.QWEN_TURBO, prompt))).isEqualTo("cached copy");
    }
}
