-- Migration number: 0021 	 2025-11-19
-- Remove temperature and top_p columns (not supported by GPT-5.1 Responses API)

-- Remove from project_settings
-- Note: SQLite doesn't support DROP COLUMN directly in all versions
-- We'll create a new table without these columns and migrate data

-- Step 1: Create new project_settings without temperature/top_p
CREATE TABLE project_settings_new (
  id INTEGER PRIMARY KEY,
  project_slug TEXT,
  model TEXT,
  system_prompt TEXT,
  max_output_tokens INTEGER DEFAULT 500,
  reasoning_effort TEXT DEFAULT 'low',
  text_verbosity TEXT DEFAULT 'low',
  cost_input_per_1m REAL DEFAULT 2.50,
  cost_output_per_1m REAL DEFAULT 10.00
);

-- Step 2: Copy data
INSERT INTO project_settings_new 
  SELECT id, project_slug, model, system_prompt, max_output_tokens, reasoning_effort, text_verbosity, cost_input_per_1m, cost_output_per_1m
  FROM project_settings;

-- Step 3: Drop old table
DROP TABLE project_settings;

-- Step 4: Rename new table
ALTER TABLE project_settings_new RENAME TO project_settings;

-- Step 5: Create new email_settings without temperature/top_p
CREATE TABLE email_settings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT,
  reasoning_effort TEXT,
  text_verbosity TEXT,
  max_output_tokens INTEGER
);

-- Step 6: Copy data (ignore temperature and top_p)
INSERT INTO email_settings_new 
  SELECT id, email_address, system_prompt, created_at, updated_at, model, reasoning_effort, text_verbosity, max_output_tokens
  FROM email_settings;

-- Step 7: Drop old table
DROP TABLE email_settings;

-- Step 8: Rename new table
ALTER TABLE email_settings_new RENAME TO email_settings;

-- Step 9: Recreate index
CREATE INDEX IF NOT EXISTS idx_email_settings_address ON email_settings(email_address);
