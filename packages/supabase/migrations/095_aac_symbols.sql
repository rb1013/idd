-- 095_aac_symbols.sql
-- Picture symbols on the learner chat board, moved from the app's code (SYMBOL_DEFINITIONS in
-- apps/mobile/src/lib/aacSymbols.ts, which searched OpenSymbols live on each device) into the
-- database + our own Storage, so:
--   - every learner sees the same reviewed images (no surprise or odd matches from a live search),
--   - the app no longer contacts OpenSymbols,
--   - admins can add, edit, reorder and hide symbols without an app release.
--
-- Images live in the public Storage bucket 'aac-symbols' (created below). The 25 seed images are in
-- packages/supabase/seed/aac-symbols/ and are UPLOADED MANUALLY once (Storage → aac-symbols, same
-- file names). image_path below = the file name in the bucket.
-- All 25 are ARASAAC pictograms (CC BY-NC-SA) — see seed/aac-symbols/README.md and docs/credits.md.

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Public: the board and chat messages load symbols by public URL (messages carry the image URL).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aac-symbols',
  'aac-symbols',
  true,
  1048576,   -- 1 MB per image (symbols are ~10–35 KB)
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "AAC symbols are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'aac-symbols');

CREATE POLICY "Admins upload AAC symbols"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aac-symbols' AND (select is_admin()));

CREATE POLICY "Admins replace AAC symbols"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'aac-symbols' AND (select is_admin()))
  WITH CHECK (bucket_id = 'aac-symbols' AND (select is_admin()));

CREATE POLICY "Admins delete AAC symbols"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'aac-symbols' AND (select is_admin()));

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aac_symbols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL UNIQUE,     -- stable id, e.g. 'thank_you'
  label           text NOT NULL,            -- shown under the picture, and read aloud
  image_path      text NOT NULL,            -- file name in the 'aac-symbols' bucket
  source_library  text,                     -- for credits, e.g. 'ARASAAC'
  license         text,                     -- e.g. 'CC BY-NC-SA'
  author          text,                     -- e.g. 'Sergio Palao / Government of Aragón'
  sort_order      int  NOT NULL DEFAULT 0,  -- board order (ascending)
  is_active       boolean NOT NULL DEFAULT true,   -- hidden from the board when false (old messages still show)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()  -- lets the app tell when its cached list is stale
);

CREATE INDEX IF NOT EXISTS aac_symbols_active_order_idx ON aac_symbols (is_active, sort_order);

-- aac_set_updated_at() is defined in 094_aac_phrases.sql
DROP TRIGGER IF EXISTS aac_symbols_set_updated_at ON aac_symbols;
CREATE TRIGGER aac_symbols_set_updated_at
  BEFORE UPDATE ON aac_symbols
  FOR EACH ROW EXECUTE FUNCTION aac_set_updated_at();

-- ── Access: any signed-in user (guardian or learner) reads; only admins change ──
ALTER TABLE aac_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read AAC symbols" ON aac_symbols
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage AAC symbols" ON aac_symbols
  FOR ALL TO authenticated
  USING ((select is_admin())) WITH CHECK ((select is_admin()));

-- New tables get no default data grants in this project (see 092), so grant explicitly.
-- RLS above limits writes to admins. No edge function uses this table, so no service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON aac_symbols TO authenticated;

-- ── Seed: the 25 symbols, same words and order as the app today (5 images re-picked) ──
-- Only into an empty table, so re-running is safe.
INSERT INTO aac_symbols (key, label, image_path, source_library, license, author, sort_order)
SELECT key, label, key || '.png', 'ARASAAC', 'CC BY-NC-SA', 'Sergio Palao / Government of Aragón', sort_order
FROM (VALUES
  ('hello',     'Hello',      1),
  ('goodbye',   'Goodbye',    2),
  ('happy',     'Happy',      3),
  ('sad',       'Sad',        4),
  ('tired',     'Tired',      5),
  ('angry',     'Angry',      6),
  ('yes',       'Yes',        7),
  ('no',        'No',         8),
  ('help',      'Help',       9),
  ('thank_you', 'Thank you', 10),
  ('hug',       'Hug',       11),
  ('love',      'Love',      12),
  ('hungry',    'Hungry',    13),
  ('play',      'Play',      14),
  ('wait',      'Wait',      15),
  ('bathroom',  'Bathroom',  16),
  ('water',     'Water',     17),
  ('eat',       'Eat',       18),
  ('drink',     'Drink',     19),
  ('sleep',     'Sleep',     20),
  ('more',      'More',      21),
  ('stop',      'Stop',      22),
  ('please',    'Please',    23),
  ('sorry',     'Sorry',     24),
  ('friend',    'Friend',    25)
) AS seed(key, label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM aac_symbols);
