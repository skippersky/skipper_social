package com.kilisocial.copywriting.cache;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link InMemorySemanticCache}.
 */
class InMemorySemanticCacheTest {

    private static final long SLEEP_MILLIS = 10L;

    private final InMemorySemanticCache cache = new InMemorySemanticCache();

    @Test
    void returnsStoredValueBeforeTtl() {
        cache.put("k", "v", Duration.ofMinutes(1));

        assertThat(cache.get("k")).contains("v");
    }

    @Test
    void returnsEmptyWhenKeyMissing() {
        assertThat(cache.get("missing")).isEmpty();
    }

    @Test
    void expiresAfterTtl() throws InterruptedException {
        cache.put("k", "v", Duration.ofMillis(1));
        Thread.sleep(SLEEP_MILLIS);

        assertThat(cache.get("k")).isEmpty();
    }
}
