CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reported_learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reported_by_guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  reason TEXT,
  message_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by edge functions)
CREATE POLICY "service_role_all_reports" ON reports
  USING (true) WITH CHECK (true);

-- Table-level grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO service_role;
GRANT SELECT ON public.reports TO authenticated;

-- Admins can read all reports (admin portal Reports page)
CREATE POLICY "admin_select_all_reports" ON reports
  FOR SELECT USING (is_admin());

-- Learner can read their own report records (to filter reported users from friends list)
-- Uses auth_user_id subquery because user_profiles.id != auth.uid()
CREATE POLICY "learner_select_own_reports" ON reports
  FOR SELECT USING (
    learner_id = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );
