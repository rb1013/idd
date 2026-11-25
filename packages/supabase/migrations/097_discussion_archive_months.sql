-- Discussions list (mobile) loads only the last N months; older discussions are "archived"
-- (not deleted — just not loaded). Set by admins on the App Settings page. Default 3.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS discussion_archive_months integer NOT NULL DEFAULT 3
    CHECK (discussion_archive_months > 0);
