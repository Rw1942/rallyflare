-- Migration number: 0025 	 2025-11-20
-- Update model to gpt-5.1 (the correct latest GPT-5 model name)
-- Previous migration 0004 had misleading filename and set to 'gpt-5' instead of 'gpt-5.1'

UPDATE project_settings 
SET model = 'gpt-5.1' 
WHERE model = 'gpt-5' OR model = 'gpt-4o' OR model LIKE 'gpt-4%';



