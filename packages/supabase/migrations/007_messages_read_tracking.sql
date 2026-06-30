-- Track when each participant last read a conversation
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT now();

-- Returns all conversations for a user with unread counts and friend info
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  friend_id uuid,
  friend_name text,
  friend_photo text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM (
    SELECT
      c.id AS conversation_id,
      up.id AS friend_id,
      up.name AS friend_name,
      up.photo_url AS friend_photo,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
      (SELECT COUNT(*) FROM messages m2
       WHERE m2.conversation_id = c.id
         AND m2.created_at > cp_me.last_read_at
         AND m2.sender_id != p_user_id) AS unread_count
    FROM conversations c
    JOIN conversation_participants cp_me ON cp_me.conversation_id = c.id AND cp_me.user_id = p_user_id
    JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != p_user_id
    JOIN user_profiles up ON up.id = cp_other.user_id
  ) sub
  ORDER BY sub.last_message_at DESC NULLS LAST;
$$;

-- Stamps last_read_at for a participant when they open a chat
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
$$;
