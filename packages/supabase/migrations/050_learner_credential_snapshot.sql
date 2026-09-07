-- Stores base64-encoded learner Supabase credentials so any guardian device
-- can fetch and cache them locally, enabling cross-device biometric login.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credential_snapshot TEXT;
