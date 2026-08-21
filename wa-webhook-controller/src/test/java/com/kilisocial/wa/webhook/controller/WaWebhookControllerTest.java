package com.kilisocial.wa.webhook.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kilisocial.ai.security.WebhookSignatureVerifier;
import com.kilisocial.wa.webhook.config.WaWebhookProperties;
import com.kilisocial.wa.webhook.service.PhoneMasker;
import com.kilisocial.wa.webhook.service.WaMessageParser;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for {@link WaWebhookController}.
 */
class WaWebhookControllerTest {

    private static final String VERIFY_TOKEN = "verify_token_123";
    private static final String APP_SECRET = "wa_app_secret";
    private static final String CHALLENGE = "challenge_text";
    private static final String TEXT_PAYLOAD = """
            {
              "entry": [{
                "changes": [{
                  "value": {
                    "messages": [{
                      "from": "254712345678",
                      "type": "text",
                      "text": {"body": "hello"}
                    }]
                  }
                }]
              }]
            }
            """;
    private static final String IMAGE_PAYLOAD = """
            {
              "entry": [{
                "changes": [{
                  "value": {
                    "messages": [{
                      "from": "254712345678",
                      "type": "image",
                      "image": {"id": "image_media_id"}
                    }]
                  }
                }]
              }]
            }
            """;
    private static final String LOCATION_PAYLOAD = """
            {
              "entry": [{
                "changes": [{
                  "value": {
                    "messages": [{
                      "from": "254712345678",
                      "type": "location",
                      "location": {"latitude": -1.2921, "longitude": 36.8219}
                    }]
                  }
                }]
              }]
            }
            """;
    private static final String UNKNOWN_PAYLOAD = """
            {
              "entry": [{
                "changes": [{
                  "value": {
                    "messages": [{
                      "from": "254712345678",
                      "type": "audio",
                      "audio": {"id": "audio_media_id"}
                    }]
                  }
                }]
              }]
            }
            """;

    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller()).build();

    @Test
    void verifyReturnsChallengeWhenTokenMatches() throws Exception {
        mockMvc.perform(get("/api/v1/wa/webhook")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", VERIFY_TOKEN)
                        .param("hub.challenge", CHALLENGE))
                .andExpect(status().isOk())
                .andExpect(content().string(CHALLENGE));
    }

    @Test
    void verifyRejectsInvalidToken() throws Exception {
        mockMvc.perform(get("/api/v1/wa/webhook")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "wrong")
                        .param("hub.challenge", CHALLENGE))
                .andExpect(status().isForbidden())
                .andExpect(content().string("forbidden"));
    }

    @Test
    void receiveParsesTextMessage() throws Exception {
        mockMvc.perform(post("/api/v1/wa/webhook")
                        .header("X-Hub-Signature-256", sign(TEXT_PAYLOAD))
                        .content(TEXT_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void receiveParsesImageMessage() throws Exception {
        mockMvc.perform(post("/api/v1/wa/webhook")
                        .header("X-Hub-Signature-256", sign(IMAGE_PAYLOAD))
                        .content(IMAGE_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void receiveParsesLocationMessage() throws Exception {
        mockMvc.perform(post("/api/v1/wa/webhook")
                        .header("X-Hub-Signature-256", sign(LOCATION_PAYLOAD))
                        .content(LOCATION_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void receiveReturnsOkForUnknownMessageType() throws Exception {
        mockMvc.perform(post("/api/v1/wa/webhook")
                        .header("X-Hub-Signature-256", sign(UNKNOWN_PAYLOAD))
                        .content(UNKNOWN_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void receiveRejectsInvalidSignature() throws Exception {
        mockMvc.perform(post("/api/v1/wa/webhook")
                        .header("X-Hub-Signature-256", "sha256=invalid")
                        .content(TEXT_PAYLOAD))
                .andExpect(status().isForbidden())
                .andExpect(content().string(containsString("invalid signature")));
    }

    private String sign(String payload) {
        return WebhookSignatureVerifier.sign(payload, APP_SECRET);
    }

    private WaWebhookController controller() {
        PhoneMasker phoneMasker = new PhoneMasker();
        return new WaWebhookController(
                new WaWebhookProperties(VERIFY_TOKEN, APP_SECRET),
                new WaMessageParser(new ObjectMapper(), phoneMasker),
                phoneMasker
        );
    }
}
