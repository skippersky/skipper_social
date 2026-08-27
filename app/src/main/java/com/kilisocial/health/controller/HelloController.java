package com.kilisocial.health.controller;

import com.kilisocial.common.api.ApiResponse;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Basic smoke-test API for Sprint 0.
 */
@Validated
@RestController
public class HelloController {

    /**
     * Returns a localized hello payload.
     *
     * @param locale requested locale key
     * @return hello payload
     */
    @GetMapping("/api/v1/hello")
    public ApiResponse<Map<String, String>> hello(
            @RequestParam(defaultValue = "en") @NotBlank(message = "locale must not be blank") String locale) {
        return ApiResponse.ok(Map.of(
                "service", "kili-social",
                "message", resolveMessage(locale)
        ));
    }

    private String resolveMessage(String locale) {
        return switch (locale.toLowerCase()) {
            case "fr" -> "Bonjour from KiliSocial";
            case "sw" -> "Hujambo from KiliSocial";
            default -> "Hello from KiliSocial";
        };
    }
}
