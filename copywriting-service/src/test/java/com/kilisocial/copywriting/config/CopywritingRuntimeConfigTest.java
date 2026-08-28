package com.kilisocial.copywriting.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kilisocial.ai.client.QwenClient;
import com.kilisocial.ai.client.QwenHttpClient;
import com.kilisocial.ai.config.QwenProperties;
import com.kilisocial.copywriting.cache.InMemorySemanticCache;
import com.kilisocial.copywriting.repository.PromptRepository;
import com.kilisocial.copywriting.service.CopywritingService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link CopywritingRuntimeConfig}.
 */
class CopywritingRuntimeConfigTest {

    private final CopywritingRuntimeConfig config = new CopywritingRuntimeConfig();

    @Test
    void createsInfrastructureBeans() {
        QwenProperties qwenProperties = new QwenProperties();
        QwenHttpClient httpClient = config.qwenHttpClient(qwenProperties);

        assertThat(config.tokenUsageLogger()).isNotNull();
        assertThat(config.qwenSleeper()).isNotNull();
        assertThat(httpClient).isNotNull();
        assertThat(config.semanticCache()).isInstanceOf(InMemorySemanticCache.class);

        QwenClient qwenClient = config.qwenClient(httpClient, new ObjectMapper(),
                Validation.buildDefaultValidatorFactory().getValidator(), config.tokenUsageLogger(),
                config.qwenSleeper());
        assertThat(qwenClient).isNotNull();
    }

    @Test
    void createsRepositoryAndServiceFromProperties() {
        CopywritingProperties properties = new CopywritingProperties();
        CopywritingProperties.TemplateEntry entry = new CopywritingProperties.TemplateEntry();
        entry.setLocale("en");
        entry.setContentType("social_post");
        entry.setUserTemplate("post about {content}");
        properties.setTemplates(java.util.List.of(entry));

        PromptRepository repository = config.promptRepository(properties);
        assertThat(repository.findActive("en", "social_post")).isPresent();

        CopywritingService service = config.copywritingService(repository,
                config.qwenClient(config.qwenHttpClient(new QwenProperties()), new ObjectMapper(),
                        Validation.buildDefaultValidatorFactory().getValidator(), config.tokenUsageLogger(),
                        config.qwenSleeper()),
                config.semanticCache());
        assertThat(service).isNotNull();
    }
}
