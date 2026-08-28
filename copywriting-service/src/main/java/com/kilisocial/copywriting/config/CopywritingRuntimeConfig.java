package com.kilisocial.copywriting.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kilisocial.ai.cache.SemanticCacheKeyGenerator;
import com.kilisocial.ai.client.JdkQwenHttpClient;
import com.kilisocial.ai.client.QwenClient;
import com.kilisocial.ai.client.QwenHttpClient;
import com.kilisocial.ai.client.QwenSleeper;
import com.kilisocial.ai.client.ThreadQwenSleeper;
import com.kilisocial.ai.client.TokenUsageLogger;
import com.kilisocial.ai.config.QwenProperties;
import com.kilisocial.copywriting.cache.InMemorySemanticCache;
import com.kilisocial.copywriting.cache.SemanticCache;
import com.kilisocial.copywriting.model.PromptTemplate;
import com.kilisocial.copywriting.repository.ConfigurablePromptRepository;
import com.kilisocial.copywriting.repository.PromptRepository;
import com.kilisocial.copywriting.service.CopywritingService;
import jakarta.validation.Validator;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Runtime wiring for the copywriting chain (Qwen client, cache, repository, service).
 */
@Configuration
@EnableConfigurationProperties({QwenProperties.class, CopywritingProperties.class})
public class CopywritingRuntimeConfig {

    /**
     * @return token usage logger
     */
    @Bean
    public TokenUsageLogger tokenUsageLogger() {
        return new TokenUsageLogger();
    }

    /**
     * @return retry sleeper
     */
    @Bean
    public QwenSleeper qwenSleeper() {
        return new ThreadQwenSleeper();
    }

    /**
     * @param properties Qwen connection properties
     * @return HTTP transport
     */
    @Bean
    public QwenHttpClient qwenHttpClient(QwenProperties properties) {
        return new JdkQwenHttpClient(properties.getBaseUrl(), properties.getApiKey(),
                properties.getConnectTimeoutMs(), properties.getReadTimeoutMs());
    }

    /**
     * @param httpClient HTTP transport
     * @param objectMapper JSON mapper
     * @param validator request validator
     * @param tokenUsageLogger token usage logger
     * @param sleeper retry sleeper
     * @return Qwen client
     */
    @Bean
    public QwenClient qwenClient(QwenHttpClient httpClient, ObjectMapper objectMapper, Validator validator,
                                 TokenUsageLogger tokenUsageLogger, QwenSleeper sleeper) {
        return new QwenClient(httpClient, objectMapper, validator, tokenUsageLogger, sleeper);
    }

    /**
     * @return semantic cache
     */
    @Bean
    public SemanticCache semanticCache() {
        return new InMemorySemanticCache();
    }

    /**
     * @param properties template properties
     * @return prompt repository
     */
    @Bean
    public PromptRepository promptRepository(CopywritingProperties properties) {
        List<ConfigurablePromptRepository.Entry> entries = properties.getTemplates().stream()
                .map(entry -> new ConfigurablePromptRepository.Entry(entry.getLocale(), entry.getContentType(),
                        new PromptTemplate(entry.getLocale() + "_" + entry.getContentType(), entry.getModel(),
                                entry.getSystemPrompt(), entry.getUserTemplate(), 1)))
                .toList();
        return new ConfigurablePromptRepository(entries);
    }

    /**
     * @param promptRepository prompt repository
     * @param qwenClient Qwen client
     * @param semanticCache semantic cache
     * @return copywriting service
     */
    @Bean
    public CopywritingService copywritingService(PromptRepository promptRepository, QwenClient qwenClient,
                                                 SemanticCache semanticCache) {
        return new CopywritingService(promptRepository, qwenClient, semanticCache, new SemanticCacheKeyGenerator());
    }
}
