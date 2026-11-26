-- 104_update_schedule_event.sql
-- Edit a one-off class (Schedule → One-off → ✏️). Rules agreed 2026-11-26:
--   • Only one-off CLASSES (is_cancellation = false). Cancellations aren't editable (delete + re-cancel).
--   • Only FUTURE one-offs: a one-off dated today (or earlier) can't be edited at all — it may already be
--     happening, and the learner's reminder for it is already scheduled. Delete + add instead.
--   • The new date must also be in the future (tomorrow or later).
-- "Today" is the phone's local date (p_today), as in 101 — the database's current_date is UTC.

CREATE OR REPLACE FUNCTION update_schedule_event(
  p_guardian_id uuid,
  p_event_id    uuid,
  p_event_date  date,
  p_start_time  time, p_end_time time,
  p_title       text,
  p_today       date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today date := coalesce(p_today, current_date);
  v_id    uuid;
BEGIN
  IF p_event_date <= v_today THEN
    RAISE EXCEPTION 'ONE_OFF_DATE_NOT_FUTURE' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE schedule_events
  SET event_date = p_event_date, start_time = p_start_time, end_time = p_end_time, title = p_title
  WHERE id = p_event_id
    AND guardian_id = p_guardian_id
    AND is_cancellation = false
    AND event_date > v_today          -- today's / past one-offs can't be edited
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ONE_OFF_NOT_EDITABLE' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION update_schedule_event(uuid, uuid, date, time, time, text, date) TO authenticated, service_role;
