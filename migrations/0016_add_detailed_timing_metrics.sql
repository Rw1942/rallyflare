-- Migration number: 0016 	 2025-11-19
-- Add detailed timing metrics for each step

ALTER TABLE messages ADD COLUMN attachment_time_ms INTEGER;
ALTER TABLE messages ADD COLUMN mailer_time_ms INTEGER;

