ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tts_disabled boolean DEFAULT false NOT NULL;
