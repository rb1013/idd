CREATE TABLE IF NOT EXISTS blocked_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES guardians(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE blocked_words ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write
CREATE POLICY "service_role_all" ON blocked_words
  USING (true)
  WITH CHECK (true);
