-- Migration number: 0006  2025-01-27
-- Add email-specific prompt configuration

-- Create table for email-specific prompts
CREATE TABLE IF NOT EXISTS email_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert some example email-specific prompts (only if they don't exist)
INSERT OR IGNORE INTO email_prompts (email_address, system_prompt) VALUES 
('support@rallycollab.com', 'You are Rally, a customer support assistant. Provide helpful, empathetic responses to customer inquiries. Always be polite and professional.'),
('sales@rallycollab.com', 'You are Rally, a sales assistant. Help qualify leads, answer product questions, and schedule meetings. Be enthusiastic but not pushy.'),
('feedback@rallycollab.com', 'You are Rally, a feedback collector. Acknowledge feedback graciously, ask clarifying questions when needed, and summarize key points.');

-- Add email_address column to messages table to track which email was used
ALTER TABLE messages ADD COLUMN email_address TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_prompts_address ON email_prompts(email_address);
CREATE INDEX IF NOT EXISTS idx_messages_email_address ON messages(email_address);
