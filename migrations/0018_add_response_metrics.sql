-- Migration number: 0018 	 2025-11-19
-- Add OpenAI response metrics for better observability

-- Add reasoning and caching metrics
-- ALTER TABLE messages ADD COLUMN reasoning_tokens INTEGER;
-- ALTER TABLE messages ADD COLUMN cached_tokens INTEGER;

-- Add configuration tracking from response
-- ALTER TABLE messages ADD COLUMN model TEXT;
-- ALTER TABLE messages ADD COLUMN service_tier TEXT;
-- ALTER TABLE messages ADD COLUMN reasoning_effort TEXT;
-- ALTER TABLE messages ADD COLUMN temperature REAL;
-- ALTER TABLE messages ADD COLUMN text_verbosity TEXT;

