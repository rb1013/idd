-- ── DISCUSSIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discussion_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── EVENTS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  event_date  date NOT NULL,
  event_time  time,
  venue       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_participants (
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  rsvp        text NOT NULL DEFAULT 'going'
              CHECK (rsvp IN ('going', 'interested', 'not_going')),
  PRIMARY KEY (event_id, guardian_id)
);

-- ── GRANTS ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON discussion_posts   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON discussion_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_participants TO authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE discussion_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- discussion_posts
CREATE POLICY "Guardians can read all discussions" ON discussion_posts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Guardian can post discussion" ON discussion_posts
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Author can delete own post" ON discussion_posts
  FOR DELETE USING (guardian_id = auth.uid());

-- discussion_replies
CREATE POLICY "Guardians can read all replies" ON discussion_replies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Guardian can reply" ON discussion_replies
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Author can delete own reply" ON discussion_replies
  FOR DELETE USING (guardian_id = auth.uid());

-- events
CREATE POLICY "Guardians can read all events" ON events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Guardian can create event" ON events
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Organiser can update event" ON events
  FOR UPDATE USING (guardian_id = auth.uid());

CREATE POLICY "Organiser can delete event" ON events
  FOR DELETE USING (guardian_id = auth.uid());

-- event_participants
CREATE POLICY "Guardians can read participants" ON event_participants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Guardian can rsvp" ON event_participants
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Guardian can update own rsvp" ON event_participants
  FOR UPDATE USING (guardian_id = auth.uid());

CREATE POLICY "Guardian can remove own rsvp" ON event_participants
  FOR DELETE USING (guardian_id = auth.uid());
