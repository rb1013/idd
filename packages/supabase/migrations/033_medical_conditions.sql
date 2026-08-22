-- Admin-managed list of medical conditions guardians can select for their learner
CREATE TABLE IF NOT EXISTS medical_conditions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medical_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_medical_conditions"
  ON medical_conditions FOR SELECT
  USING (true);

CREATE POLICY "admin_write_medical_conditions"
  ON medical_conditions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT ON medical_conditions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_conditions TO authenticated;

-- Per-learner selected medical conditions (private — only guardian/admin can read)
CREATE TABLE IF NOT EXISTS user_medical_conditions (
  user_id              uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  medical_condition_id uuid NOT NULL REFERENCES medical_conditions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, medical_condition_id)
);

ALTER TABLE user_medical_conditions ENABLE ROW LEVEL SECURITY;

-- Guardian can read/write their own learner's data
CREATE POLICY "guardian_manage_user_medical_conditions"
  ON user_medical_conditions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_id
        AND up.guardian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = user_id
        AND up.guardian_id = auth.uid()
    )
  );

CREATE POLICY "admin_manage_user_medical_conditions"
  ON user_medical_conditions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON user_medical_conditions TO authenticated;
