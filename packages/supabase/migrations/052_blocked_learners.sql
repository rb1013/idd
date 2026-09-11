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

CREATE POLICY "service_role_all_blocked_learners" ON blocked_learners
  USING (true) WITH CHECK (true);
