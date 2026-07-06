-- ── schedule_templates: recurring weekly entries per user ──────────────────
CREATE TABLE schedule_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id  uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sun … 6 = Sat
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  emoji        text NOT NULL DEFAULT '📅',
  valid_from   date NOT NULL DEFAULT current_date,
  valid_until  date NOT NULL,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT end_after_start   CHECK (end_time > start_time),
  CONSTRAINT valid_date_range  CHECK (valid_until >= valid_from),
  CONSTRAINT max_3_months      CHECK (valid_until <= valid_from + interval '3 months')
);

-- ── schedule_events: one-off additions or cancellations ────────────────────
CREATE TABLE schedule_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id     uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_date      date NOT NULL,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  emoji           text NOT NULL DEFAULT '📅',
  is_cancellation boolean NOT NULL DEFAULT false,
  template_id     uuid REFERENCES schedule_templates(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

CREATE INDEX idx_schedule_templates_user_dow ON schedule_templates(user_id, day_of_week);
CREATE INDEX idx_schedule_events_user_date   ON schedule_events(user_id, event_date);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_events    ENABLE ROW LEVEL SECURITY;

-- Guardians manage their own rows
CREATE POLICY "guardian_owns_templates" ON schedule_templates
  USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "guardian_owns_events" ON schedule_events
  USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

-- Users read their own schedule
CREATE POLICY "user_reads_templates" ON schedule_templates
  FOR SELECT USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "user_reads_events" ON schedule_events
  FOR SELECT USING (
    user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );

-- ── RPCs ──────────────────────────────────────────────────────────────────

-- Guardian: fetch all templates for one user
CREATE OR REPLACE FUNCTION get_guardian_templates(p_guardian_id uuid, p_user_id uuid)
RETURNS TABLE(
  id uuid, day_of_week smallint,
  start_time time, end_time time,
  title text, emoji text,
  valid_from date, valid_until date
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, day_of_week, start_time, end_time, title, emoji, valid_from, valid_until
  FROM schedule_templates
  WHERE guardian_id = p_guardian_id AND user_id = p_user_id
  ORDER BY day_of_week, start_time;
$$;

-- Guardian: insert or update a template
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
    SET day_of_week = p_day_of_week,
        start_time  = p_start_time, end_time   = p_end_time,
        title       = p_title,      emoji      = p_emoji,
        valid_from  = p_valid_from, valid_until = p_valid_until
    WHERE id = p_template_id AND guardian_id = p_guardian_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO schedule_templates
      (guardian_id, user_id, day_of_week, start_time, end_time, title, emoji, valid_from, valid_until)
    VALUES
      (p_guardian_id, p_user_id, p_day_of_week, p_start_time, p_end_time, p_title, p_emoji, p_valid_from, p_valid_until)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

-- Guardian: delete a template
CREATE OR REPLACE FUNCTION delete_schedule_template(p_guardian_id uuid, p_template_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM schedule_templates WHERE id = p_template_id AND guardian_id = p_guardian_id;
$$;

-- Guardian: fetch future one-off events for one user
CREATE OR REPLACE FUNCTION get_schedule_events(p_guardian_id uuid, p_user_id uuid)
RETURNS TABLE(
  id uuid, event_date date,
  start_time time, end_time time,
  title text, emoji text,
  is_cancellation boolean, template_id uuid
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, event_date, start_time, end_time, title, emoji, is_cancellation, template_id
  FROM schedule_events
  WHERE guardian_id = p_guardian_id AND user_id = p_user_id
    AND event_date >= current_date
  ORDER BY event_date, start_time;
$$;

-- Guardian: add a one-off event or cancellation
CREATE OR REPLACE FUNCTION add_schedule_event(
  p_guardian_id     uuid, p_user_id         uuid,
  p_event_date      date,
  p_start_time      time, p_end_time        time,
  p_title           text, p_emoji           text,
  p_is_cancellation boolean,
  p_template_id     uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO schedule_events
    (guardian_id, user_id, event_date, start_time, end_time, title, emoji, is_cancellation, template_id)
  VALUES
    (p_guardian_id, p_user_id, p_event_date, p_start_time, p_end_time, p_title, p_emoji, p_is_cancellation, p_template_id)
  RETURNING id;
$$;

-- Guardian: delete a one-off event
CREATE OR REPLACE FUNCTION delete_schedule_event(p_guardian_id uuid, p_event_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM schedule_events WHERE id = p_event_id AND guardian_id = p_guardian_id;
$$;

-- User: today's schedule — templates + one-offs, cancellations applied
CREATE OR REPLACE FUNCTION get_user_schedule_today(p_user_id uuid)
RETURNS TABLE(id uuid, title text, emoji text, start_time time, end_time time)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today date     := current_date;
  v_dow   smallint := EXTRACT(DOW FROM current_date)::smallint;
BEGIN
  RETURN QUERY
    SELECT t.id, t.title, t.emoji, t.start_time, t.end_time
    FROM schedule_templates t
    WHERE t.user_id      = p_user_id
      AND t.day_of_week  = v_dow
      AND t.valid_from  <= v_today
      AND t.valid_until >= v_today
      AND NOT EXISTS (
        SELECT 1 FROM schedule_events e
        WHERE e.user_id         = p_user_id
          AND e.event_date      = v_today
          AND e.is_cancellation = true
          AND e.template_id     = t.id
      )
  UNION ALL
    SELECT e.id, e.title, e.emoji, e.start_time, e.end_time
    FROM schedule_events e
    WHERE e.user_id         = p_user_id
      AND e.event_date      = v_today
      AND e.is_cancellation = false
  ORDER BY start_time;
END; $$;
