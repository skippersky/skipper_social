package com.kilisocial.ai.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Pure utility for HMAC-SHA256 webhook signature verification.
 */
public final class WebhookSignatureVerifier {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String SHA256_PREFIX = "sha256=";

    private WebhookSignatureVerifier() {
    }

    /**
     * Verifies a Meta-style sha256 signature.
     *
     * @param payload raw request payload
     * @param signature signature header value
     * @param secret webhook secret
     * @return whether signature is valid
     */
    public static boolean isValid(String payload, String signature, String secret) {
        if (payload == null || signature == null || secret == null || !signature.startsWith(SHA256_PREFIX)) {
            return false;
        }
        String expected = SHA256_PREFIX + hmacSha256Hex(payload, secret);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8)
        );
    }

    /**
     * Calculates Meta-style sha256 signature for tests and integrations.
     *
     * @param payload raw request payload
     * @param secret webhook secret
     * @return signature header value
     */
    public static String sign(String payload, String secret) {
        return SHA256_PREFIX + hmacSha256Hex(payload, secret);
    }

    private static String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", exception);
        } catch (java.security.InvalidKeyException exception) {
            throw new IllegalArgumentException("Invalid webhook secret", exception);
        }
    }
}
