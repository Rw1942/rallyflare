-- Migration 0030: Make GPT-5.5 the app default model.
-- Existing project defaults still live in D1, so update the default project row
-- and its cost settings to match the new frontier model pricing.

UPDATE project_settings
SET model = 'gpt-5.5',
    cost_input_per_1m = 5.00,
    cost_output_per_1m = 30.00
WHERE project_slug = 'default';
