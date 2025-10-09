-- Migration number: 0003 	 2025-10-09
-- Add direction field to distinguish incoming vs outgoing messages

ALTER TABLE messages ADD COLUMN direction TEXT CHECK(direction IN ('inbound', 'outbound')) DEFAULT 'inbound';
ALTER TABLE messages ADD COLUMN sent_at TEXT;
ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);

