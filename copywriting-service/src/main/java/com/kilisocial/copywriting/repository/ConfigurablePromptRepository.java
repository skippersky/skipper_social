package com.kilisocial.copywriting.repository;

import com.kilisocial.copywriting.model.PromptTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Configuration-backed prompt repository used until the DB-backed implementation lands.
 */
public class ConfigurablePromptRepository implements PromptRepository {

    private record Key(String locale, String contentType) {
    }

    private final Map<Key, PromptTemplate> templates;

    /**
     * Creates the repository from configured entries.
     *
     * @param entries locale/contentType to template pairs
     */
    public ConfigurablePromptRepository(List<Entry> entries) {
        this.templates = entries.stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                e -> new Key(e.locale(), e.contentType()), Entry::template));
    }

    @Override
    public Optional<PromptTemplate> findActive(String locale, String contentType) {
        return Optional.ofNullable(templates.get(new Key(locale, contentType)));
    }

    /**
     * A configured prompt entry.
     *
     * @param locale target locale
     * @param contentType content type
     * @param template prompt template
     */
    public record Entry(String locale, String contentType, PromptTemplate template) {
    }
}
