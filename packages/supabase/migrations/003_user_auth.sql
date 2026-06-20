-- Add user login fields to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Users can read their own profile
CREATE POLICY "Users can read own profile via auth" ON user_profiles
  FOR SELECT USING (auth_user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile via auth" ON user_profiles
  FOR UPDATE USING (auth_user_id = auth.uid());
