-- Migration number: 0020 	 2025-11-19
-- Refactor email_prompts to email_settings with full parameter override support

-- Rename table to reflect its broader purpose
-- ALTER TABLE email_prompts RENAME TO email_settings;

-- Add all configurable AI parameters (NULL means "use default from project_settings")
-- ALTER TABLE email_settings ADD COLUMN model TEXT;
-- ALTER TABLE email_settings ADD COLUMN reasoning_effort TEXT;
-- ALTER TABLE email_settings ADD COLUMN text_verbosity TEXT;
-- ALTER TABLE email_settings ADD COLUMN max_output_tokens INTEGER;
-- ALTER TABLE email_settings ADD COLUMN temperature REAL;
-- ALTER TABLE email_settings ADD COLUMN top_p REAL;

-- Drop and recreate index with new table name
-- DROP INDEX IF EXISTS idx_email_prompts_address;
-- CREATE INDEX IF NOT EXISTS idx_email_settings_address ON email_settings(email_address);

