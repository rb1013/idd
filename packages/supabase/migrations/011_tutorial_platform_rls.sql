-- 011_tutorial_platform_rls.sql
-- RLS policies and grants for tables created in 010_tutorial_platform.sql

-- ─── GRANTS ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_frames          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tutorials            TO authenticated;
GRANT SELECT                          ON public.guardian_tutorial_quota  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_jobs             TO authenticated;

-- ─── tutorial_frames ─────────────────────────────────────────────────────────
-- Authenticated users can read frames whose tutorial is approved
-- OR belongs to the guardian (so guardian can see their own in-progress frames)
CREATE POLICY "Read frames of accessible tutorials" ON tutorial_frames
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tutorials t
      WHERE t.id = tutorial_frames.tutorial_id
        AND (
          t.status = 'approved'
          OR t.created_by_guardian_id = auth.uid()
          OR is_admin()
        )
    )
  );

-- Only the owning guardian (or service role via edge functions) can edit frames
CREATE POLICY "Guardian can update own tutorial frames" ON tutorial_frames
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tutorials t
      WHERE t.id = tutorial_frames.tutorial_id
        AND t.created_by_guardian_id = auth.uid()
        AND t.status IN ('preview', 'rejected')
    )
  );

-- ─── tutorials (additional policies for guardian self-service) ─────────────
-- Existing policies in 002: SELECT for all authenticated, ALL for admins.
-- We add guardian management on top (Postgres ORs policies together).

-- Guardians can see all their own tutorials regardless of status
CREATE POLICY "Guardian can read own tutorials" ON tutorials
  FOR SELECT USING (created_by_guardian_id = auth.uid());

-- Guardians can update their own tutorials (submit for review, withdraw, edit metadata)
CREATE POLICY "Guardian can update own tutorials" ON tutorials
  FOR UPDATE USING (created_by_guardian_id = auth.uid());

-- Guardians can delete their own tutorials
CREATE POLICY "Guardian can delete own tutorials" ON tutorials
  FOR DELETE USING (created_by_guardian_id = auth.uid());

-- ─── user_tutorials ──────────────────────────────────────────────────────────
-- Guardian can fully manage tutorial links for users they own
CREATE POLICY "Guardian can manage tutorial links for own users" ON user_tutorials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = user_tutorials.user_id
        AND user_profiles.guardian_id = auth.uid()
    )
  );

-- IDD user can read their own tutorial links
CREATE POLICY "IDD user can read own tutorial links" ON user_tutorials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = user_tutorials.user_id
        AND user_profiles.auth_user_id = auth.uid()
    )
  );

-- ─── guardian_tutorial_quota ─────────────────────────────────────────────────
-- Guardians read their own quota; writes come from service role (edge functions only)
CREATE POLICY "Guardian can read own quota" ON guardian_tutorial_quota
  FOR SELECT USING (guardian_id = auth.uid());

-- ─── tutorial_jobs ───────────────────────────────────────────────────────────
-- No client access — all reads/writes go through edge functions (service role key)
-- The "deny all" policy lets RLS block clients while service role bypasses it.
CREATE POLICY "No direct client access to tutorial_jobs" ON tutorial_jobs
  FOR ALL USING (false);
