package com.kilisocial.copywriting.model;

/**
 * Active prompt template loaded from prompt_config.
 *
 * @param name prompt name
 * @param model Qwen model API name
 * @param systemPrompt system prompt
 * @param userTemplate user prompt template
 * @param version prompt version
 */
public record PromptTemplate(
        String name,
        String model,
        String systemPrompt,
        String userTemplate,
        int version
) {
}
