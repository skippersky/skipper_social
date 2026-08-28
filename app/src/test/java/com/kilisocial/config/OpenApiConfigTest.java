package com.kilisocial.config;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link OpenApiConfig}.
 */
class OpenApiConfigTest {

    @Test
    void exposesApiInfo() {
        OpenAPI openAPI = new OpenApiConfig().kiliSocialOpenAPI();

        assertThat(openAPI.getInfo().getTitle()).isEqualTo("KiliSocial API");
        assertThat(openAPI.getInfo().getVersion()).isEqualTo("v1");
        assertThat(openAPI.getInfo().getDescription()).contains("WA webhook");
    }
}
