package com.kilisocial.common.exception;

/**
 * Exception for expected business failures.
 */
public class BusinessException extends RuntimeException {

    private final String code;

    /**
     * Creates a business exception with a stable code and message.
     *
     * @param code stable business error code
     * @param message human-readable error message
     */
    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Returns the stable business error code.
     *
     * @return error code
     */
    public String getCode() {
        return code;
    }
}
