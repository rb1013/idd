-- Replace age (int) with date_of_birth on user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE user_profiles ALTER COLUMN age DROP NOT NULL;
