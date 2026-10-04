-- Simple text-only chat between connected guardians. Mirrors the existing
-- learner chat (conversations/conversation_participants/messages) but scoped
-- to guardians(id) directly — a guardian's auth.uid() IS the guardian id, so
-- there's no user_profiles ownership indirection to replicate here, unlike
-- the learner tables.
--
-- No blocking/delete/report features — guardian_connections.status already
-- gates who can chat (must be 'accepted'; 'blocked' connections are refused
-- by find_or_create_guardian_conversation below).

CREATE TABLE IF NOT EXISTS guardian_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guardian_conversation_participants (
  conversation_id  uuid NOT NULL REFERENCES guardian_conversations(id) ON DELETE CASCADE,
  guardian_id      uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  last_read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS guardian_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES guardian_conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  content          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_messages_conversation ON guardian_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_guardian_conversation_participants_guardian ON guardian_conversation_participants (guardian_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE guardian_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read guardian conversations" ON guardian_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardian_conversation_participants gcp
      WHERE gcp.conversation_id = guardian_conversations.id
        AND gcp.guardian_id = auth.uid()
    )
  );
CREATE POLICY "Authenticated can create guardian conversations" ON guardian_conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Participants can read guardian participants" ON guardian_conversation_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardian_conversation_participants me
      WHERE me.conversation_id = guardian_conversation_participants.conversation_id
        AND me.guardian_id = auth.uid()
    )
  );
CREATE POLICY "Authenticated can insert guardian participants" ON guardian_conversation_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Participants can update their own read state" ON guardian_conversation_participants
  FOR UPDATE USING (guardian_id = auth.uid());

CREATE POLICY "Participants can read guardian messages" ON guardian_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardian_conversation_participants gcp
      WHERE gcp.conversation_id = guardian_messages.conversation_id
        AND gcp.guardian_id = auth.uid()
    )
  );
CREATE POLICY "Participants can send guardian messages" ON guardian_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

-- Finds the existing conversation between two connected guardians, or creates
-- one. SECURITY DEFINER avoids the insert/RLS chicken-and-egg problem (same
-- reasoning as find_or_create_conversation for learners). Refuses to create a
-- conversation unless the two guardians have an accepted connection.
CREATE OR REPLACE FUNCTION find_or_create_guardian_conversation(p_guardian_a uuid, p_guardian_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  conv_id uuid;
  is_connected boolean;
BEGIN
  SELECT gcp1.conversation_id INTO conv_id
  FROM guardian_conversation_participants gcp1
  JOIN guardian_conversation_participants gcp2 ON gcp2.conversation_id = gcp1.conversation_id
  WHERE gcp1.guardian_id = p_guardian_a AND gcp2.guardian_id = p_guardian_b
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM guardian_connections
    WHERE status = 'accepted'
      AND (
        (requester_id = p_guardian_a AND addressee_id = p_guardian_b) OR
        (requester_id = p_guardian_b AND addressee_id = p_guardian_a)
      )
  ) INTO is_connected;

  IF NOT is_connected THEN
    RAISE EXCEPTION 'Guardians are not connected';
  END IF;

  INSERT INTO guardian_conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO guardian_conversation_participants (conversation_id, guardian_id) VALUES (conv_id, p_guardian_a);
  INSERT INTO guardian_conversation_participants (conversation_id, guardian_id) VALUES (conv_id, p_guardian_b);
  RETURN conv_id;
END;
$$;

-- Stamps last_read_at for a participant when they open a chat.
CREATE OR REPLACE FUNCTION mark_guardian_conversation_read(p_conversation_id uuid, p_guardian_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE guardian_conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND guardian_id = p_guardian_id;
$$;

-- Unread message count per connection, keyed by the OTHER guardian's id, for
-- badging the "My Connections" list without opening each chat.
CREATE OR REPLACE FUNCTION get_guardian_unread_counts(p_guardian_id uuid)
RETURNS TABLE (
  other_guardian_id uuid,
  unread_count bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    gcp_other.guardian_id AS other_guardian_id,
    (SELECT COUNT(*) FROM guardian_messages gm
     WHERE gm.conversation_id = gcp_me.conversation_id
       AND gm.created_at > gcp_me.last_read_at
       AND gm.sender_id != p_guardian_id) AS unread_count
  FROM guardian_conversation_participants gcp_me
  JOIN guardian_conversation_participants gcp_other
    ON gcp_other.conversation_id = gcp_me.conversation_id
    AND gcp_other.guardian_id != p_guardian_id
  WHERE gcp_me.guardian_id = p_guardian_id;
$$;
