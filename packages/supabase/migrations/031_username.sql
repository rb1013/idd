-- Migration 031: Add username to user_profiles

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_username_key UNIQUE (username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (username);
