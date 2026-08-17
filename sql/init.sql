-- Database standard for future migrations:
-- table and column names must use snake_case.
-- every business table must include:
-- id BIGINT UNSIGNED AUTO_INCREMENT,
-- created_at DATETIME(3) NOT NULL,
-- updated_at DATETIME(3) NOT NULL,
-- deleted_at DATETIME(3) NULL.
-- Business tables are intentionally not created here.

CREATE DATABASE IF NOT EXISTS kilisocial
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'kilisocial_app'@'%' IDENTIFIED BY RANDOM PASSWORD;

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
    ON kilisocial.*
    TO 'kilisocial_app'@'%';

FLUSH PRIVILEGES;
