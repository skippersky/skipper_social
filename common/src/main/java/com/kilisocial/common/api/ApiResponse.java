package com.kilisocial.common.api;

import java.time.OffsetDateTime;

/**
 * Standard API response envelope.
 *
 * @param success whether request handling succeeded
 * @param code stable business response code
 * @param message human-readable response message
 * @param data response payload
 * @param timestamp response creation time
 * @param <T> payload type
 */
public record ApiResponse<T>(
        boolean success,
        String code,
        String message,
        T data,
        OffsetDateTime timestamp
) {

    private static final String OK_CODE = "OK";

    /**
     * Creates a successful response.
     *
     * @param data response payload
     * @param <T> payload type
     * @return success response
     */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, OK_CODE, "success", data, OffsetDateTime.now());
    }
}
