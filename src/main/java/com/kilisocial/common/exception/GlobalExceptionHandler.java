package com.kilisocial.common.exception;

import com.kilisocial.common.api.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;

/**
 * Converts application exceptions into a uniform API response.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
    private static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

    /**
     * Handles expected business exceptions.
     *
     * @param exception business exception
     * @return normalized error response
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException exception) {
        return ResponseEntity.badRequest().body(error(exception.getCode(), exception.getMessage()));
    }

    /**
     * Handles invalid request body errors.
     *
     * @param exception validation exception
     * @return normalized error response
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception) {
        return ResponseEntity.badRequest().body(error(VALIDATION_ERROR_CODE, exception.getMessage()));
    }

    /**
     * Handles invalid request parameter errors.
     *
     * @param exception validation exception
     * @return normalized error response
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolationException(
            ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(error(VALIDATION_ERROR_CODE, exception.getMessage()));
    }

    /**
     * Handles unexpected runtime errors.
     *
     * @param exception unexpected exception
     * @return normalized error response
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error(INTERNAL_ERROR_CODE, "Internal server error"));
    }

    private ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null, OffsetDateTime.now());
    }
}
package com.kilisocial.common.exception;

import com.kilisocial.common.api.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;

/**
 * Converts application exceptions into a uniform API response.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String VALIDATION_ERROR_CODE = "VALIDATION_ERROR";
    private static final String INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

    /**
     * Handles expected business exceptions.
     *
     * @param exception business exception
     * @return normalized error response
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException exception) {
        return ResponseEntity.badRequest().body(error(exception.getCode(), exception.getMessage()));
    }

    /**
     * Handles invalid request body errors.
     *
     * @param exception validation exception
     * @return normalized error response
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception) {
        return ResponseEntity.badRequest().body(error(VALIDATION_ERROR_CODE, exception.getMessage()));
    }

    /**
     * Handles invalid request parameter errors.
     *
     * @param exception validation exception
     * @return normalized error response
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolationException(ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(error(VALIDATION_ERROR_CODE, exception.getMessage()));
    }

    /**
     * Handles unexpected runtime errors.
     *
     * @param exception unexpected exception
     * @return normalized error response
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error(INTERNAL_ERROR_CODE, "Internal server error"));
    }

    private ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null, OffsetDateTime.now());
    }
}
