package com.kilisocial.ai.client;

/**
 * Sleep abstraction for retry backoff.
 */
public interface QwenSleeper {

    /**
     * Sleeps for backoff.
     *
     * @param millis sleep duration in milliseconds
     * @throws InterruptedException when interrupted
     */
    void sleep(long millis) throws InterruptedException;
}
