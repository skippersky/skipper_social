package com.kilisocial.ai.client;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link JdkQwenHttpClient}.
 */
class JdkQwenHttpClientTest {

    private static final int HTTP_OK = 200;
    private static final int HTTP_SERVER_ERROR = 500;
    private static final int TIMEOUT_MS = 2000;

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void postsBodyWithAuthHeader() throws Exception {
        AtomicReference<String> auth = new AtomicReference<>();
        AtomicReference<String> received = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/qwen", exchange -> {
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = "{\"output\":{\"text\":\"ok\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(HTTP_OK, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();

        JdkQwenHttpClient client = new JdkQwenHttpClient(
                "http://localhost:" + server.getAddress().getPort() + "/qwen", "key123", TIMEOUT_MS, TIMEOUT_MS);
        String response = client.post("{\"model\":\"qwen-turbo\"}");

        assertThat(response).contains("ok");
        assertThat(auth.get()).isEqualTo("Bearer key123");
        assertThat(received.get()).isEqualTo("{\"model\":\"qwen-turbo\"}");
    }

    @Test
    void throwsOnNon2xx() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/qwen", exchange -> {
            exchange.sendResponseHeaders(HTTP_SERVER_ERROR, -1);
            exchange.close();
        });
        server.start();

        JdkQwenHttpClient client = new JdkQwenHttpClient(
                "http://localhost:" + server.getAddress().getPort() + "/qwen", "key123", TIMEOUT_MS, TIMEOUT_MS);

        assertThatThrownBy(() -> client.post("{}")).isInstanceOf(IOException.class);
    }
}
