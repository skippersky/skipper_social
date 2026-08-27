package com.kilisocial.health.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for {@link HelloController}.
 */
@WebMvcTest(HelloController.class)
class HelloControllerTest {

    private final MockMvc mockMvc;

    HelloControllerTest(@Autowired MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void helloReturnsEnglishMessageByDefault() throws Exception {
        mockMvc.perform(get("/api/v1/hello"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.service", is("kili-social")))
                .andExpect(jsonPath("$.data.message", is("Hello from KiliSocial")));
    }

    @Test
    void helloReturnsSwahiliMessage() throws Exception {
        mockMvc.perform(get("/api/v1/hello").param("locale", "sw"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message", is("Hujambo from KiliSocial")));
    }
}
