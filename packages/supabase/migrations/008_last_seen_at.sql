-- Add last_seen_at to user_profiles so we can show online/offline status
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
