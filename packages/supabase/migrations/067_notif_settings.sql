ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS notif_tutorial_window_hours integer DEFAULT 48 NOT NULL,
  ADD COLUMN IF NOT EXISTS notif_discussion_limit      integer DEFAULT 30 NOT NULL;
