-- Migration number: 0002 	 2025-10-09
-- Rally core schema for messages, participants, attachments, and settings

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  subject TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  from_name TEXT,
  from_email TEXT,
  raw_text TEXT,
  raw_html TEXT,
  llm_summary TEXT,
  llm_reply TEXT,
  postmark_message_id TEXT,
  has_attachments INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  kind TEXT CHECK(kind IN ('to','cc','bcc')),
  name TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  filename TEXT,
  mime TEXT,
  size_bytes INTEGER,
  r2_key TEXT
);

CREATE TABLE IF NOT EXISTS project_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_slug TEXT UNIQUE,
  model TEXT,
  system_prompt TEXT,
  temperature REAL DEFAULT 0.2
);

-- Insert default project settings
INSERT INTO project_settings (project_slug, model, system_prompt, temperature)
VALUES ('default', 'gpt-4o-mini', 'You are Rally, an intelligent email assistant. Summarize the email content clearly and provide a helpful response.', 0.2);

