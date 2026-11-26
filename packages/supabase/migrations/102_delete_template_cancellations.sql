-- 102_delete_template_cancellations.sql
-- Removing a weekly class also removes its One-off cancellations.
--
-- Before: delete_schedule_template deleted only the schedule_templates row; its cancellations in
-- schedule_events were kept with template_id set to NULL (FK ON DELETE SET NULL), so
-- "<class> — cancellation" rows stayed in the One-off tab for a class that no longer existed.
-- Now the cancellations go with the class. One-off classes (is_cancellation = false) aren't linked
-- to a weekly class and are untouched.
-- App message (UserScheduleScreen): "This removes the weekly class and its One-off cancellations."

CREATE OR REPLACE FUNCTION delete_schedule_template(p_guardian_id uuid, p_template_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM schedule_events
  WHERE template_id = p_template_id
    AND is_cancellation = true
    AND guardian_id = p_guardian_id;

  DELETE FROM schedule_templates
  WHERE id = p_template_id AND guardian_id = p_guardian_id;
$$;
