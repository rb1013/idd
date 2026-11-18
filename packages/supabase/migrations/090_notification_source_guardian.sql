-- 090_notification_source_guardian.sql
-- Record WHO caused a notification (notifications.source_guardian_id) for:
--   • discussion replies           — notify_discussion_reply()            (was 064)
--   • connection requests          — notify_connection_request()          (was 063)
--   • connection accepted/declined — notify_connection_status_change()    (was 063)
--
-- Why: migration 088 hides notifications caused by a blocked guardian (both ways) using
-- source_guardian_id. RSVP notifications already set it; these three didn't, so after a block
-- an earlier "B replied to your post" / "B sent you a connection request" / "A accepted your
-- connection request" stayed visible. With the source recorded, the existing block rule hides them.
--
-- Going forward only: notifications created before this migration are not backfilled.
-- Each function is unchanged apart from the extra source_guardian_id column.

-- ── Discussion reply (same as 064_fix_discussion_reply_notif.sql + source) ──────
CREATE OR REPLACE FUNCTION notify_discussion_reply()
RETURNS TRIGGER AS $$
DECLARE
  post_guardian_id uuid;
  post_title       text;
  replier_name     text;
BEGIN
  SELECT guardian_id, title INTO post_guardian_id, post_title
  FROM discussion_posts WHERE id = NEW.post_id;

  IF NEW.guardian_id = post_guardian_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO replier_name FROM guardians WHERE id = NEW.guardian_id;

  INSERT INTO notifications (guardian_id, type, message, ref_id, source_guardian_id)
  VALUES (
    post_guardian_id,
    'discussion_reply',
    COALESCE(replier_name, 'Someone') || ' replied to your post "' || COALESCE(post_title, 'your post') || '"',
    NEW.post_id,
    NEW.guardian_id            -- the replier
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── New connection request (same as 063_guardian_notifications.sql + source) ────
CREATE OR REPLACE FUNCTION notify_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_name text;
BEGIN
  -- Only fire on new pending requests (not auto-accepted learner-linked ones)
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO requester_name FROM guardians WHERE id = NEW.requester_id;

  INSERT INTO notifications (guardian_id, type, message, ref_id, source_guardian_id)
  VALUES (
    NEW.addressee_id,
    'connection_request',
    COALESCE(requester_name, 'A guardian') || ' sent you a connection request',
    NEW.id,
    NEW.requester_id           -- the guardian who sent the request
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Connection accepted / declined (same as 063_guardian_notifications.sql + source) ──
CREATE OR REPLACE FUNCTION notify_connection_status_change()
RETURNS TRIGGER AS $$
DECLARE
  addressee_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'rejected') THEN
    SELECT full_name INTO addressee_name FROM guardians WHERE id = NEW.addressee_id;

    INSERT INTO notifications (guardian_id, type, message, ref_id, source_guardian_id)
    VALUES (
      NEW.requester_id,
      CASE WHEN NEW.status = 'accepted' THEN 'connection_accepted' ELSE 'connection_rejected' END::notification_type,
      CASE WHEN NEW.status = 'accepted'
        THEN COALESCE(addressee_name, 'A guardian') || ' accepted your connection request'
        ELSE COALESCE(addressee_name, 'A guardian') || ' declined your connection request'
      END,
      NEW.id,
      NEW.addressee_id         -- the guardian who accepted / declined
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
