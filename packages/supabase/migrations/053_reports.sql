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

CREATE POLICY "service_role_all_reports" ON reports
  USING (true) WITH CHECK (true);
