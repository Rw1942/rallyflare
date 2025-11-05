-- Migration number: 0009 2025-11-05
-- Add max_tokens column to project_settings table

ALTER TABLE project_settings ADD COLUMN max_tokens INTEGER DEFAULT 500;
