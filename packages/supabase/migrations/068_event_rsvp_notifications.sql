-- ── 1. Add event_rsvp to notification_type enum ──────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'event_rsvp';

-- ── 2. Add source_guardian_id to track who triggered the notification ─────────
--    Needed to selectively update/delete one guardian's RSVP notification
--    without touching notifications from other guardians on the same event.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL;

-- ── 3. Remove 'not_going' from event_participants ─────────────────────────────
DELETE FROM event_participants WHERE rsvp = 'not_going';

ALTER TABLE event_participants DROP CONSTRAINT IF EXISTS event_participants_rsvp_check;
ALTER TABLE event_participants ADD CONSTRAINT event_participants_rsvp_check
  CHECK (rsvp IN ('going', 'interested'));

-- ── 4. Trigger: RSVP added or changed ────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_event_rsvp()
RETURNS TRIGGER AS $$
DECLARE
  organiser_id  uuid;
  event_name    text;
  guardian_name text;
  rsvp_label    text;
BEGIN
  SELECT guardian_id, name INTO organiser_id, event_name
  FROM events WHERE id = NEW.event_id;

  -- Don't notify if the organiser RSVPs their own event
  IF organiser_id = NEW.guardian_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO guardian_name FROM guardians WHERE id = NEW.guardian_id;

  rsvp_label := CASE NEW.rsvp
    WHEN 'going'      THEN 'is going to'
    WHEN 'interested' THEN 'is interested in'
    ELSE 'updated their RSVP for'
  END;

  -- Replace any existing RSVP notification from this guardian for this event
  DELETE FROM notifications
  WHERE guardian_id = organiser_id
    AND ref_id = NEW.event_id
    AND type = 'event_rsvp'
    AND source_guardian_id = NEW.guardian_id;

  INSERT INTO notifications (guardian_id, type, message, ref_id, source_guardian_id)
  VALUES (
    organiser_id,
    'event_rsvp',
    COALESCE(guardian_name, 'A guardian') || ' ' || rsvp_label || ' "' || COALESCE(event_name, 'your event') || '"',
    NEW.event_id,
    NEW.guardian_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_rsvp ON event_participants;
CREATE TRIGGER trg_event_rsvp
  AFTER INSERT OR UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION notify_event_rsvp();

-- ── 5. Trigger: RSVP removed (unselected) ────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_event_rsvp_removed()
RETURNS TRIGGER AS $$
DECLARE
  organiser_id  uuid;
  event_name    text;
  guardian_name text;
BEGIN
  SELECT guardian_id, name INTO organiser_id, event_name
  FROM events WHERE id = OLD.event_id;

  IF organiser_id = OLD.guardian_id THEN
    RETURN OLD;
  END IF;

  SELECT full_name INTO guardian_name FROM guardians WHERE id = OLD.guardian_id;

  -- Replace previous RSVP notification with a "withdrew" notification
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

DROP TRIGGER IF EXISTS trg_event_rsvp_removed ON event_participants;
CREATE TRIGGER trg_event_rsvp_removed
  AFTER DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION notify_event_rsvp_removed();
