-- Diagnostic change: mark_guardian_conversation_read previously returned void,
-- so a silent "0 rows matched" (e.g. a guardian_id/conversation_id mismatch —
-- a data problem, not a permissions one) was indistinguishable from a real
-- success. Now returns the number of rows actually updated (0 or 1) so the
-- client can tell "stamped fine" apart from "matched nothing" apart from
-- "the call itself errored" — the badge-not-clearing bug reported against
-- GuardianConnectionsScreen could be any of these three and was previously
-- invisible because the client never awaited or checked this call either.

-- Return type is changing (void -> integer), which CREATE OR REPLACE can't do.
DROP FUNCTION IF EXISTS mark_guardian_conversation_read(uuid, uuid);

CREATE FUNCTION mark_guardian_conversation_read(p_conversation_id uuid, p_guardian_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE guardian_conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND guardian_id = p_guardian_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;
