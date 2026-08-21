package com.kilisocial.copywriting.service;

import com.kilisocial.ai.cache.SemanticCacheKeyGenerator;
import com.kilisocial.ai.client.QwenClient;
import com.kilisocial.ai.client.QwenModelEnum;
import com.kilisocial.ai.client.QwenRequest;
import com.kilisocial.ai.client.QwenResponse;
import com.kilisocial.copywriting.cache.SemanticCache;
import com.kilisocial.copywriting.model.PromptTemplate;
import com.kilisocial.copywriting.repository.PromptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Generates localized marketing copy through prompt_config templates and Qwen.
 */
public class CopywritingService {

    public static final String CONTENT_UNAVAILABLE = "[CONTENT_UNAVAILABLE]";

    private static final Logger LOGGER = LoggerFactory.getLogger(CopywritingService.class);
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{([A-Za-z][A-Za-z0-9_]*)}");

    private final PromptRepository promptRepository;
    private final QwenClient qwenClient;
    private final SemanticCache semanticCache;
    private final SemanticCacheKeyGenerator cacheKeyGenerator;

    /**
     * Creates a copywriting service.
     *
     * @param promptRepository prompt repository port
     * @param qwenClient Qwen client
     * @param semanticCache semantic cache port
     * @param cacheKeyGenerator semantic cache key generator
     */
    public CopywritingService(
            PromptRepository promptRepository,
            QwenClient qwenClient,
            SemanticCache semanticCache,
            SemanticCacheKeyGenerator cacheKeyGenerator) {
        this.promptRepository = promptRepository;
        this.qwenClient = qwenClient;
        this.semanticCache = semanticCache;
        this.cacheKeyGenerator = cacheKeyGenerator;
    }

    /**
     * Generates copy for a locale and content type.
     *
     * @param locale target locale
     * @param contentType content type
     * @param variables template variables
     * @return generated copy, cached copy, or fallback marker
     */
    public String generate(String locale, String contentType, Map<String, String> variables) {
        PromptTemplate template = promptRepository.findActive(locale, contentType)
                .orElseThrow(() -> new IllegalArgumentException("Prompt template not found"));
        QwenModelEnum model = parseModel(template.model());
        String userPrompt = renderTemplate(template.userTemplate(), variables);
        String fullPrompt = template.systemPrompt() + "\n\n" + userPrompt;
        String cacheKey = cacheKeyGenerator.generate(model, fullPrompt);
        Optional<String> cached = semanticCache.get(cacheKey);
        if (cached.isPresent()) {
            return cached.get();
        }
        try {
            QwenResponse response = qwenClient.generate(new QwenRequest(model, template.systemPrompt(), userPrompt));
            semanticCache.put(cacheKey, response.content(), SemanticCacheKeyGenerator.CACHE_TTL);
            return response.content();
        } catch (RuntimeException exception) {
            LOGGER.error("Copywriting generation failed locale={} contentType={}", locale, contentType, exception);
            return CONTENT_UNAVAILABLE;
        }
    }

    private String renderTemplate(String template, Map<String, String> variables) {
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder rendered = new StringBuilder();
        while (matcher.find()) {
            String variableName = matcher.group(1);
            String value = variables.get(variableName);
            if (value == null) {
                throw new IllegalArgumentException("Missing variable: " + variableName);
            }
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }

    private QwenModelEnum parseModel(String model) {
        for (QwenModelEnum candidate : QwenModelEnum.values()) {
            if (candidate.getApiName().equals(model)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("Unsupported Qwen model: " + model);
    }
}
