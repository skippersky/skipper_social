package com.kilisocial.copywriting.controller;

import com.kilisocial.copywriting.service.CopywritingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for {@link CopywritingController}.
 */
class CopywritingControllerTest {

    private final CopywritingService copywritingService = Mockito.mock(CopywritingService.class);

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new CopywritingController(copywritingService))
                .setValidator(validator)
                .build();
    }

    @Test
    void generateReturnsCopy() throws Exception {
        when(copywritingService.generate(eq("en"), eq("social_post"), anyMap())).thenReturn("hello copy");
        String body = "{\"locale\":\"en\",\"contentType\":\"social_post\","
                + "\"variables\":{\"content\":\"tea\"}}";

        mockMvc.perform(post("/api/v1/ai/copywriting")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").value("hello copy"));
    }

    @Test
    void missingTemplateReturnsNotFound() throws Exception {
        when(copywritingService.generate(eq("xx"), eq("social_post"), anyMap()))
                .thenThrow(new IllegalArgumentException("Prompt template not found"));

        mockMvc.perform(post("/api/v1/ai/copywriting")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locale\":\"xx\",\"contentType\":\"social_post\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TEMPLATE_NOT_FOUND"));
    }

    @Test
    void blankLocaleReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/ai/copywriting")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locale\":\"\",\"contentType\":\"social_post\"}"))
                .andExpect(status().isBadRequest());
    }
}
