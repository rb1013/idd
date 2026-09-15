ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS messaging_disabled boolean DEFAULT false NOT NULL;
