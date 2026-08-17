package com.kilisocial.ai.client;

import java.io.IOException;

/**
 * HTTP transport for Qwen API calls.
 */
public interface QwenHttpClient {

    /**
     * Sends request payload to Qwen API.
     *
     * @param requestBody serialized request body
     * @return serialized response body
     * @throws IOException when network request fails
     */
    String post(String requestBody) throws IOException;
}
