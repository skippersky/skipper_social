package com.kilisocial.copywriting.service;

import com.kilisocial.ai.cache.SemanticCacheKeyGenerator;
import com.kilisocial.ai.client.QwenClient;
import com.kilisocial.ai.client.QwenModelEnum;
import com.kilisocial.ai.client.QwenRequest;
import com.kilisocial.ai.client.QwenResponse;
import com.kilisocial.ai.client.TokenUsage;
import com.kilisocial.copywriting.cache.SemanticCache;
import com.kilisocial.copywriting.model.PromptTemplate;
import com.kilisocial.copywriting.repository.PromptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link CopywritingService}.
 */
class CopywritingServiceTest {

    private static final String LOCALE = "en";
    private static final String CONTENT_TYPE = "social_post";
    private static final String SYSTEM_PROMPT = "Write concise merchant copy.";
    private static final String USER_TEMPLATE = "Create a {tone} post for {product}.";
    private static final String GENERATED_CONTENT = "Fresh mangoes are ready today.";
    private static final int PROMPT_VERSION = 1;
    private static final int INPUT_TOKENS = 12;
    private static final int OUTPUT_TOKENS = 8;

    private PromptRepository promptRepository;
    private QwenClient qwenClient;
    private SemanticCache semanticCache;
    private SemanticCacheKeyGenerator cacheKeyGenerator;
    private CopywritingService service;

    @BeforeEach
    void setUp() {
        promptRepository = mock(PromptRepository.class);
        qwenClient = mock(QwenClient.class);
        semanticCache = mock(SemanticCache.class);
        cacheKeyGenerator = new SemanticCacheKeyGenerator();
        service = new CopywritingService(promptRepository, qwenClient, semanticCache, cacheKeyGenerator);
    }

    @Test
    void generateCallsQwenWhenCacheMisses() {
        PromptTemplate template = template();
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.of(template));
        when(semanticCache.get(expectedCacheKey())).thenReturn(Optional.empty());
        when(qwenClient.generate(any())).thenReturn(qwenResponse());

        String result = service.generate(LOCALE, CONTENT_TYPE, variables());

        assertThat(result).isEqualTo(GENERATED_CONTENT);
        ArgumentCaptor<QwenRequest> requestCaptor = ArgumentCaptor.forClass(QwenRequest.class);
        verify(qwenClient).generate(requestCaptor.capture());
        assertThat(requestCaptor.getValue().model()).isEqualTo(QwenModelEnum.QWEN_TURBO);
        assertThat(requestCaptor.getValue().systemPrompt()).isEqualTo(SYSTEM_PROMPT);
        assertThat(requestCaptor.getValue().userPrompt()).isEqualTo("Create a friendly post for mangoes.");
        verify(semanticCache).put(
                eq(expectedCacheKey()),
                eq(GENERATED_CONTENT),
                eq(SemanticCacheKeyGenerator.CACHE_TTL)
        );
    }

    @Test
    void generateReturnsCachedContentWithoutCallingQwen() {
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.of(template()));
        when(semanticCache.get(expectedCacheKey())).thenReturn(Optional.of("cached copy"));

        String result = service.generate(LOCALE, CONTENT_TYPE, variables());

        assertThat(result).isEqualTo("cached copy");
        verify(qwenClient, never()).generate(any());
    }

    @Test
    void renderTemplateReplacesVariablesSuccessfully() {
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.of(template()));
        when(semanticCache.get(expectedCacheKey())).thenReturn(Optional.empty());
        when(qwenClient.generate(any())).thenReturn(qwenResponse());

        service.generate(LOCALE, CONTENT_TYPE, variables());

        ArgumentCaptor<QwenRequest> requestCaptor = ArgumentCaptor.forClass(QwenRequest.class);
        verify(qwenClient).generate(requestCaptor.capture());
        assertThat(requestCaptor.getValue().userPrompt()).contains("friendly").contains("mangoes");
    }

    @Test
    void renderTemplateThrowsWhenVariableIsMissing() {
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.of(template()));

        assertThatThrownBy(() -> service.generate(LOCALE, CONTENT_TYPE, Map.of("tone", "friendly")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Missing variable: product");
        verify(qwenClient, never()).generate(any());
    }

    @Test
    void generateReturnsFallbackWhenQwenThrows() {
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.of(template()));
        when(semanticCache.get(expectedCacheKey())).thenReturn(Optional.empty());
        when(qwenClient.generate(any())).thenThrow(new IllegalStateException("mock qwen failure"));

        String result = service.generate(LOCALE, CONTENT_TYPE, variables());

        assertThat(result).isEqualTo(CopywritingService.CONTENT_UNAVAILABLE);
        verify(semanticCache, never()).put(any(), any(), any());
    }

    @Test
    void generateThrowsWhenPromptTemplateDoesNotExist() {
        when(promptRepository.findActive(LOCALE, CONTENT_TYPE)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate(LOCALE, CONTENT_TYPE, variables()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Prompt template not found");
        verify(qwenClient, never()).generate(any());
    }

    private PromptTemplate template() {
        return new PromptTemplate(
                LOCALE + "_" + CONTENT_TYPE,
                QwenModelEnum.QWEN_TURBO.getApiName(),
                SYSTEM_PROMPT,
                USER_TEMPLATE,
                PROMPT_VERSION
        );
    }

    private Map<String, String> variables() {
        return Map.of("tone", "friendly", "product", "mangoes");
    }

    private String expectedCacheKey() {
        return cacheKeyGenerator.generate(
                QwenModelEnum.QWEN_TURBO,
                SYSTEM_PROMPT + "\n\n" + "Create a friendly post for mangoes."
        );
    }

    private QwenResponse qwenResponse() {
        TokenUsage usage = new TokenUsage(
                QwenModelEnum.QWEN_TURBO.getApiName(),
                INPUT_TOKENS,
                OUTPUT_TOKENS,
                QwenModelEnum.QWEN_TURBO.estimateCostUsd(INPUT_TOKENS, OUTPUT_TOKENS)
        );
        return new QwenResponse(GENERATED_CONTENT, false, usage);
    }
}
