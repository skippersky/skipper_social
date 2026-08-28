package com.kilisocial.ai.client;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * JDK HttpURLConnection based transport for the Qwen API.
 */
public class JdkQwenHttpClient implements QwenHttpClient {

    private static final int HTTP_SUCCESS_MIN = 200;
    private static final int HTTP_SUCCESS_MAX = 300;

    private final String apiUrl;
    private final String apiKey;
    private final int connectTimeoutMillis;
    private final int readTimeoutMillis;

    /**
     * Creates the HTTP transport.
     *
     * @param apiUrl Qwen API endpoint
     * @param apiKey Qwen API key
     * @param connectTimeoutMillis connect timeout
     * @param readTimeoutMillis read timeout
     */
    public JdkQwenHttpClient(String apiUrl, String apiKey, int connectTimeoutMillis, int readTimeoutMillis) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.connectTimeoutMillis = connectTimeoutMillis;
        this.readTimeoutMillis = readTimeoutMillis;
    }

    @Override
    public String post(String requestBody) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(apiUrl).toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(connectTimeoutMillis);
        connection.setReadTimeout(readTimeoutMillis);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        try (OutputStream out = connection.getOutputStream()) {
            out.write(requestBody.getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        if (status < HTTP_SUCCESS_MIN || status >= HTTP_SUCCESS_MAX) {
            connection.disconnect();
            throw new IOException("Qwen API returned HTTP " + status);
        }
        try (InputStream in = connection.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } finally {
            connection.disconnect();
        }
    }
}
