-- 101_schedule_lists_local_date.sql
-- Guardian Schedule screen lists — same local-date fix as 072 (learner's today):
--
-- • get_schedule_events (One-off tab) used current_date, which is UTC on Supabase. In California
--   UTC rolls over at 4–5 pm, so today's one-off classes / cancellations vanished from the list in
--   the late afternoon. Now the app passes its own local date (p_today).
-- • get_guardian_templates (Repeats Weekly tab) had no date filter — expired classes stayed listed
--   ("Until Dec 19" long after Dec 19). Now only classes with valid_until >= p_today are returned.
--
-- p_today defaults to current_date so an older app build (which doesn't send it) keeps working.

DROP FUNCTION IF EXISTS get_schedule_events(uuid, uuid);
CREATE OR REPLACE FUNCTION get_schedule_events(p_guardian_id uuid, p_user_id uuid, p_today date DEFAULT NULL)
RETURNS TABLE(
  id uuid, event_date date,
  start_time time, end_time time,
  title text, emoji text,
  is_cancellation boolean, template_id uuid
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, event_date, start_time, end_time, title, emoji, is_cancellation, template_id
  FROM schedule_events
  WHERE guardian_id = p_guardian_id AND user_id = p_user_id
    AND event_date >= coalesce(p_today, current_date)
  ORDER BY event_date, start_time;
$$;

DROP FUNCTION IF EXISTS get_guardian_templates(uuid, uuid);
CREATE OR REPLACE FUNCTION get_guardian_templates(p_guardian_id uuid, p_user_id uuid, p_today date DEFAULT NULL)
RETURNS TABLE(
  id uuid, day_of_week smallint,
  start_time time, end_time time,
  title text, emoji text,
  valid_from date, valid_until date
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, day_of_week, start_time, end_time, title, emoji, valid_from, valid_until
  FROM schedule_templates
  WHERE guardian_id = p_guardian_id AND user_id = p_user_id
    AND valid_until >= coalesce(p_today, current_date)   -- hide classes that have ended
  ORDER BY day_of_week, start_time;
$$;

GRANT EXECUTE ON FUNCTION get_schedule_events(uuid, uuid, date)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_guardian_templates(uuid, uuid, date) TO authenticated, service_role;
