-- 093_block_policies_initplan.sql
-- Performance only: same rules as 088, same rows returned.
--
-- RLS conditions are checked for every row a query touches. In 088 they called auth.uid() and
-- is_admin() directly, so Postgres re-ran both for EVERY row (is_admin() is a lookup in admins).
-- Wrapping them in (select …) makes Postgres evaluate them once per query and reuse the value
-- (Supabase's recommended RLS pattern). is_blocked_between() still runs per row — it depends on
-- the row's guardian — but it's an indexed lookup.
--
-- ALTER POLICY rewrites each condition in place (no drop/recreate, so no gap in protection).
-- Policies with neither auth.uid() nor is_admin() (connection insert/update, notifications) are
-- unchanged.

-- ── guardian_blocks: own blocks only ──────────────────────────────────────────
ALTER POLICY "Guardians read own blocks" ON guardian_blocks
  USING (blocker_guardian_id = (select auth.uid()) OR (select is_admin()));
ALTER POLICY "Guardians create own blocks" ON guardian_blocks
  WITH CHECK (blocker_guardian_id = (select auth.uid()));
ALTER POLICY "Guardians remove own blocks" ON guardian_blocks
  USING (blocker_guardian_id = (select auth.uid()));

-- ── HIDE (restrictive SELECT) ─────────────────────────────────────────────────
ALTER POLICY "Block: hide blocked authors' posts" ON discussion_posts
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), guardian_id));

ALTER POLICY "Block: hide blocked authors' replies" ON discussion_replies
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), guardian_id));

ALTER POLICY "Block: hide blocked hosts' events" ON events
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), guardian_id));

ALTER POLICY "Block: hide blocked attendees" ON event_participants
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), guardian_id));

ALTER POLICY "Block: hide blocked guardians' profiles" ON guardians
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), id));

ALTER POLICY "Block: hide connections with blocked guardians" ON guardian_connections
  USING ((select is_admin()) OR NOT private.is_blocked_between(requester_id, addressee_id));

ALTER POLICY "Block: hide blocked guardians' tutorials" ON tutorials
  USING ((select is_admin()) OR NOT private.is_blocked_between((select auth.uid()), created_by_guardian_id));

ALTER POLICY "Block: hide conversations with blocked guardians" ON guardian_conversations
  USING ((select is_admin()) OR NOT private.guardian_conversation_blocked(id));

ALTER POLICY "Block: hide messages with blocked guardians" ON guardian_messages
  USING ((select is_admin()) OR NOT private.guardian_conversation_blocked(conversation_id));

-- ── STOP (restrictive writes) ─────────────────────────────────────────────────
ALTER POLICY "Block: no replies between blocked guardians" ON discussion_replies
  WITH CHECK (NOT private.is_blocked_between((select auth.uid()), private.discussion_post_author(post_id)));

ALTER POLICY "Block: no RSVP between blocked guardians" ON event_participants
  WITH CHECK (NOT private.is_blocked_between((select auth.uid()), private.event_host(event_id)));

ALTER POLICY "Block: no RSVP update between blocked guardians" ON event_participants
  WITH CHECK (NOT private.is_blocked_between((select auth.uid()), private.event_host(event_id)));
