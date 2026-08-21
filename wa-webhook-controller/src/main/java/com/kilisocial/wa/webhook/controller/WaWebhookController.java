package com.kilisocial.wa.webhook.controller;

import com.kilisocial.ai.security.WebhookSignatureVerifier;
import com.kilisocial.wa.webhook.config.WaWebhookProperties;
import com.kilisocial.wa.webhook.model.WaMessage;
import com.kilisocial.wa.webhook.service.PhoneMasker;
import com.kilisocial.wa.webhook.service.WaMessageParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Optional;

/**
 * Receives WhatsApp webhook verification and inbound message callbacks.
 */
@RestController
public class WaWebhookController {

    private static final Logger LOGGER = LoggerFactory.getLogger(WaWebhookController.class);
    private static final String SUBSCRIBE_MODE = "subscribe";
    private static final String TYPE_TEXT = "text";
    private static final String TYPE_IMAGE = "image";
    private static final String TYPE_LOCATION = "location";

    private final WaWebhookProperties properties;
    private final WaMessageParser parser;
    private final PhoneMasker phoneMasker;

    /**
     * Creates a WhatsApp webhook controller.
     *
     * @param properties webhook properties
     * @param parser message parser
     * @param phoneMasker phone masker
     */
    public WaWebhookController(WaWebhookProperties properties, WaMessageParser parser, PhoneMasker phoneMasker) {
        this.properties = properties;
        this.parser = parser;
        this.phoneMasker = phoneMasker;
    }

    /**
     * Handles Meta webhook verification.
     *
     * @param mode verification mode
     * @param token verification token
     * @param challenge challenge to echo
     * @return challenge when verification succeeds
     */
    @GetMapping("/api/v1/wa/webhook")
    public ResponseEntity<String> verify(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {
        LOGGER.debug("WA webhook verify request mode={} token={} challenge={}",
                mode, maskToken(token), challenge);
        if (SUBSCRIBE_MODE.equals(mode) && properties.getVerifyToken().equals(token)) {
            LOGGER.debug("WA webhook verify response={}", challenge);
            return ResponseEntity.ok(challenge);
        }
        LOGGER.debug("WA webhook verify response=forbidden");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("forbidden");
    }

    /**
     * Handles Meta inbound message callbacks.
     *
     * @param signature Meta X-Hub-Signature-256 header
     * @param payload raw payload
     * @return ok response
     * @throws IOException when payload parsing fails
     */
    @PostMapping("/api/v1/wa/webhook")
    public ResponseEntity<String> receive(
            @RequestHeader("X-Hub-Signature-256") String signature,
            @RequestBody String payload) throws IOException {
        LOGGER.debug("WA webhook request body={}", maskPhones(payload));
        if (!WebhookSignatureVerifier.isValid(payload, signature, properties.getAppSecret())) {
            LOGGER.debug("WA webhook response=invalid_signature");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("invalid signature");
        }
        Optional<WaMessage> parsed = parser.parse(payload);
        parsed.ifPresent(this::logMessage);
        LOGGER.debug("WA webhook response=ok");
        return ResponseEntity.ok("ok");
    }

    private void logMessage(WaMessage message) {
        if (TYPE_TEXT.equals(message.type())
                || TYPE_IMAGE.equals(message.type())
                || TYPE_LOCATION.equals(message.type())) {
            LOGGER.debug("WA message parsed from={} type={} payload={}",
                    message.from(), message.type(), message.payload());
            return;
        }
        LOGGER.warn("Unknown WA message type={} from={}", message.type(), message.from());
    }

    private String maskPhones(String payload) {
        return payload.replaceAll("(\"from\"\\s*:\\s*\")(\\d{3})\\d{4}(\\d{4,})(\")", "$1$2****$3$4");
    }

    private String maskToken(String token) {
        return phoneMasker.mask(token);
    }
}
