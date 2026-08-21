package com.kilisocial.copywriting.cache;

import java.time.Duration;
import java.util.Optional;

/**
 * Semantic cache port for generated copy.
 */
public interface SemanticCache {

    /**
     * Finds generated content by cache key.
     *
     * @param key semantic cache key
     * @return cached content when present
     */
    Optional<String> get(String key);

    /**
     * Stores generated content.
     *
     * @param key semantic cache key
     * @param value generated content
     * @param ttl cache lifetime
     */
    void put(String key, String value, Duration ttl);
}
