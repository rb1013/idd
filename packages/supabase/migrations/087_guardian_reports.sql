-- 087_guardian_reports.sql
-- Guardian-filed reports for: guardian chat, discussion posts/replies, events, guardian profiles.
-- (Learner chat keeps using the existing `reports` table — untouched here.)
--
-- Design (docs/apple-review-checklist.md → "Report: agreed design"):
--   • One table per area. reason / status are text + CHECK (not enums).
--   • A content SNAPSHOT is copied at report time — reported content may later be edited or
--     deleted (and account deletion cascades everything), so IDs alone could point to nothing.
--   • Links to reported content use ON DELETE SET NULL, so reports survive deletions.
--   • A BEFORE INSERT trigger fills reported_by / reported_guardian_id / snapshot from the real
--     records (never trusted from the app), rejects self-reports, and checks the target exists.
--   • One report per guardian per item (partial unique indexes) → duplicate = "Already Reported"
--     in the app (unique_violation, SQLSTATE 23505).
--   • RLS: guardians can only INSERT their own reports (no read/update/delete);
--     admins can read and update (Mark resolved).
--   • resolved_at / resolved_by are set automatically when an admin changes status
--     (used later by the resolved-report purge job).
--
-- Errors raised for the app (message text): NOT_AUTHENTICATED, NOT_A_GUARDIAN, TARGET_REQUIRED,
-- TARGET_NOT_FOUND, NOT_A_PARTICIPANT, SELF_REPORT.

-- ═══════════════════════════════════════════════════════════════════════════
-- Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS guardian_chat_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by_guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  reported_guardian_id    uuid REFERENCES guardians(id) ON DELETE SET NULL,
  conversation_id         uuid REFERENCES guardian_conversations(id) ON DELETE SET NULL,
  reason                  text NOT NULL CHECK (reason IN ('offensive', 'spam', 'harassment', 'sensitive')),
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  message_snapshot        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- last ~20 messages
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  resolved_by             uuid REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS discussion_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by_guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  reported_guardian_id    uuid REFERENCES guardians(id) ON DELETE SET NULL,
  target_type             text NOT NULL CHECK (target_type IN ('post', 'reply')),
  -- Exactly one of these is set at insert time (post report → post_id, reply report → reply_id).
  -- A reply report deliberately does NOT link the post (the post title is in the snapshot), so
  -- deleting a reply can never clash with the post's duplicate rule.
  post_id                 uuid REFERENCES discussion_posts(id) ON DELETE SET NULL,
  reply_id                uuid REFERENCES discussion_replies(id) ON DELETE SET NULL,
  reason                  text NOT NULL CHECK (reason IN ('offensive', 'spam', 'harassment', 'sensitive')),
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  content_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- post: title + body; reply: content + post title
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  resolved_by             uuid REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by_guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  reported_guardian_id    uuid REFERENCES guardians(id) ON DELETE SET NULL,   -- the host
  event_id                uuid REFERENCES events(id) ON DELETE SET NULL,
  reason                  text NOT NULL CHECK (reason IN ('offensive', 'spam', 'harassment', 'sensitive')),
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  content_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- name, duration, venue, description
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  resolved_by             uuid REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS guardian_profile_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by_guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  reported_guardian_id    uuid REFERENCES guardians(id) ON DELETE SET NULL,   -- the reported profile
  reason                  text NOT NULL CHECK (reason IN ('offensive', 'spam', 'harassment', 'sensitive')),
  status                  text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  content_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- name + photo URL only (county/tags are dropdowns)
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  resolved_by             uuid REFERENCES admins(id) ON DELETE SET NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- One report per guardian per item (only while both ends still exist)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS guardian_chat_reports_once
  ON guardian_chat_reports (reported_by_guardian_id, conversation_id)
  WHERE reported_by_guardian_id IS NOT NULL AND conversation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discussion_reports_post_once
  ON discussion_reports (reported_by_guardian_id, post_id)
  WHERE reported_by_guardian_id IS NOT NULL AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discussion_reports_reply_once
  ON discussion_reports (reported_by_guardian_id, reply_id)
  WHERE reported_by_guardian_id IS NOT NULL AND reply_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_reports_once
  ON event_reports (reported_by_guardian_id, event_id)
  WHERE reported_by_guardian_id IS NOT NULL AND event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guardian_profile_reports_once
  ON guardian_profile_reports (reported_by_guardian_id, reported_guardian_id)
  WHERE reported_by_guardian_id IS NOT NULL AND reported_guardian_id IS NOT NULL;

-- Admin lists: newest first, filtered by status
CREATE INDEX IF NOT EXISTS guardian_chat_reports_status_created    ON guardian_chat_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS discussion_reports_status_created       ON discussion_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS event_reports_status_created            ON event_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_profile_reports_status_created ON guardian_profile_reports (status, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Shared: who is reporting? (must be a logged-in guardian)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION report_reporter_guardian_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guardians WHERE id = v_uid) THEN
    RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v_uid;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT triggers: fill reporter / reported guardian / snapshot from real records
-- ═══════════════════════════════════════════════════════════════════════════

-- Guardian chat: report the OTHER guardian in a conversation the reporter belongs to
CREATE OR REPLACE FUNCTION guardian_chat_reports_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter uuid := report_reporter_guardian_id();
  v_other    uuid;
BEGIN
  IF NEW.conversation_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guardian_conversation_participants
    WHERE conversation_id = NEW.conversation_id AND guardian_id = v_reporter
  ) THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT guardian_id INTO v_other
  FROM guardian_conversation_participants
  WHERE conversation_id = NEW.conversation_id AND guardian_id <> v_reporter
  LIMIT 1;
  IF v_other IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'check_violation';
  END IF;

  NEW.reported_by_guardian_id := v_reporter;
  NEW.reported_guardian_id    := v_other;
  NEW.message_snapshot := COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'sender_id', m.sender_id, 'content', m.content, 'created_at', m.created_at
           ) ORDER BY m.created_at)
    FROM (
      SELECT sender_id, content, created_at
      FROM guardian_messages
      WHERE conversation_id = NEW.conversation_id
      ORDER BY created_at DESC
      LIMIT 20
    ) m
  ), '[]'::jsonb);
  NEW.status := 'open'; NEW.resolved_at := NULL; NEW.resolved_by := NULL;
  RETURN NEW;
END;
$$;

-- Discussions: a post (post_id) or a reply (reply_id)
CREATE OR REPLACE FUNCTION discussion_reports_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter uuid := report_reporter_guardian_id();
  v_author   uuid;
  v_title    text;
  v_body     text;
  v_content  text;
  v_post_id  uuid;
BEGIN
  IF NEW.reply_id IS NOT NULL THEN
    SELECT r.guardian_id, r.content, r.post_id, p.title
      INTO v_author, v_content, v_post_id, v_title
    FROM discussion_replies r
    JOIN discussion_posts p ON p.id = r.post_id
    WHERE r.id = NEW.reply_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'check_violation';
    END IF;
    NEW.target_type := 'reply';
    NEW.post_id := NULL;   -- see table comment: reply reports don't link the post
    NEW.content_snapshot := jsonb_build_object('content', v_content, 'post_id', v_post_id, 'post_title', v_title);

  ELSIF NEW.post_id IS NOT NULL THEN
    SELECT guardian_id, title, body INTO v_author, v_title, v_body
    FROM discussion_posts WHERE id = NEW.post_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'check_violation';
    END IF;
    NEW.target_type := 'post';
    NEW.content_snapshot := jsonb_build_object('title', v_title, 'body', v_body);

  ELSE
    RAISE EXCEPTION 'TARGET_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  IF v_author = v_reporter THEN
    RAISE EXCEPTION 'SELF_REPORT' USING ERRCODE = 'check_violation';
  END IF;

  NEW.reported_by_guardian_id := v_reporter;
  NEW.reported_guardian_id    := v_author;
  NEW.status := 'open'; NEW.resolved_at := NULL; NEW.resolved_by := NULL;
  RETURN NEW;
END;
$$;

-- Events: report the event; the host is the reported guardian
CREATE OR REPLACE FUNCTION event_reports_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter uuid := report_reporter_guardian_id();
  v_event    events%ROWTYPE;
BEGIN
  IF NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'check_violation';
  END IF;
  IF v_event.guardian_id = v_reporter THEN
    RAISE EXCEPTION 'SELF_REPORT' USING ERRCODE = 'check_violation';
  END IF;

  NEW.reported_by_guardian_id := v_reporter;
  NEW.reported_guardian_id    := v_event.guardian_id;
  NEW.content_snapshot := jsonb_build_object(
    'name', v_event.name, 'duration', v_event.duration,
    'venue', v_event.venue, 'description', v_event.description
  );
  NEW.status := 'open'; NEW.resolved_at := NULL; NEW.resolved_by := NULL;
  RETURN NEW;
END;
$$;

-- Guardian profiles: the app sends reported_guardian_id (the profile being reported)
CREATE OR REPLACE FUNCTION guardian_profile_reports_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter uuid := report_reporter_guardian_id();
  v_name     text;
  v_photo    text;
BEGIN
  IF NEW.reported_guardian_id IS NULL THEN
    RAISE EXCEPTION 'TARGET_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.reported_guardian_id = v_reporter THEN
    RAISE EXCEPTION 'SELF_REPORT' USING ERRCODE = 'check_violation';
  END IF;
  SELECT full_name, photo_url INTO v_name, v_photo FROM guardians WHERE id = NEW.reported_guardian_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'check_violation';
  END IF;

  NEW.reported_by_guardian_id := v_reporter;
  NEW.content_snapshot := jsonb_build_object('name', v_name, 'photo_url', v_photo);
  NEW.status := 'open'; NEW.resolved_at := NULL; NEW.resolved_by := NULL;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- BEFORE UPDATE (admins): keep resolved_at / resolved_by in step with status
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION report_status_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolved_at := now();
    NEW.resolved_by := auth.uid();
  ELSIF NEW.status = 'open' THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Attach triggers
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS guardian_chat_reports_fill ON guardian_chat_reports;
CREATE TRIGGER guardian_chat_reports_fill BEFORE INSERT ON guardian_chat_reports
  FOR EACH ROW EXECUTE FUNCTION guardian_chat_reports_before_insert();

DROP TRIGGER IF EXISTS discussion_reports_fill ON discussion_reports;
CREATE TRIGGER discussion_reports_fill BEFORE INSERT ON discussion_reports
  FOR EACH ROW EXECUTE FUNCTION discussion_reports_before_insert();

DROP TRIGGER IF EXISTS event_reports_fill ON event_reports;
CREATE TRIGGER event_reports_fill BEFORE INSERT ON event_reports
  FOR EACH ROW EXECUTE FUNCTION event_reports_before_insert();

DROP TRIGGER IF EXISTS guardian_profile_reports_fill ON guardian_profile_reports;
CREATE TRIGGER guardian_profile_reports_fill BEFORE INSERT ON guardian_profile_reports
  FOR EACH ROW EXECUTE FUNCTION guardian_profile_reports_before_insert();

DROP TRIGGER IF EXISTS guardian_chat_reports_status ON guardian_chat_reports;
CREATE TRIGGER guardian_chat_reports_status BEFORE UPDATE OF status ON guardian_chat_reports
  FOR EACH ROW EXECUTE FUNCTION report_status_before_update();

DROP TRIGGER IF EXISTS discussion_reports_status ON discussion_reports;
CREATE TRIGGER discussion_reports_status BEFORE UPDATE OF status ON discussion_reports
  FOR EACH ROW EXECUTE FUNCTION report_status_before_update();

DROP TRIGGER IF EXISTS event_reports_status ON event_reports;
CREATE TRIGGER event_reports_status BEFORE UPDATE OF status ON event_reports
  FOR EACH ROW EXECUTE FUNCTION report_status_before_update();

DROP TRIGGER IF EXISTS guardian_profile_reports_status ON guardian_profile_reports;
CREATE TRIGGER guardian_profile_reports_status BEFORE UPDATE OF status ON guardian_profile_reports
  FOR EACH ROW EXECUTE FUNCTION report_status_before_update();

-- Trigger/helper functions are not callable through the API
REVOKE EXECUTE ON FUNCTION report_reporter_guardian_id()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guardian_chat_reports_before_insert()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION discussion_reports_before_insert()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION event_reports_before_insert()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guardian_profile_reports_before_insert()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION report_status_before_update()             FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--   Guardians: INSERT their own reports only (no SELECT/UPDATE/DELETE).
--   Admins:    SELECT + UPDATE (Mark resolved).
--   NOTE for the app: insert WITHOUT `.select()` — guardians can't read reports back.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE guardian_chat_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_profile_reports ENABLE ROW LEVEL SECURITY;

-- Guardian insert (reported_by_guardian_id is set by the trigger, which runs before this check)
CREATE POLICY "Guardians file own guardian chat reports" ON guardian_chat_reports
  FOR INSERT TO authenticated WITH CHECK (reported_by_guardian_id = auth.uid());
CREATE POLICY "Guardians file own discussion reports" ON discussion_reports
  FOR INSERT TO authenticated WITH CHECK (reported_by_guardian_id = auth.uid());
CREATE POLICY "Guardians file own event reports" ON event_reports
  FOR INSERT TO authenticated WITH CHECK (reported_by_guardian_id = auth.uid());
CREATE POLICY "Guardians file own guardian profile reports" ON guardian_profile_reports
  FOR INSERT TO authenticated WITH CHECK (reported_by_guardian_id = auth.uid());

-- Admin read
CREATE POLICY "Admins read guardian chat reports" ON guardian_chat_reports
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins read discussion reports" ON discussion_reports
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins read event reports" ON event_reports
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins read guardian profile reports" ON guardian_profile_reports
  FOR SELECT TO authenticated USING (is_admin());

-- Admin update (Mark resolved / reopen)
CREATE POLICY "Admins update guardian chat reports" ON guardian_chat_reports
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins update discussion reports" ON discussion_reports
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins update event reports" ON event_reports
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins update guardian profile reports" ON guardian_profile_reports
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

GRANT INSERT, SELECT, UPDATE ON guardian_chat_reports    TO authenticated;
GRANT INSERT, SELECT, UPDATE ON discussion_reports       TO authenticated;
GRANT INSERT, SELECT, UPDATE ON event_reports            TO authenticated;
GRANT INSERT, SELECT, UPDATE ON guardian_profile_reports TO authenticated;
