
-- Backfill users based on existing inbound messages
INSERT INTO users (email, name, last_seen_at, total_messages_sent, source, updated_at)
SELECT 
  from_email, 
  COALESCE(MAX(from_name), from_email), 
  MAX(received_at), 
  COUNT(*), 
  'backfill',
  datetime('now')
FROM messages 
WHERE direction = 'inbound' 
  AND from_email IS NOT NULL 
  AND from_email != ''
GROUP BY from_email
ON CONFLICT(email) DO UPDATE SET
  name = COALESCE(excluded.name, users.name),
  last_seen_at = MAX(users.last_seen_at, excluded.last_seen_at),
  total_messages_sent = excluded.total_messages_sent,
  updated_at = datetime('now');

