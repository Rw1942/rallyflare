-- Migration: rename_verbosity_to_text_verbosity.sql
-- Rename verbosity to text_verbosity in project_settings

ALTER TABLE project_settings RENAME COLUMN verbosity TO text_verbosity;
