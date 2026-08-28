package com.kilisocial.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Exposes the Swagger UI metadata for manual API acceptance.
 */
@Configuration
public class OpenApiConfig {

    /**
     * Builds the OpenAPI document metadata.
     *
     * @return OpenAPI metadata
     */
    @Bean
    public OpenAPI kiliSocialOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("KiliSocial API")
                .version("v1")
                .description("KiliSocial MVP backend API (WA webhook, AI copywriting, social publishing)"));
    }
}
