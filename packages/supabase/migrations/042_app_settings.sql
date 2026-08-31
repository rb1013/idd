CREATE TABLE app_settings (
  id integer primary key default 1 check (id = 1),
  tutorial_quota_limit integer not null default 10,
  updated_at timestamptz default now()
);

INSERT INTO app_settings (id, tutorial_quota_limit) VALUES (1, 10);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_app_settings"  ON app_settings FOR SELECT USING (true);
CREATE POLICY "admin_write_app_settings"  ON app_settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON app_settings TO anon;
GRANT SELECT, UPDATE ON app_settings TO authenticated;
