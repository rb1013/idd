-- 080_guardian_chat_grants.sql only granted the authenticated role. The
-- send-guardian-message edge function reads/writes these tables via the
-- service_role key, which bypasses RLS but NOT table-level grants — Supabase
-- doesn't auto-grant service_role on new tables (same issue fixed for
-- tutorial_jobs in 016_tutorial_jobs_service_role_grant.sql), causing
-- "permission denied for table guardian_conversation_participants".

GRANT ALL ON guardian_conversations             TO service_role;
GRANT ALL ON guardian_conversation_participants TO service_role;
GRANT ALL ON guardian_messages                  TO service_role;
