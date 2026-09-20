-- ── Extend notification_type enum ────────────────────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'tutorial_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'tutorial_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'discussion_reply';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'connection_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'connection_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'connection_rejected';

-- ── Make user_id nullable (guardian notifs don't always relate to a learner) ─
ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;

-- ── Add ref_id for deep-linking to the related entity ────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id uuid;

-- ── Grant UPDATE so guardians can mark their own notifications read ───────────
GRANT UPDATE ON public.notifications TO authenticated;

CREATE POLICY "Guardian updates own notifications" ON notifications
  FOR UPDATE USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

-- ── Trigger 1: tutorial approved / rejected ───────────────────────────────────
CREATE OR REPLACE FUNCTION notify_tutorial_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (guardian_id, type, message, ref_id)
    VALUES (
      NEW.created_by_guardian_id,
      CASE WHEN NEW.status = 'approved' THEN 'tutorial_approved' ELSE 'tutorial_rejected' END::notification_type,
      CASE WHEN NEW.status = 'approved'
        THEN 'Your tutorial "' || COALESCE(NEW.display_name, NEW.title, 'Tutorial') || '" has been approved'
        ELSE 'Your tutorial "' || COALESCE(NEW.display_name, NEW.title, 'Tutorial') || '" was not approved'
      END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tutorial_status_change ON tutorials;
CREATE TRIGGER trg_tutorial_status_change
  AFTER UPDATE ON tutorials
  FOR EACH ROW EXECUTE FUNCTION notify_tutorial_status_change();

-- ── Trigger 2: reply to a guardian's discussion post ─────────────────────────
CREATE OR REPLACE FUNCTION notify_discussion_reply()
RETURNS TRIGGER AS $$
DECLARE
  post_guardian_id uuid;
  post_title       text;
BEGIN
  SELECT guardian_id, title INTO post_guardian_id, post_title
  FROM discussion_posts WHERE id = NEW.post_id;

  -- Don't notify if the author is replying to their own post
  IF NEW.guardian_id = post_guardian_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (guardian_id, type, message, ref_id)
  VALUES (
    post_guardian_id,
    'discussion_reply',
    'Someone replied to your post "' || COALESCE(post_title, 'your post') || '"',
    NEW.post_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_discussion_reply ON discussion_replies;
CREATE TRIGGER trg_discussion_reply
  AFTER INSERT ON discussion_replies
  FOR EACH ROW EXECUTE FUNCTION notify_discussion_reply();

-- ── Trigger 3: new connection request received ────────────────────────────────
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

  INSERT INTO notifications (guardian_id, type, message, ref_id)
  VALUES (
    NEW.addressee_id,
    'connection_request',
    COALESCE(requester_name, 'A guardian') || ' sent you a connection request',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_connection_request ON guardian_connections;
CREATE TRIGGER trg_connection_request
  AFTER INSERT ON guardian_connections
  FOR EACH ROW EXECUTE FUNCTION notify_connection_request();

-- ── Trigger 4: connection accepted / rejected ─────────────────────────────────
CREATE OR REPLACE FUNCTION notify_connection_status_change()
RETURNS TRIGGER AS $$
DECLARE
  addressee_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'rejected') THEN
    SELECT full_name INTO addressee_name FROM guardians WHERE id = NEW.addressee_id;

    INSERT INTO notifications (guardian_id, type, message, ref_id)
    VALUES (
      NEW.requester_id,
      CASE WHEN NEW.status = 'accepted' THEN 'connection_accepted' ELSE 'connection_rejected' END::notification_type,
      CASE WHEN NEW.status = 'accepted'
        THEN COALESCE(addressee_name, 'A guardian') || ' accepted your connection request'
        ELSE COALESCE(addressee_name, 'A guardian') || ' declined your connection request'
      END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_connection_status_change ON guardian_connections;
CREATE TRIGGER trg_connection_status_change
  AFTER UPDATE ON guardian_connections
  FOR EACH ROW EXECUTE FUNCTION notify_connection_status_change();
