-- 088_guardian_blocks.sql
-- Guardian ↔ guardian blocking (design: docs/guardian-block.md).
--
-- • Both ways: "A blocks B" hides each from the other and stops interaction. B isn't told.
-- • Enforced in the database with RESTRICTIVE policies added ALONGSIDE the existing ones
--   (existing policies are not modified): a row is visible only if the existing rules allow it
--   AND the two guardians aren't blocked. Admins (is_admin()) still see everything.
-- • Helper functions live in a `private` schema so they can be used by policies but are NOT
--   callable through the API (no one can probe "has X blocked me?").
-- • On block: their guardian connection (incl. pending requests) and RSVPs to each other's
--   events are removed — without sending the usual "withdrew their RSVP" notification.
-- • Kept (hidden only): posts, replies, events, conversations, messages — so reports keep
--   working and everything reappears on unblock.
-- • Learners are unaffected (guardian-only block).

-- ═══════════════════════════════════════════════════════════════════════════
-- Private helpers (usable in policies, not exposed through the API)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS guardian_blocks (
  blocker_guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  blocked_guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_guardian_id, blocked_guardian_id),
  CHECK (blocker_guardian_id <> blocked_guardian_id)
);

-- Reverse direction lookups (primary key covers blocker → blocked)
CREATE INDEX IF NOT EXISTS guardian_blocks_blocked_idx
  ON guardian_blocks (blocked_guardian_id, blocker_guardian_id);

ALTER TABLE guardian_blocks ENABLE ROW LEVEL SECURITY;

-- A guardian sees / adds / removes only blocks THEY made (the blocked person never sees them)
CREATE POLICY "Guardians read own blocks" ON guardian_blocks
  FOR SELECT TO authenticated USING (blocker_guardian_id = auth.uid() OR is_admin());
CREATE POLICY "Guardians create own blocks" ON guardian_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_guardian_id = auth.uid());
CREATE POLICY "Guardians remove own blocks" ON guardian_blocks
  FOR DELETE TO authenticated USING (blocker_guardian_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON guardian_blocks TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper functions
-- ═══════════════════════════════════════════════════════════════════════════

-- True if either guardian has blocked the other. NULLs / same person → false.
CREATE OR REPLACE FUNCTION private.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b AND EXISTS (
    SELECT 1 FROM guardian_blocks
    WHERE (blocker_guardian_id = a AND blocked_guardian_id = b)
       OR (blocker_guardian_id = b AND blocked_guardian_id = a)
  );
$$;

-- Author of a discussion post / host of an event, read with owner rights (the row itself may be
-- hidden from the caller by the block, which would otherwise make the lookup return NULL).
CREATE OR REPLACE FUNCTION private.discussion_post_author(p_post_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT guardian_id FROM discussion_posts WHERE id = p_post_id; $$;

CREATE OR REPLACE FUNCTION private.event_host(p_event_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT guardian_id FROM events WHERE id = p_event_id; $$;

-- True if the caller and the OTHER participant of a guardian conversation are blocked.
-- Owner rights avoid policy recursion on guardian_conversation_participants.
CREATE OR REPLACE FUNCTION private.guardian_conversation_blocked(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM guardian_conversation_participants other
    WHERE other.conversation_id = p_conversation_id
      AND other.guardian_id <> auth.uid()
      AND private.is_blocked_between(auth.uid(), other.guardian_id)
  );
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- HIDE (restrictive SELECT policies, ANDed with the existing ones)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "Block: hide blocked authors' posts" ON discussion_posts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), guardian_id));

CREATE POLICY "Block: hide blocked authors' replies" ON discussion_replies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), guardian_id));

CREATE POLICY "Block: hide blocked hosts' events" ON events
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), guardian_id));

CREATE POLICY "Block: hide blocked attendees" ON event_participants
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), guardian_id));

CREATE POLICY "Block: hide blocked guardians' profiles" ON guardians
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), id));

CREATE POLICY "Block: hide connections with blocked guardians" ON guardian_connections
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(requester_id, addressee_id));

CREATE POLICY "Block: hide blocked guardians' tutorials" ON tutorials
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.is_blocked_between(auth.uid(), created_by_guardian_id));

CREATE POLICY "Block: hide conversations with blocked guardians" ON guardian_conversations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.guardian_conversation_blocked(id));

CREATE POLICY "Block: hide messages with blocked guardians" ON guardian_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (is_admin() OR NOT private.guardian_conversation_blocked(conversation_id));

-- Notifications that record who caused them (e.g. event RSVPs). Reply notifications don't
-- record a source, but new ones can't happen between blocked guardians (replies are refused).
CREATE POLICY "Block: hide notifications from blocked guardians" ON notifications
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.is_blocked_between(guardian_id, source_guardian_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- STOP (restrictive write policies)
-- ═══════════════════════════════════════════════════════════════════════════

-- Reply to a post whose author is blocked either way
CREATE POLICY "Block: no replies between blocked guardians" ON discussion_replies
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT private.is_blocked_between(auth.uid(), private.discussion_post_author(post_id)));

-- RSVP to a blocked host's event
CREATE POLICY "Block: no RSVP between blocked guardians" ON event_participants
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT private.is_blocked_between(auth.uid(), private.event_host(event_id)));
CREATE POLICY "Block: no RSVP update between blocked guardians" ON event_participants
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (NOT private.is_blocked_between(auth.uid(), private.event_host(event_id)));

-- Connection requests / accepting between blocked guardians
CREATE POLICY "Block: no connection requests between blocked guardians" ON guardian_connections
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT private.is_blocked_between(requester_id, addressee_id));
CREATE POLICY "Block: no connection changes between blocked guardians" ON guardian_connections
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (NOT private.is_blocked_between(requester_id, addressee_id));

-- Messages may only be sent through the send-guardian-message edge function (which checks
-- blocks and the word filter). Remove the direct-insert loophole — the app never inserts directly.
DROP POLICY IF EXISTS "Participants can send guardian messages" ON guardian_messages;

-- ═══════════════════════════════════════════════════════════════════════════
-- Opening a chat: refuse between blocked guardians (incl. an existing conversation)
-- (Same as 077_guardian_chat.sql, plus the block check at the top.)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION find_or_create_guardian_conversation(p_guardian_a uuid, p_guardian_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  conv_id uuid;
  is_connected boolean;
BEGIN
  IF private.is_blocked_between(p_guardian_a, p_guardian_b) THEN
    RAISE EXCEPTION 'GUARDIAN_BLOCKED' USING ERRCODE = 'insufficient_privilege';
  END IF;

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

-- ═══════════════════════════════════════════════════════════════════════════
-- On block: remove connection + RSVPs between the two (silently)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION guardian_blocks_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Suppress "withdrew their RSVP" notifications for the RSVPs removed below (they'd reveal the block)
  PERFORM set_config('app.guardian_blocking', 'on', true);

  DELETE FROM guardian_connections
  WHERE (requester_id = NEW.blocker_guardian_id AND addressee_id = NEW.blocked_guardian_id)
     OR (requester_id = NEW.blocked_guardian_id AND addressee_id = NEW.blocker_guardian_id);

  DELETE FROM event_participants ep
  USING events e
  WHERE e.id = ep.event_id
    AND (
      (ep.guardian_id = NEW.blocker_guardian_id AND e.guardian_id = NEW.blocked_guardian_id) OR
      (ep.guardian_id = NEW.blocked_guardian_id AND e.guardian_id = NEW.blocker_guardian_id)
    );

  PERFORM set_config('app.guardian_blocking', '', true);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION guardian_blocks_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guardian_blocks_cleanup ON guardian_blocks;
CREATE TRIGGER guardian_blocks_cleanup AFTER INSERT ON guardian_blocks
  FOR EACH ROW EXECUTE FUNCTION guardian_blocks_after_insert();

-- notify_event_rsvp_removed(): same as 071_fix_event_rsvp_notif_on_guardian_delete.sql, plus a
-- skip while a block is removing RSVPs (so the host isn't told — that would reveal the block).
CREATE OR REPLACE FUNCTION notify_event_rsvp_removed()
RETURNS TRIGGER AS $$
DECLARE
  organiser_id  uuid;
  event_name    text;
  guardian_name text;
BEGIN
  -- RSVP removed as part of a guardian block — stay silent
  IF current_setting('app.guardian_blocking', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT guardian_id, name INTO organiser_id, event_name
  FROM events WHERE id = OLD.event_id;

  -- Event (and its organiser) already gone, or organiser un-RSVPing their own event
  IF organiser_id IS NULL OR organiser_id = OLD.guardian_id THEN
    RETURN OLD;
  END IF;

  -- Acting guardian's own account is mid-deletion — nothing to notify about
  IF NOT EXISTS (SELECT 1 FROM guardians WHERE id = OLD.guardian_id) THEN
    RETURN OLD;
  END IF;

  SELECT full_name INTO guardian_name FROM guardians WHERE id = OLD.guardian_id;

  DELETE FROM notifications
  WHERE guardian_id = organiser_id
    AND ref_id = OLD.event_id
    AND type = 'event_rsvp'
    AND source_guardian_id = OLD.guardian_id;

  INSERT INTO notifications (guardian_id, type, message, ref_id, source_guardian_id)
  VALUES (
    organiser_id,
    'event_rsvp',
    COALESCE(guardian_name, 'A guardian') || ' withdrew their RSVP from "' || COALESCE(event_name, 'your event') || '"',
    OLD.event_id,
    OLD.guardian_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
