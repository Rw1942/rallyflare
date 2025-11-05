-- Migration number: 0010 	 2025-11-05
-- Add processing logs table for debugging and monitoring email processing

CREATE TABLE IF NOT EXISTS processing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT CHECK(level IN ('info', 'warning', 'error', 'debug')) DEFAULT 'info',
  stage TEXT,
  message TEXT,
  details TEXT,
  duration_ms INTEGER
);

-- Index for faster lookups by message_id and timestamp
CREATE INDEX IF NOT EXISTS idx_logs_message_id ON processing_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON processing_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON processing_logs(level);

