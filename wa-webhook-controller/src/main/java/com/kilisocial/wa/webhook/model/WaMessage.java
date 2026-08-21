package com.kilisocial.wa.webhook.model;

/**
 * Parsed WhatsApp inbound message.
 *
 * @param from masked sender phone
 * @param type message type
 * @param payload parsed payload summary
 */
public record WaMessage(String from, String type, String payload) {
}
