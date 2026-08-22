-- Allow any authenticated user to read user_medical_conditions for find-friends filtering.
-- Same pattern as "Authenticated users can read likes" on user_likes.
-- Medical conditions are NOT shown on public profiles (enforced at app layer).
CREATE POLICY "authenticated_read_user_medical_conditions"
  ON user_medical_conditions FOR SELECT
  USING (auth.role() = 'authenticated');
