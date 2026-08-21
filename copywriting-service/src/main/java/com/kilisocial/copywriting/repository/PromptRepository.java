package com.kilisocial.copywriting.repository;

import com.kilisocial.copywriting.model.PromptTemplate;

import java.util.Optional;

/**
 * Prompt configuration repository port.
 */
public interface PromptRepository {

    /**
     * Finds the active prompt template for locale and content type.
     *
     * @param locale target locale
     * @param contentType target content type
     * @return active prompt template when configured
     */
    Optional<PromptTemplate> findActive(String locale, String contentType);
}
