-- RPC to create a conversation and add both participants atomically.
-- Uses SECURITY DEFINER to avoid the RETURNING/RLS chicken-and-egg problem
-- (SELECT policy requires participants to exist, but participants can't be
-- inserted until the conversation exists and its ID is known).
CREATE OR REPLACE FUNCTION create_conversation_with_participants(
  participant_a uuid,
  participant_b uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  conv_id uuid;
BEGIN
  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, participant_a);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, participant_b);
  RETURN conv_id;
END;
$$;

-- RPC to find an existing conversation between two users or create one.
-- SECURITY DEFINER bypasses RLS so the lookup always works regardless of
-- which auth role (guardian vs user) is making the request.
CREATE OR REPLACE FUNCTION find_or_create_conversation(p_user_a uuid, p_user_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  conv_id uuid;
BEGIN
  SELECT cp1.conversation_id INTO conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
  WHERE cp1.user_id = p_user_a AND cp2.user_id = p_user_b
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, p_user_a);
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, p_user_b);
  END IF;

  RETURN conv_id;
END;
$$;
