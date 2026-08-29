-- Allow authenticated guardians to read other guardians' public profile fields
-- needed for the My Connections discovery screen
CREATE POLICY "Guardians can discover other guardians"
  ON guardians
  FOR SELECT
  USING (auth.role() = 'authenticated');
