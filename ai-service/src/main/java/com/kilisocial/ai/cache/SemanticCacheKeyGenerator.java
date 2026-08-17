package com.kilisocial.ai.cache;

import com.kilisocial.ai.client.QwenModelEnum;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Generates semantic cache keys for Qwen prompts.
 */
public class SemanticCacheKeyGenerator {

    public static final Duration CACHE_TTL = Duration.ofHours(24);

    /**
     * Generates Redis key in qwen:cache:{model}:{sha256(prompt)} format.
     *
     * @param model Qwen model
     * @param prompt prompt text
     * @return Redis semantic cache key
     */
    public String generate(QwenModelEnum model, String prompt) {
        return "qwen:cache:%s:%s".formatted(model.getApiName(), sha256(prompt));
    }

    private String sha256(String prompt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(prompt.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is unavailable", exception);
        }
    }
}
