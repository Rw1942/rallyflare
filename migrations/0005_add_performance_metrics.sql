-- Migration number: 0005 	 2025-10-09
-- Add performance tracking: processing time and token usage

-- Add columns for tracking performance metrics
ALTER TABLE messages ADD COLUMN processing_time_ms INTEGER;
ALTER TABLE messages ADD COLUMN ai_response_time_ms INTEGER;
ALTER TABLE messages ADD COLUMN tokens_input INTEGER;
ALTER TABLE messages ADD COLUMN tokens_output INTEGER;

