-- Migration: add_openai_response_id_to_messages.sql
-- Add openai_response_id to messages table

ALTER TABLE messages ADD COLUMN openai_response_id TEXT;
