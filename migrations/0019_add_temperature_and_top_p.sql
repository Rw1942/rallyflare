-- Migration number: 0019 	 2025-11-19
-- Add top_p parameter for GPT-5.1 control (temperature already exists)

-- Add top_p (0-1) to project settings
-- Note: Modify either temperature OR top_p, not both (OpenAI best practice)
ALTER TABLE project_settings ADD COLUMN top_p REAL DEFAULT 1.0;

