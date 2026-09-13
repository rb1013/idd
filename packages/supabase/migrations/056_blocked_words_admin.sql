-- Change added_by from guardians → admins
ALTER TABLE blocked_words DROP COLUMN IF EXISTS added_by;
ALTER TABLE blocked_words ADD COLUMN added_by UUID REFERENCES admins(id) ON DELETE SET NULL;

-- Fix RLS: drop the overly-permissive blanket policy
DROP POLICY IF EXISTS "service_role_all" ON blocked_words;

-- Admins can do everything (service_role bypasses RLS automatically for edge functions)
CREATE POLICY "admin_all_blocked_words" ON blocked_words
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Grant table-level access (required before RLS even applies)
GRANT SELECT, INSERT, DELETE ON blocked_words TO authenticated;
-- service_role bypasses RLS but still needs the GRANT to read rows in edge functions
GRANT SELECT ON blocked_words TO service_role;
