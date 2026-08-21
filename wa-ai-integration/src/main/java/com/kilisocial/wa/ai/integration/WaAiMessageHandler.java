package com.kilisocial.wa.ai.integration;

import com.kilisocial.copywriting.service.CopywritingService;
import com.kilisocial.wa.webhook.model.WaMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Adapts parsed WhatsApp messages to copywriting generation inputs.
 */
public class WaAiMessageHandler implements MessageHandler {

    public static final String LOCALE_SWAHILI = "swahili";
    public static final String CONTENT_TYPE_SOCIAL_REPLY = "social_reply";
    public static final String CONTENT_TYPE_CAPTION_GENERATION = "caption_generation";
    public static final String UNSUPPORTED_MESSAGE_RESPONSE =
            "Asante kwa ujumbe wako. Kwa sasa tunaweza kushughulikia maandishi au picha pekee.";

    private static final Logger LOGGER = LoggerFactory.getLogger(WaAiMessageHandler.class);
    private static final String TYPE_TEXT = "text";
    private static final String TYPE_IMAGE = "image";
    private static final String TYPE_LOCATION = "location";
    private static final String VARIABLE_CONTENT = "content";
    private static final String VARIABLE_MEDIA_URL = "media_url";

    private final CopywritingService copywritingService;

    /**
     * Creates a WhatsApp AI message handler.
     *
     * @param copywritingService copywriting generation service
     */
    public WaAiMessageHandler(CopywritingService copywritingService) {
        this.copywritingService = copywritingService;
    }

    @Override
    public String handle(WaMessage message) {
        return switch (message.type()) {
            case TYPE_TEXT -> generateSocialReply(message);
            case TYPE_IMAGE -> generateCaption(message);
            case TYPE_LOCATION -> unsupported(message);
            default -> unsupported(message);
        };
    }

    private String generateSocialReply(WaMessage message) {
        LOGGER.debug("Routing WA text message to contentType={}", CONTENT_TYPE_SOCIAL_REPLY);
        return copywritingService.generate(
                LOCALE_SWAHILI,
                CONTENT_TYPE_SOCIAL_REPLY,
                Map.of(VARIABLE_CONTENT, message.payload())
        );
    }

    private String generateCaption(WaMessage message) {
        LOGGER.debug("Routing WA image message to contentType={}", CONTENT_TYPE_CAPTION_GENERATION);
        return copywritingService.generate(
                LOCALE_SWAHILI,
                CONTENT_TYPE_CAPTION_GENERATION,
                Map.of(VARIABLE_MEDIA_URL, message.payload())
        );
    }

    private String unsupported(WaMessage message) {
        LOGGER.info("Skipping AI generation for WA message type={}", message.type());
        return UNSUPPORTED_MESSAGE_RESPONSE;
    }
}
