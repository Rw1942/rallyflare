-- Migration number: 0017 	 2025-11-19
-- Add missing footer metrics: ingest time, OpenAI upload time, and cost tracking

-- Add timing columns for complete processing breakdown shown in email footer
-- ALTER TABLE messages ADD COLUMN ingest_time_ms INTEGER;
-- ALTER TABLE messages ADD COLUMN openai_upload_time_ms INTEGER;

-- Add cost tracking for each message's AI processing
-- ALTER TABLE messages ADD COLUMN cost_dollars REAL;

