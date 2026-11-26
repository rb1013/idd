-- 099_guardian_messages_direct_insert.sql
-- Guardian chat: the app inserts messages DIRECTLY into guardian_messages instead of calling the
-- send-guardian-message edge function. Same checks, now enforced by the database — one insert
-- instead of a function call with 6 sequential steps (+ occasional cold start).
-- Discussion: docs/chat-time.md. Also removes a function from the key switch (docs/supabase-keys.md).
--
-- 088 dropped the old insert rule ("sender_id = auth.uid()" only — no participant / block checks)
-- so the function was the only way in. This adds a complete one:
--   • you send as yourself                       (sender_id = auth.uid())
--   • you're a participant of the conversation
--   • no guardian block either way               (private.guardian_conversation_blocked, from 088)
-- plus a BEFORE INSERT trigger: trim, reject empty, reject blocked words (contains_blocked_word,
-- from 085 — same BLOCKED_WORDS error the app already handles), and server-set created_at.
-- Still no UPDATE / DELETE rules: messages can't be edited or deleted by guardians.

-- ── Insert rule ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Participants send guardian messages" ON guardian_messages;
CREATE POLICY "Participants send guardian messages" ON guardian_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM guardian_conversation_participants p
      WHERE p.conversation_id = guardian_messages.conversation_id
        AND p.guardian_id = (select auth.uid())
    )
    AND NOT private.guardian_conversation_blocked(conversation_id)
  );

-- ── Trigger: trim / empty / blocked words / timestamp ───────────────────────
CREATE OR REPLACE FUNCTION guardian_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content := btrim(NEW.content);
  IF NEW.content IS NULL OR NEW.content = '' THEN
    RAISE EXCEPTION 'EMPTY_MESSAGE' USING ERRCODE = 'check_violation';
  END IF;
  IF contains_blocked_word(NEW.content) THEN
    RAISE EXCEPTION 'BLOCKED_WORDS' USING ERRCODE = 'check_violation';
  END IF;
  NEW.created_at := now();   -- no back-dating from the client
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION guardian_messages_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guardian_messages_before_insert ON guardian_messages;
CREATE TRIGGER guardian_messages_before_insert
  BEFORE INSERT ON guardian_messages
  FOR EACH ROW EXECUTE FUNCTION guardian_messages_before_insert();
