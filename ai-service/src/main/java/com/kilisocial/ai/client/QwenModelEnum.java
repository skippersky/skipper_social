package com.kilisocial.ai.client;

/**
 * Supported Qwen model aliases.
 */
public enum QwenModelEnum {

    QWEN_TURBO("qwen-turbo", 0.0003D, 0.0006D),
    QWEN_MAX("qwen-max", 0.0024D, 0.0096D);

    private static final double TOKENS_PER_MILLION = 1_000_000D;

    private final String apiName;
    private final double inputUsdPerMillion;
    private final double outputUsdPerMillion;

    QwenModelEnum(String apiName, double inputUsdPerMillion, double outputUsdPerMillion) {
        this.apiName = apiName;
        this.inputUsdPerMillion = inputUsdPerMillion;
        this.outputUsdPerMillion = outputUsdPerMillion;
    }

    /**
     * Returns Qwen API model name.
     *
     * @return API model name
     */
    public String getApiName() {
        return apiName;
    }

    /**
     * Estimates request cost in USD from token usage.
     *
     * @param inputTokens input token count
     * @param outputTokens output token count
     * @return estimated cost in USD
     */
    public double estimateCostUsd(int inputTokens, int outputTokens) {
        double inputCost = inputTokens * inputUsdPerMillion / TOKENS_PER_MILLION;
        double outputCost = outputTokens * outputUsdPerMillion / TOKENS_PER_MILLION;
        return inputCost + outputCost;
    }
}
