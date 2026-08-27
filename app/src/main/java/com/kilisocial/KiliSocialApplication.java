package com.kilisocial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * KiliSocial backend application entry point.
 */
@SpringBootApplication
public class KiliSocialApplication {

    /**
     * Starts the Spring Boot application.
     *
     * @param args command line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(KiliSocialApplication.class, args);
    }
}
