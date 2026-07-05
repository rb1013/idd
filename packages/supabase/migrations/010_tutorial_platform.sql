-- 010_tutorial_platform.sql
-- Extends tutorials table and creates supporting tables for AI tutorial generation

-- Extend existing tutorials table (admin-uploaded rows default to status: approved, source: admin_upload)
ALTER TABLE tutorials
  ADD COLUMN IF NOT EXISTS format                 text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS topic                  text,
  ADD COLUMN IF NOT EXISTS category_id            uuid REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS comprehension_level    text NOT NULL DEFAULT 'easy',
  ADD COLUMN IF NOT EXISTS duration_seconds       int,
  ADD COLUMN IF NOT EXISTS status                 text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS ai_prompt              text,
  ADD COLUMN IF NOT EXISTS created_by_guardian_id uuid REFERENCES guardians(id),
  ADD COLUMN IF NOT EXISTS link_count             int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source                 text NOT NULL DEFAULT 'admin_upload',
  ADD COLUMN IF NOT EXISTS admin_notes            text,
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz DEFAULT now();

-- Slideshow / card content frames
CREATE TABLE IF NOT EXISTS tutorial_frames (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutorial_id uuid NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  order_index int  NOT NULL,
  caption     text,
  tts_text    text,
  image_url   text,
  audio_url   text
);

-- Link approved tutorials to a specific IDD user's learning page
CREATE TABLE IF NOT EXISTS user_tutorials (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tutorial_id          uuid NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  added_by_guardian_id uuid REFERENCES guardians(id),
  added_at             timestamptz DEFAULT now(),
  completed_at         timestamptz,
  UNIQUE (user_id, tutorial_id)
);

-- Monthly quota: max 10 AI tutorials per guardian per month
CREATE TABLE IF NOT EXISTS guardian_tutorial_quota (
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  month       text NOT NULL, -- YYYY-MM
  count       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (guardian_id, month)
);

-- Async job queue for AI generation (DB Webhook fires process-tutorial-job Edge Function)
CREATE TABLE IF NOT EXISTS tutorial_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutorial_id uuid NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  error       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- link_count maintenance: increment when a tutorial is linked to a user
CREATE OR REPLACE FUNCTION increment_tutorial_link_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tutorials SET link_count = link_count + 1 WHERE id = NEW.tutorial_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_tutorial_link_count_up
  AFTER INSERT ON user_tutorials
  FOR EACH ROW EXECUTE FUNCTION increment_tutorial_link_count();

CREATE OR REPLACE FUNCTION decrement_tutorial_link_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tutorials SET link_count = GREATEST(0, link_count - 1) WHERE id = OLD.tutorial_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER trg_tutorial_link_count_down
  AFTER DELETE ON user_tutorials
  FOR EACH ROW EXECUTE FUNCTION decrement_tutorial_link_count();
