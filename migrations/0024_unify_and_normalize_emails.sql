-- Migration: Unify and Normalize Emails
-- Purpose: 
-- 1. Backfill recipient_email for old inbound messages to allow unified querying.
-- 2. Normalize all email addresses to lowercase to prevent split history.
-- 3. Rebuild users table to reflect normalized data.

-- 1. Backfill recipient_email for old inbound messages
-- For inbound messages, the sender (from_email) is the user (recipient of the service).
UPDATE messages 
SET recipient_email = from_email 
WHERE direction = 'inbound' AND recipient_email IS NULL;

-- 2. Normalize messages table emails
UPDATE messages 
SET 
  from_email = lower(from_email),
  recipient_email = lower(recipient_email),
  email_address = lower(email_address);

-- 3. Normalize email_settings table emails
UPDATE email_settings 
SET email_address = lower(email_address);

-- 4. Create lowercase index for efficient querying (simplification)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_email_lower ON messages(lower(recipient_email));

-- 5. Rebuild users table
-- Delete all users to clear mixed-case duplicates
DELETE FROM users;

-- Reinsert users derived from normalized messages
INSERT INTO users (email, name, last_seen_at, total_messages_sent, source, updated_at)
SELECT 
  from_email, 
  COALESCE(max(from_name), from_email), 
  max(received_at), 
  COUNT(*), 
  'backfill_migration', 
  datetime('now')
FROM messages 
WHERE direction = 'inbound' 
GROUP BY from_email;

