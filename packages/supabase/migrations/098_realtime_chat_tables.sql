-- Live chat: ChatScreen / GuardianChatScreen listen for new rows with Realtime `postgres_changes`,
-- which only fires for tables in the `supabase_realtime` publication. The chat tables were never
-- added (it's a dashboard setting, not in any migration), so new messages only appeared after
-- reopening the chat. Realtime still applies the tables' RLS, so people only get messages from
-- chats they can read.
--
-- Recorded here so it isn't lost again (e.g. when moving projects). Also enabled by hand in the
-- dashboard (Database → Publications → supabase_realtime) on both the old and the new project, so
-- this is written to be safe to run when the tables are already there.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'guardian_messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
