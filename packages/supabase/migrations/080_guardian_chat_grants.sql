-- 077_guardian_chat.sql created guardian_conversations, guardian_conversation_participants,
-- and guardian_messages with RLS policies but never granted the authenticated
-- role base table privileges, causing "permission denied for table
-- guardian_messages" — RLS only restricts rows, it doesn't substitute for
-- the table-level GRANT every other table in this schema has.

GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_conversations             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guardian_messages                 TO authenticated;
