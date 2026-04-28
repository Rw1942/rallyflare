-- Migrate default model from gpt-5.1 (legacy, API shutdown 2026-07-23) to gpt-5.4
-- Also catch any remaining gpt-5 or older model strings

UPDATE project_settings
SET model = 'gpt-5.4'
WHERE model IN ('gpt-5.1', 'gpt-5', 'gpt-4o', 'gpt-4')
   OR model LIKE 'gpt-4%'
   OR model LIKE 'gpt-5.1%';

UPDATE email_settings
SET model = 'gpt-5.4'
WHERE model IN ('gpt-5.1', 'gpt-5', 'gpt-4o', 'gpt-4')
   OR model LIKE 'gpt-4%'
   OR model LIKE 'gpt-5.1%';

-- Update default cost columns to match gpt-5.4 pricing ($2.50 input / $15.00 output per 1M tokens)
UPDATE project_settings
SET cost_input_per_1m = 2.50,
    cost_output_per_1m = 15.00
WHERE model = 'gpt-5.4'
  AND (cost_input_per_1m != 2.50 OR cost_output_per_1m != 15.00);
