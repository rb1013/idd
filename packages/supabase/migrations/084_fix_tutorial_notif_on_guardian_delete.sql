-- notify_tutorial_status_change() (063_guardian_notifications.sql) inserts into
-- notifications with guardian_id = NEW.created_by_guardian_id. notifications.guardian_id
-- is NOT NULL, but tutorials.created_by_guardian_id becomes NULL once the creating
-- guardian deletes their account (057_fix_guardian_fk_on_delete.sql: ON DELETE SET NULL).
-- That makes the trigger's INSERT violate the not-null constraint, which rolls back
-- the whole UPDATE — permanently blocking approve/reject on any orphaned tutorial.
-- Fix: skip the notification (there's no guardian left to notify) instead of failing.

CREATE OR REPLACE FUNCTION notify_tutorial_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.created_by_guardian_id IS NOT NULL THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
