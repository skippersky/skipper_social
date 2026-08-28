package com.kilisocial.copywriting.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Prompt template properties used until prompt_config is DB-backed.
 */
@ConfigurationProperties(prefix = "kili.copywriting")
public class CopywritingProperties {

    private List<TemplateEntry> templates = new ArrayList<>();

    /**
     * @return configured templates
     */
    public List<TemplateEntry> getTemplates() {
        return templates;
    }

    /**
     * @param templates configured templates
     */
    public void setTemplates(List<TemplateEntry> templates) {
        this.templates = templates;
    }

    /**
     * One configured prompt template entry.
     */
    public static class TemplateEntry {

        private String locale = "en";
        private String contentType = "social_post";
        private String model = "qwen-turbo";
        private String systemPrompt = "";
        private String userTemplate = "";

        /**
         * @return target locale
         */
        public String getLocale() {
            return locale;
        }

        /**
         * @param locale target locale
         */
        public void setLocale(String locale) {
            this.locale = locale;
        }

        /**
         * @return content type
         */
        public String getContentType() {
            return contentType;
        }

        /**
         * @param contentType content type
         */
        public void setContentType(String contentType) {
            this.contentType = contentType;
        }

        /**
         * @return Qwen model API name
         */
        public String getModel() {
            return model;
        }

        /**
         * @param model Qwen model API name
         */
        public void setModel(String model) {
            this.model = model;
        }

        /**
         * @return system prompt
         */
        public String getSystemPrompt() {
            return systemPrompt;
        }

        /**
         * @param systemPrompt system prompt
         */
        public void setSystemPrompt(String systemPrompt) {
            this.systemPrompt = systemPrompt;
        }

        /**
         * @return user prompt template
         */
        public String getUserTemplate() {
            return userTemplate;
        }

        /**
         * @param userTemplate user prompt template
         */
        public void setUserTemplate(String userTemplate) {
            this.userTemplate = userTemplate;
        }
    }
}
