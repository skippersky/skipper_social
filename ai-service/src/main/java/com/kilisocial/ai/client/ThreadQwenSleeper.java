package com.kilisocial.ai.client;

/**
 * Thread-based retry sleeper.
 */
public class ThreadQwenSleeper implements QwenSleeper {

    /**
     * Sleeps current thread.
     *
     * @param millis sleep duration in milliseconds
     * @throws InterruptedException when interrupted
     */
    @Override
    public void sleep(long millis) throws InterruptedException {
        Thread.sleep(millis);
    }
}
