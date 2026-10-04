-- City (free text) replaced by county (fixed dropdown of California's 58
-- counties, client-side list in constants/caCounties.ts) — the app is
-- California-only, so county is a more reliable, typo-free way to group
-- "nearby families" than free-text city ever was.
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE guardians DROP COLUMN IF EXISTS city;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS city;
