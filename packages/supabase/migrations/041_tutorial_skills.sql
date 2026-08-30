CREATE TABLE tutorial_skills (
  id         uuid primary key default uuid_generate_v4(),
  label      text not null unique,
  created_at timestamptz default now()
);

-- Seed with existing hardcoded values
INSERT INTO tutorial_skills (label) VALUES
  ('Speech & Communication'),
  ('Motor Skills'),
  ('Daily Living'),
  ('Social Skills'),
  ('Numeracy & Literacy'),
  ('Emotional Regulation');

ALTER TABLE tutorial_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_tutorial_skills"
  ON tutorial_skills FOR SELECT USING (true);

CREATE POLICY "admin_write_tutorial_skills"
  ON tutorial_skills FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON tutorial_skills TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tutorial_skills TO authenticated;
