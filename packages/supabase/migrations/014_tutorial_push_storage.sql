-- 014_tutorial_push_storage.sql
-- Adds expo_push_token to guardians for push notifications,
-- and creates Supabase Storage buckets for AI-generated tutorial assets.

-- Push token column so approve/reject edge functions can notify the guardian
ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS expo_push_token text;

-- ─── Storage buckets ─────────────────────────────────────────────────────────

-- Public bucket for DALL·E 3 generated frame images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-images',
  'tutorial-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public bucket for OpenAI TTS-1 generated audio narration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-audio',
  'tutorial-audio',
  true,
  5242880, -- 5 MB
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage policies ────────────────────────────────────────────────────────
-- Service role (edge functions) bypasses RLS for writes.
-- Authenticated users (and public) can read these assets.

CREATE POLICY "Tutorial images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorial-images');

CREATE POLICY "Tutorial audio is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorial-audio');
