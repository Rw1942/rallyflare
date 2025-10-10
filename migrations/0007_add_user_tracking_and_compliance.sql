-- Migration number: 0007  2025-10-10
-- Add user tracking and compliance data for GDPR/privacy requirements

-- Create users table to track every unique email address
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  
  -- Interaction tracking
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  total_messages_sent INTEGER DEFAULT 1,
  total_messages_received INTEGER DEFAULT 0,
  
  -- Compliance and privacy data
  ip_address TEXT,
  user_agent TEXT,
  consent_email BOOLEAN DEFAULT 0,
  consent_data_processing BOOLEAN DEFAULT 0,
  consent_timestamp TEXT,
  opt_out BOOLEAN DEFAULT 0,
  opt_out_timestamp TEXT,
  
  -- GDPR data subject rights tracking
  data_export_requested BOOLEAN DEFAULT 0,
  data_export_timestamp TEXT,
  deletion_requested BOOLEAN DEFAULT 0,
  deletion_timestamp TEXT,
  
  -- Metadata
  source TEXT, -- 'inbound_email', 'manual', etc.
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create interaction log for audit trail
CREATE TABLE IF NOT EXISTS user_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  message_id TEXT NOT NULL,
  interaction_type TEXT CHECK(interaction_type IN ('inbound', 'outbound')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_opt_out ON users(opt_out);
CREATE INDEX IF NOT EXISTS idx_user_interactions_email ON user_interactions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_interactions_message ON user_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON user_interactions(timestamp);

