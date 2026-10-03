-- get_user_schedule_today previously computed "today" via the database's own
-- current_date / now(), which runs in UTC on Supabase — meaning anyone in a
-- timezone behind UTC (e.g. US Pacific) could have the DB silently treat
-- evening hours as "tomorrow", returning an empty schedule and hiding classes
-- that genuinely start later today for the learner.
--
-- Fix: the client now computes its own local calendar date and passes it in,
-- so "today" always means today in the learner's own timezone, not the
-- database's.

DROP FUNCTION IF EXISTS get_user_schedule_today(uuid);

CREATE OR REPLACE FUNCTION get_user_schedule_today(p_user_id uuid, p_today date)
RETURNS TABLE(id uuid, title text, emoji text, start_time time, end_time time)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dow smallint := EXTRACT(DOW FROM p_today)::smallint;
BEGIN
  RETURN QUERY
    SELECT t.id, t.title, t.emoji, t.start_time, t.end_time
    FROM schedule_templates t
    WHERE t.user_id      = p_user_id
      AND t.day_of_week  = v_dow
      AND t.valid_from  <= p_today
      AND t.valid_until >= p_today
      AND NOT EXISTS (
        SELECT 1 FROM schedule_events e
        WHERE e.user_id         = p_user_id
          AND e.event_date      = p_today
          AND e.is_cancellation = true
          AND e.template_id     = t.id
      )
  UNION ALL
    SELECT e.id, e.title, e.emoji, e.start_time, e.end_time
    FROM schedule_events e
    WHERE e.user_id         = p_user_id
      AND e.event_date      = p_today
      AND e.is_cancellation = false
  ORDER BY start_time;
END; $$;
