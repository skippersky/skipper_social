package com.kilisocial.wa.ai.integration;

import com.kilisocial.wa.webhook.model.WaMessage;

/**
 * Handles parsed WhatsApp messages.
 */
public interface MessageHandler {

    /**
     * Routes a parsed WhatsApp message to the next application step.
     *
     * @param message parsed WhatsApp message
     * @return response text prepared for later business orchestration
     */
    String handle(WaMessage message);
}
