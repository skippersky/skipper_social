package com.kilisocial.ai.client;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Qwen generation request.
 *
 * @param model target model
 * @param systemPrompt system prompt
 * @param userPrompt user prompt
 */
public record QwenRequest(
        @NotNull QwenModelEnum model,
        @NotBlank String systemPrompt,
        @NotBlank String userPrompt
) {
}
