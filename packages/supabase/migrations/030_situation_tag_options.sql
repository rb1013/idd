-- Admin-managed list of predefined situation tags that guardians can pick from
CREATE TABLE IF NOT EXISTS situation_tag_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public read so the mobile app can fetch without auth overhead
ALTER TABLE situation_tag_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_situation_tags"
  ON situation_tag_options FOR SELECT
  USING (true);

-- Only admins can write (same pattern as categories/tutorials)
CREATE POLICY "admin_write_situation_tags"
  ON situation_tag_options FOR ALL
  USING (is_admin());
