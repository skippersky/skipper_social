package com.kilisocial.wa.webhook.service;

import org.springframework.stereotype.Component;

/**
 * Masks sensitive phone number segments for logs.
 */
@Component
public class PhoneMasker {

    private static final int MIN_MASKABLE_LENGTH = 7;
    private static final int PREFIX_LENGTH = 3;
    private static final int SUFFIX_LENGTH = 4;
    private static final String MASK = "****";

    /**
     * Masks the middle four digits of a phone number.
     *
     * @param phone raw phone number
     * @return masked phone number
     */
    public String mask(String phone) {
        if (phone == null || phone.length() < MIN_MASKABLE_LENGTH) {
            return phone;
        }
        int suffixStart = phone.length() - SUFFIX_LENGTH;
        return phone.substring(0, PREFIX_LENGTH) + MASK + phone.substring(suffixStart);
    }
}
