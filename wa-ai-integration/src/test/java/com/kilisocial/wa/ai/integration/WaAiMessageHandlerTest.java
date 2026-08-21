package com.kilisocial.wa.ai.integration;

import com.kilisocial.copywriting.service.CopywritingService;
import com.kilisocial.wa.webhook.model.WaMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link WaAiMessageHandler}.
 */
class WaAiMessageHandlerTest {

    private static final String SENDER = "254****5678";
    private static final String TEXT_PAYLOAD = "Nahitaji tangazo la sabuni";
    private static final String IMAGE_PAYLOAD = "https://cdn.example.test/media/image-1.jpg";
    private static final String GENERATED_REPLY = "Karibu, tunaweza kukuandalia tangazo.";
    private static final String GENERATED_CAPTION = "Sabuni safi kwa familia yako.";

    private CopywritingService copywritingService;
    private WaAiMessageHandler handler;

    @BeforeEach
    void setUp() {
        copywritingService = mock(CopywritingService.class);
        handler = new WaAiMessageHandler(copywritingService);
    }

    @Test
    void routesTextMessageToSocialReplyGeneration() {
        when(copywritingService.generate(
                eq(WaAiMessageHandler.LOCALE_SWAHILI),
                eq(WaAiMessageHandler.CONTENT_TYPE_SOCIAL_REPLY),
                any()
        )).thenReturn(GENERATED_REPLY);

        String result = handler.handle(new WaMessage(SENDER, "text", TEXT_PAYLOAD));

        assertThat(result).isEqualTo(GENERATED_REPLY);
        ArgumentCaptor<Map<String, String>> variablesCaptor = mapCaptor();
        verify(copywritingService).generate(
                eq(WaAiMessageHandler.LOCALE_SWAHILI),
                eq(WaAiMessageHandler.CONTENT_TYPE_SOCIAL_REPLY),
                variablesCaptor.capture()
        );
        assertThat(variablesCaptor.getValue()).containsEntry("content", TEXT_PAYLOAD);
    }

    @Test
    void routesImageMessageToCaptionGeneration() {
        when(copywritingService.generate(
                eq(WaAiMessageHandler.LOCALE_SWAHILI),
                eq(WaAiMessageHandler.CONTENT_TYPE_CAPTION_GENERATION),
                any()
        )).thenReturn(GENERATED_CAPTION);

        String result = handler.handle(new WaMessage(SENDER, "image", IMAGE_PAYLOAD));

        assertThat(result).isEqualTo(GENERATED_CAPTION);
        ArgumentCaptor<Map<String, String>> variablesCaptor = mapCaptor();
        verify(copywritingService).generate(
                eq(WaAiMessageHandler.LOCALE_SWAHILI),
                eq(WaAiMessageHandler.CONTENT_TYPE_CAPTION_GENERATION),
                variablesCaptor.capture()
        );
        assertThat(variablesCaptor.getValue()).containsEntry("media_url", IMAGE_PAYLOAD);
    }

    @Test
    void returnsFixedPromptForLocationWithoutCallingAi() {
        String result = handler.handle(new WaMessage(SENDER, "location", "-1.2921,36.8219"));

        assertThat(result).isEqualTo(WaAiMessageHandler.UNSUPPORTED_MESSAGE_RESPONSE);
        verify(copywritingService, never()).generate(any(), any(), any());
    }

    @Test
    void returnsFixedPromptForUnknownTypeWithoutCallingAi() {
        String result = handler.handle(new WaMessage(SENDER, "audio", "media-id"));

        assertThat(result).isEqualTo(WaAiMessageHandler.UNSUPPORTED_MESSAGE_RESPONSE);
        verify(copywritingService, never()).generate(any(), any(), any());
    }

    @Test
    void propagatesCopywritingExceptionsForAiRoutedMessages() {
        when(copywritingService.generate(
                eq(WaAiMessageHandler.LOCALE_SWAHILI),
                eq(WaAiMessageHandler.CONTENT_TYPE_SOCIAL_REPLY),
                any()
        )).thenThrow(new IllegalArgumentException("Prompt template not found"));

        assertThatThrownBy(() -> handler.handle(new WaMessage(SENDER, "text", TEXT_PAYLOAD)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Prompt template not found");
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<Map<String, String>> mapCaptor() {
        return ArgumentCaptor.forClass(Map.class);
    }
}
