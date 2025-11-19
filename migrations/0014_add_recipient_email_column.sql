-- Migration: Add recipient_email column to messages table for clarity
-- 
-- Purpose: Clarify email tracking semantics by separating two concerns:
--   - email_address: Always stores the Rally address (e.g., chat@email2chatgpt.com)
--   - recipient_email: For outbound messages, stores who received the reply
--
-- This makes queries more intuitive:
--   - "All messages for Rally address X" -> WHERE email_address = X
--   - "All outbound messages to user Y" -> WHERE recipient_email = Y AND direction = 'outbound'
--
-- Date: 2025-11-09

-- Add recipient_email column to messages table
ALTER TABLE messages ADD COLUMN recipient_email TEXT;

-- Create index for efficient queries on recipient_email
CREATE INDEX IF NOT EXISTS idx_messages_recipient_email ON messages(recipient_email);

-- Update existing outbound messages to populate recipient_email
-- For outbound messages, the recipient was previously stored in email_address
UPDATE messages 
SET recipient_email = email_address 
WHERE direction = 'outbound' AND email_address IS NOT NULL;

-- Update existing outbound messages to set email_address to the Rally address
-- We'll set it to 'chat@email2chatgpt.com' as the current default
UPDATE messages 
SET email_address = 'chat@email2chatgpt.com' 
WHERE direction = 'outbound';

-- Add comment explaining the columns
-- Note: SQLite doesn't support column comments, so this is for documentation only
-- 
-- Column semantics:
--   email_address: The Rally email address involved in this message
--     - For inbound: The Rally address that received the email
--     - For outbound: The Rally address that sent the email
--   
--   recipient_email: Who received the message (only for outbound)
--     - For inbound: NULL (the recipient is Rally, tracked in email_address)
--     - For outbound: The user's email address who received Rally's reply

