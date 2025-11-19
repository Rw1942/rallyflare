-- Migration: rename_max_tokens_to_max_output_tokens.sql
-- Rename max_tokens to max_output_tokens in project_settings

ALTER TABLE project_settings RENAME COLUMN max_tokens TO max_output_tokens;
