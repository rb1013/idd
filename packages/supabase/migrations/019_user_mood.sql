-- Current mood emoji set by the user, displayed on their avatar everywhere
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_mood TEXT;
