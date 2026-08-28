package com.kilisocial.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Qwen API connection properties.
 */
@ConfigurationProperties(prefix = "kili.qwen")
public class QwenProperties {

    private static final int DEFAULT_CONNECT_TIMEOUT_MS = 5000;
    private static final int DEFAULT_READ_TIMEOUT_MS = 30000;

    private String apiKey = "";
    private String baseUrl = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
    private int connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;
    private int readTimeoutMs = DEFAULT_READ_TIMEOUT_MS;

    /**
     * @return Qwen API key
     */
    public String getApiKey() {
        return apiKey;
    }

    /**
     * @param apiKey Qwen API key
     */
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * @return Qwen API endpoint
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * @param baseUrl Qwen API endpoint
     */
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * @return connect timeout in millis
     */
    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    /**
     * @param connectTimeoutMs connect timeout in millis
     */
    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    /**
     * @return read timeout in millis
     */
    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    /**
     * @param readTimeoutMs read timeout in millis
     */
    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
