-- Migration number: 0004 	 2025-10-09
-- Update existing project settings to use GPT-5 with Responses API
-- GPT-5 uses reasoning effort and verbosity instead of temperature

UPDATE project_settings 
SET model = 'gpt-5' 
WHERE project_slug = 'default';

