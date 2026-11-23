-- 094_aac_phrases.sql
-- "Say hello" phrases on the learner chat board, moved from the app's code (PHRASE_SYMBOLS in
-- apps/mobile/src/lib/aacSymbols.ts) into the database so admins can add, edit, reorder and hide
-- them without an app release. Each phrase is an emoji + a short label shown on the board, and the
-- text sent as the chat message (plain text, so no image hosting is involved).
--
-- Seeded with the 10 phrases currently hard-coded in the app, in the same order.

CREATE TABLE IF NOT EXISTS aac_phrases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji       text NOT NULL,
  label       text NOT NULL,            -- shown under the emoji, and read aloud
  phrase      text NOT NULL,            -- sent as the message
  sort_order  int  NOT NULL DEFAULT 0,  -- board order (ascending)
  is_active   boolean NOT NULL DEFAULT true,   -- hidden from the board when false (old messages unaffected)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()  -- lets the app tell when its cached list is stale
);

CREATE INDEX IF NOT EXISTS aac_phrases_active_order_idx ON aac_phrases (is_active, sort_order);

-- Keep updated_at current on every edit
CREATE OR REPLACE FUNCTION aac_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aac_phrases_set_updated_at ON aac_phrases;
CREATE TRIGGER aac_phrases_set_updated_at
  BEFORE UPDATE ON aac_phrases
  FOR EACH ROW EXECUTE FUNCTION aac_set_updated_at();

-- ── Access: any signed-in user (guardian or learner) reads; only admins change ──
ALTER TABLE aac_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read AAC phrases" ON aac_phrases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage AAC phrases" ON aac_phrases
  FOR ALL TO authenticated
  USING ((select is_admin())) WITH CHECK ((select is_admin()));

-- New tables get no default data grants in this project (see 092), so grant explicitly.
-- RLS above limits writes to admins. No edge function uses this table, so no service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON aac_phrases TO authenticated;

-- ── Seed: the 10 phrases currently in the app (only into an empty table, so re-running is safe) ──
INSERT INTO aac_phrases (emoji, label, phrase, sort_order)
SELECT * FROM (VALUES
  ('👋', 'Hello!',        'Hello! 👋',            1),
  ('🌅', 'Good morning',  'Good morning! 🌅',     2),
  ('🌙', 'Good night',    'Good night! 🌙',       3),
  ('🙂', 'How are you?',  'How are you? 🙂',      4),
  ('😊', 'I''m fine!',    'I''m fine! 😊',        5),
  ('🤝', 'Nice to meet',  'Nice to meet you! 🤝', 6),
  ('🎉', 'That''s great!','That''s great! 🎉',    7),
  ('🥺', 'I miss you',    'I miss you 🥺',        8),
  ('❤️', 'I love you',    'I love you ❤️',        9),
  ('😂', 'So funny!',     'That is so funny! 😂', 10)
) AS seed(emoji, label, phrase, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM aac_phrases);
