-- Same class of bug as 072_schedule_today_local_date.sql: get_user_activities_today,
-- toggle_user_activity, and get_activity_report all used the database's own
-- current_date (UTC on Supabase) to decide what "today" means. For anyone in
-- a timezone behind UTC, evening hours can make the DB think it's already
-- tomorrow — so a learner could complete an activity "today" and have it
-- silently log under the wrong date, or the dashboard could fail to show
-- today's checklist/progress at all.
--
-- Fix: callers now pass their own local calendar date explicitly.

DROP FUNCTION IF EXISTS get_user_activities_today(uuid);

CREATE OR REPLACE FUNCTION get_user_activities_today(p_user_id uuid, p_today date)
RETURNS TABLE(
  activity_id  uuid,
  preset_key   text,
  sort_order   smallint,
  completed    boolean,
  completed_at timestamptz
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ga.id          AS activity_id,
    ga.preset_key,
    ga.sort_order,
    (ual.id IS NOT NULL) AS completed,
    ual.completed_at
  FROM guardian_activities ga
  JOIN user_profiles up ON up.guardian_id = ga.guardian_id
  LEFT JOIN user_activity_logs ual
    ON  ual.activity_id = ga.id
    AND ual.user_id     = p_user_id
    AND ual.log_date    = p_today
  WHERE up.id = p_user_id
  ORDER BY ga.sort_order, ga.created_at;
$$;

DROP FUNCTION IF EXISTS toggle_user_activity(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION toggle_user_activity(
  p_user_id     uuid,
  p_activity_id uuid,
  p_completed   boolean,
  p_today       date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_completed THEN
    INSERT INTO user_activity_logs(user_id, activity_id, log_date)
    VALUES (p_user_id, p_activity_id, p_today)
    ON CONFLICT (user_id, activity_id, log_date) DO NOTHING;
  ELSE
    DELETE FROM user_activity_logs
    WHERE user_id     = p_user_id
      AND activity_id = p_activity_id
      AND log_date    = p_today;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS get_activity_report(uuid);

CREATE OR REPLACE FUNCTION get_activity_report(p_guardian_id uuid, p_today date)
RETURNS TABLE(
  user_id    uuid,
  user_name  text,
  preset_key text,
  log_date   date,
  completed  boolean
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    up.id        AS user_id,
    up.name      AS user_name,
    ga.preset_key,
    d.log_date::date,
    (ual.id IS NOT NULL) AS completed
  FROM user_profiles up
  CROSS JOIN (
    SELECT generate_series(
      p_today - 6,
      p_today,
      '1 day'::interval
    )::date AS log_date
  ) d
  CROSS JOIN guardian_activities ga
  LEFT JOIN user_activity_logs ual
    ON  ual.user_id     = up.id
    AND ual.activity_id = ga.id
    AND ual.log_date    = d.log_date
  WHERE up.guardian_id  = p_guardian_id
    AND ga.guardian_id  = p_guardian_id
  ORDER BY up.name, d.log_date, ga.sort_order;
$$;
