package com.kilisocial.copywriting.repository;

import com.kilisocial.copywriting.model.PromptTemplate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link ConfigurablePromptRepository}.
 */
class ConfigurablePromptRepositoryTest {

    @Test
    void findsTemplateByLocaleAndContentType() {
        PromptTemplate template = new PromptTemplate("en_social_post", "qwen-turbo", "sys", "user {content}", 1);
        ConfigurablePromptRepository repository = new ConfigurablePromptRepository(List.of(
                new ConfigurablePromptRepository.Entry("en", "social_post", template)));

        assertThat(repository.findActive("en", "social_post")).contains(template);
    }

    @Test
    void returnsEmptyWhenNoMatch() {
        ConfigurablePromptRepository repository = new ConfigurablePromptRepository(List.of());

        assertThat(repository.findActive("sw", "social_post")).isEmpty();
    }
}
