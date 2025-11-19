-- Migration number: 0015 	 2025-11-19
-- Add cost configuration to project_settings

ALTER TABLE project_settings ADD COLUMN cost_input_per_1m REAL DEFAULT 2.50;
ALTER TABLE project_settings ADD COLUMN cost_output_per_1m REAL DEFAULT 10.00;

