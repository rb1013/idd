-- 100_messages_direct_insert.sql
-- Learner chat: the app inserts messages DIRECTLY into messages instead of calling the send-message
-- edge function — same pattern as guardian chat (099). Plan + decisions: docs/chat-time.md §8.
--
-- Replaces the weak rule "Participants can send messages" (WITH CHECK owns_user_profile(sender_id)):
-- that let the learner OR their guardian insert into ANY conversation with no participant,
-- blocked-word, learner-block or Disable Messaging check. The new rule allows an insert only if:
--   • the sender is MY learner login (user_profiles.auth_user_id = auth.uid()) — learner login only.
--     Learner mode signs in as the learner, so a guardian sending from the learner's chat IS the
--     learner here; guardian mode can't send as the learner.
--   • the sender's messaging isn't disabled (user_profiles.messaging_disabled)
--   • the sender is a participant of the conversation
--   • no learner block either way with the other participant (blocked_learners)
-- No "still friends" check and reports don't block (decided 2026-11-25).
-- Plus a BEFORE INSERT trigger: trim, reject empty, reject blocked words (contains_blocked_word,
-- from 085 — BLOCKED_WORDS error), server-set created_at, read_at cleared.
-- Still no UPDATE / DELETE rules for learners (guardian-action deletes with the service role).

-- ── Helper: learner block between the sender and the other participant ──────
-- Owner rights: blocked_learners rows of the other side aren't readable by the sender.
-- In the private schema so it isn't callable through the API (no probing "who blocked me").
CREATE OR REPLACE FUNCTION private.learner_conversation_blocked(p_conversation_id uuid, p_sender_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants other
    JOIN blocked_learners b
      ON (b.learner_id = p_sender_id    AND b.blocked_learner_id = other.user_id)
      OR (b.learner_id = other.user_id  AND b.blocked_learner_id = p_sender_id)
    WHERE other.conversation_id = p_conversation_id
      AND other.user_id <> p_sender_id
  );
$$;

REVOKE EXECUTE ON FUNCTION private.learner_conversation_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION private.learner_conversation_blocked(uuid, uuid) TO authenticated;

-- ── Insert rule ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Learners send messages" ON messages;
CREATE POLICY "Learners send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- my learner login, messaging not disabled
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = messages.sender_id
        AND up.auth_user_id = (select auth.uid())
        AND NOT coalesce(up.messaging_disabled, false)
    )
    -- participant of the conversation
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = messages.sender_id
    )
    -- no learner block either way
    AND NOT private.learner_conversation_blocked(conversation_id, sender_id)
  );

-- ── Trigger: trim / empty / blocked words / timestamps ──────────────────────
CREATE OR REPLACE FUNCTION messages_before_insert()
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
  NEW.read_at    := NULL;    -- a new message is never already read
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION messages_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_before_insert ON messages;
CREATE TRIGGER messages_before_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_before_insert();
