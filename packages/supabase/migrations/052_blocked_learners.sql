CREATE TABLE IF NOT EXISTS blocked_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blocked_learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blocked_by_guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (learner_id, blocked_learner_id)
);

ALTER TABLE blocked_learners ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by edge functions)
CREATE POLICY "service_role_all_blocked_learners" ON blocked_learners
  USING (true) WITH CHECK (true);

-- Table-level grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_learners TO service_role;
GRANT SELECT, DELETE ON public.blocked_learners TO authenticated;

-- Guardian: read blocked records for their own learners
CREATE POLICY "guardian_select_blocked_learners" ON blocked_learners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = blocked_learners.learner_id
      AND guardian_id = auth.uid()
    )
  );

-- Guardian: delete (unblock) records for their own learners
CREATE POLICY "guardian_delete_blocked_learners" ON blocked_learners
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = blocked_learners.learner_id
      AND guardian_id = auth.uid()
    )
  );

-- Learner: read records where they are involved (for friends list filtering)
-- Uses auth_user_id subquery because user_profiles.id != auth.uid()
CREATE POLICY "learner_select_blocked_learners" ON blocked_learners
  FOR SELECT USING (
    learner_id         = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
    OR blocked_learner_id = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
  );
