-- Fix "infinite recursion detected in policy for relation
-- guardian_conversation_participants": the SELECT policy added in
-- 077_guardian_chat.sql self-joined the table it protects, forcing Postgres
-- to re-evaluate the same policy while evaluating it. Any query touching
-- guardian_conversations/guardian_messages also hit this, since both of
-- those policies EXISTS-check guardian_conversation_participants.
--
-- Fix: check the row's own guardian_id column directly (no self-join needed
-- — unlike the learner chat, a guardian's auth.uid() IS the guardian id).
-- This only lets a guardian read their own participant row, which is
-- sufficient: the client never queries this table directly, only
-- guardian_messages (and the SECURITY DEFINER RPCs, which bypass RLS).

DROP POLICY IF EXISTS "Participants can read guardian participants" ON guardian_conversation_participants;

CREATE POLICY "Participants can read own guardian participant row" ON guardian_conversation_participants
  FOR SELECT USING (guardian_id = auth.uid());
