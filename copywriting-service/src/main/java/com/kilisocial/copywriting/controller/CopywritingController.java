package com.kilisocial.copywriting.controller;

import com.kilisocial.common.api.ApiResponse;
import com.kilisocial.copywriting.service.CopywritingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Exposes AI copywriting generation to clients.
 */
@RestController
@RequestMapping("/api/v1/ai")
public class CopywritingController {

    private final CopywritingService copywritingService;

    /**
     * Creates the controller.
     *
     * @param copywritingService copywriting service
     */
    public CopywritingController(CopywritingService copywritingService) {
        this.copywritingService = copywritingService;
    }

    /**
     * Generates localized copy.
     *
     * @param request generation request
     * @return generated copy or not-found when template missing
     */
    @PostMapping("/copywriting")
    public ResponseEntity<ApiResponse<String>> generate(@Valid @RequestBody CopywritingRequest request) {
        Map<String, String> variables = request.variables() == null ? Map.of() : request.variables();
        try {
            String copy = copywritingService.generate(request.locale(), request.contentType(), variables);
            return ResponseEntity.ok(new ApiResponse<>(true, "OK", "success", copy, OffsetDateTime.now()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>(false, "TEMPLATE_NOT_FOUND", exception.getMessage(), null,
                            OffsetDateTime.now()));
        }
    }

    /**
     * Copywriting generation request body.
     *
     * @param locale target locale
     * @param contentType content type
     * @param variables template variables
     */
    public record CopywritingRequest(@NotBlank String locale, @NotBlank String contentType,
                                     Map<String, String> variables) {
    }
}
