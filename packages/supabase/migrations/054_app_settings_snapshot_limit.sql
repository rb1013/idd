ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS report_snapshot_limit INTEGER NOT NULL DEFAULT 20;

UPDATE app_settings SET report_snapshot_limit = 20 WHERE id = 1;
