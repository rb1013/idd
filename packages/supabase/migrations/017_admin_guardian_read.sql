-- Admins need to read guardian profiles for the tutorial moderation panel
CREATE POLICY "Admins can read guardians" ON guardians
  FOR SELECT USING (is_admin());
