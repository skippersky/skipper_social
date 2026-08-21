package com.kilisocial.wa.webhook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kilisocial.wa.webhook.model.WaMessage;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Optional;

/**
 * Parses WhatsApp webhook messages.
 */
@Component
public class WaMessageParser {

    private static final String TYPE_TEXT = "text";
    private static final String TYPE_IMAGE = "image";
    private static final String TYPE_LOCATION = "location";
    private static final String UNKNOWN_TYPE = "unknown";

    private final ObjectMapper objectMapper;
    private final PhoneMasker phoneMasker;

    /**
     * Creates a WhatsApp message parser.
     *
     * @param objectMapper JSON mapper
     * @param phoneMasker phone masker
     */
    public WaMessageParser(ObjectMapper objectMapper, PhoneMasker phoneMasker) {
        this.objectMapper = objectMapper;
        this.phoneMasker = phoneMasker;
    }

    /**
     * Parses first inbound message from Meta webhook payload.
     *
     * @param payload raw request payload
     * @return parsed message when present
     * @throws IOException when JSON parsing fails
     */
    public Optional<WaMessage> parse(String payload) throws IOException {
        JsonNode message = objectMapper.readTree(payload)
                .at("/entry/0/changes/0/value/messages/0");
        if (message.isMissingNode()) {
            return Optional.empty();
        }
        String from = phoneMasker.mask(message.path("from").asText());
        String type = message.path("type").asText(UNKNOWN_TYPE);
        return Optional.of(new WaMessage(from, type, payloadFor(message, type)));
    }

    private String payloadFor(JsonNode message, String type) {
        return switch (type) {
            case TYPE_TEXT -> message.at("/text/body").asText();
            case TYPE_IMAGE -> message.at("/image/id").asText();
            case TYPE_LOCATION -> message.at("/location/latitude").asText()
                    + "," + message.at("/location/longitude").asText();
            default -> "";
        };
    }
}
