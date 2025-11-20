
-- Create a trigger to automatically update users table when a new inbound message is inserted
CREATE TRIGGER IF NOT EXISTS trigger_update_user_on_inbound
AFTER INSERT ON messages
WHEN new.direction = 'inbound'
BEGIN
  INSERT INTO users (email, name, last_seen_at, total_messages_sent, source, updated_at)
  VALUES (
    new.from_email, 
    COALESCE(new.from_name, new.from_email), 
    new.received_at, 
    1, 
    'inbound_email', 
    datetime('now')
  )
  ON CONFLICT(email) DO UPDATE SET
    name = COALESCE(excluded.name, users.name),
    last_seen_at = excluded.last_seen_at,
    total_messages_sent = users.total_messages_sent + 1,
    updated_at = datetime('now');
END;

