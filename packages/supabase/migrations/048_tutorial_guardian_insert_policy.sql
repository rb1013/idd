-- 048_tutorial_guardian_insert_policy.sql
-- Allow guardians to insert their own tutorials directly from the client.
-- Needed for YouTube-linked tutorials which bypass the create-tutorial edge function.

CREATE POLICY "Guardian can insert own tutorials" ON tutorials
  FOR INSERT WITH CHECK (created_by_guardian_id = auth.uid());
