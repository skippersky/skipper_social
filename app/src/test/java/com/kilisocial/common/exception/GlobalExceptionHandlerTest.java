package com.kilisocial.common.exception;

import com.kilisocial.common.api.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for {@link GlobalExceptionHandler}.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleBusinessExceptionReturnsBadRequest() {
        ResponseEntity<ApiResponse<Void>> response = handler.handleBusinessException(
                new BusinessException("INVALID_PROMPT", "Prompt is invalid"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("INVALID_PROMPT");
        assertThat(response.getBody().success()).isFalse();
    }

    @Test
    void handleConstraintViolationExceptionReturnsValidationError() {
        ResponseEntity<ApiResponse<Void>> response = handler.handleConstraintViolationException(
                new ConstraintViolationException("locale must not be blank", null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("VALIDATION_ERROR");
    }

    @Test
    void handleExceptionReturnsInternalServerError() {
        ResponseEntity<ApiResponse<Void>> response = handler.handleException(new IllegalStateException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("INTERNAL_ERROR");
    }
}
