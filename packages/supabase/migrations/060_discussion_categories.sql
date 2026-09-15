CREATE TABLE IF NOT EXISTS discussion_category_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE discussion_category_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_discussion_categories"
  ON discussion_category_options FOR SELECT
  USING (true);

CREATE POLICY "admin_write_discussion_categories"
  ON discussion_category_options FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT ON discussion_category_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON discussion_category_options TO authenticated;

ALTER TABLE discussion_posts
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES discussion_category_options(id) ON DELETE SET NULL;
