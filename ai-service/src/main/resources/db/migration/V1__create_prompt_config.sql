CREATE TABLE prompt_config (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    name VARCHAR(128) NOT NULL COMMENT 'Prompt config name',
    model VARCHAR(32) NOT NULL COMMENT 'Qwen model name',
    system_prompt TEXT NOT NULL COMMENT 'System prompt',
    user_template TEXT NOT NULL COMMENT 'User prompt template',
    version INT UNSIGNED NOT NULL COMMENT 'Prompt version',
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether prompt config is active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Creation time',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted_at DATETIME(3) NULL COMMENT 'Logical deletion time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_name_version (name, version),
    KEY idx_prompt_config_active_model (is_active, model)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Prompt configuration';
