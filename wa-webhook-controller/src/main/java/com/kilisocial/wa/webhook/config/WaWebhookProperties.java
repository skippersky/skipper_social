package com.kilisocial.wa.webhook.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * WhatsApp webhook configuration.
 */
@Component
public class WaWebhookProperties {

    private final String verifyToken;
    private final String appSecret;

    /**
     * Creates webhook properties.
     *
     * @param verifyToken Meta webhook verify token
     * @param appSecret Meta app secret
     */
    public WaWebhookProperties(
            @Value("${WA_VERIFY_TOKEN:${wa.verify-token:}}") String verifyToken,
            @Value("${WA_APP_SECRET:${wa.app-secret:}}") String appSecret) {
        this.verifyToken = verifyToken;
        this.appSecret = appSecret;
    }

    /**
     * Returns Meta webhook verify token.
     *
     * @return verify token
     */
    public String getVerifyToken() {
        return verifyToken;
    }

    /**
     * Returns Meta app secret.
     *
     * @return app secret
     */
    public String getAppSecret() {
        return appSecret;
    }
}
