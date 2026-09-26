-- notify_event_rsvp() / notify_event_rsvp_removed() (068_event_rsvp_notifications.sql)
-- fire on event_participants INSERT/UPDATE/DELETE — including when those rows are
-- cascade-deleted as a side effect of deleting a guardian's account (either because
-- the guardian being deleted was a participant, or because they organised the event
-- and their event's participant rows cascade away with it).
--
-- In both of those cascade cases, either the acting guardian's row or the event's
-- organiser's row is already gone by the time the trigger runs, so the INSERT INTO
-- notifications fails: either notifications_source_guardian_id_fkey (acting guardian
-- gone) or the guardian_id NOT NULL constraint (organiser gone, so organiser_id is
-- NULL). A notification about an RSVP is meaningless once either party's account is
-- being deleted anyway, so just skip sending it in that case.

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

  -- Event (and its organiser) already gone, or organiser RSVPing their own event
  IF organiser_id IS NULL OR organiser_id = NEW.guardian_id THEN
    RETURN NEW;
  END IF;

  -- Acting guardian's own account is mid-deletion — nothing to notify about
  IF NOT EXISTS (SELECT 1 FROM guardians WHERE id = NEW.guardian_id) THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO guardian_name FROM guardians WHERE id = NEW.guardian_id;

  rsvp_label := CASE NEW.rsvp
    WHEN 'going'      THEN 'is going to'
    WHEN 'interested' THEN 'is interested in'
    ELSE 'updated their RSVP for'
  END;

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

CREATE OR REPLACE FUNCTION notify_event_rsvp_removed()
RETURNS TRIGGER AS $$
DECLARE
  organiser_id  uuid;
  event_name    text;
  guardian_name text;
BEGIN
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
