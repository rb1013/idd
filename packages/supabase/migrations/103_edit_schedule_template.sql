-- 103_edit_schedule_template.sql
-- Editing a weekly class (Schedule → tap a class card). Rules agreed 2026-11-26:
--   • The day of the week never changes on edit (cancellations are tied to dates on that weekday).
--     Enforced here: the update path keeps the stored day_of_week and ignores p_day_of_week.
--   • A class whose Valid from is today or earlier has its dates locked — only name and times can
--     change. Enforced in the app (the database doesn't know the phone's local "today").
--   • Changing the name or times also updates the class's One-off cancellations, which store a copy
--     of them (add_schedule_event copies title / times from the class), so the One-off tab matches.
--   • Cancellations are never deleted on edit — one outside new dates just has no effect and applies
--     again if the dates are widened (option 4b).
-- Insert path (p_template_id NULL) is unchanged.

CREATE OR REPLACE FUNCTION upsert_schedule_template(
  p_guardian_id uuid, p_user_id uuid,
  p_day_of_week smallint,
  p_start_time  time,  p_end_time   time,
  p_title       text,  p_emoji      text,
  p_valid_from  date,  p_valid_until date,
  p_template_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF p_template_id IS NOT NULL THEN
    UPDATE schedule_templates
    SET start_time  = p_start_time, end_time    = p_end_time,      -- day_of_week deliberately not updated
        title       = p_title,      emoji       = p_emoji,
        valid_from  = p_valid_from, valid_until = p_valid_until
    WHERE id = p_template_id AND guardian_id = p_guardian_id
    RETURNING id INTO v_id;

    -- Keep this class's cancellations in step (name / times only)
    IF v_id IS NOT NULL THEN
      UPDATE schedule_events
      SET title = p_title, start_time = p_start_time, end_time = p_end_time
      WHERE template_id = v_id AND is_cancellation = true AND guardian_id = p_guardian_id;
    END IF;
  ELSE
    INSERT INTO schedule_templates
      (guardian_id, user_id, day_of_week, start_time, end_time, title, emoji, valid_from, valid_until)
    VALUES
      (p_guardian_id, p_user_id, p_day_of_week, p_start_time, p_end_time, p_title, p_emoji, p_valid_from, p_valid_until)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;
