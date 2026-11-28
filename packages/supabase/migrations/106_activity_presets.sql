-- 106_activity_presets.sql
-- Daily activities (guardian "Activities" tile → learner "Today's Activities") move from the app's
-- code (ACTIVITY_PRESETS in apps/mobile/src/lib/activityPresets.ts) into the database, so admins can
-- add, edit, reorder and hide them without an app release. Also the max number of activities a
-- guardian can pick (MAX_ACTIVITIES = 10 in GuardianActivitiesScreen) becomes an admin setting.
--
-- ⚠️ STEP 1 of 2: table + admin page only. The app still uses its hard-coded list and max until the
-- app code is changed to read these (planned separately) — editing here has no effect in the app yet.
--
-- `key` is what guardian_activities.preset_key stores, so it never changes once created (the admin
-- page sets it from the name when adding). No foreign key yet: the app's own list is still the source
-- of truth for guardians' selections. The max is not enforced in the database (app-side only).
--
-- Seeded with the 18 activities currently hard-coded in the app, same keys / order / colours.

CREATE TABLE IF NOT EXISTS activity_presets (
  key         text PRIMARY KEY,                 -- e.g. 'brush_teeth' (stored in guardian_activities.preset_key)
  emoji       text NOT NULL,
  name        text NOT NULL,                    -- shown on the tile
  color       text NOT NULL DEFAULT '#4A90E2',  -- accent colour (hex)
  bg_color    text NOT NULL DEFAULT '#EBF4FF',  -- tile background (hex)
  sort_order  int  NOT NULL DEFAULT 0,          -- grid order (ascending)
  is_active   boolean NOT NULL DEFAULT true,    -- hidden from the guardian's grid when false
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (key ~ '^[a-z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS activity_presets_active_order_idx ON activity_presets (is_active, sort_order);

-- Keep updated_at current on every edit (same generic trigger function as the AAC tables, 094)
DROP TRIGGER IF EXISTS activity_presets_set_updated_at ON activity_presets;
CREATE TRIGGER activity_presets_set_updated_at
  BEFORE UPDATE ON activity_presets
  FOR EACH ROW EXECUTE FUNCTION aac_set_updated_at();

-- ── Access: any signed-in user (guardian or learner) reads; only admins change ──
ALTER TABLE activity_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users read activity presets" ON activity_presets;
CREATE POLICY "Signed-in users read activity presets" ON activity_presets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage activity presets" ON activity_presets;
CREATE POLICY "Admins manage activity presets" ON activity_presets
  FOR ALL TO authenticated
  USING ((select is_admin())) WITH CHECK ((select is_admin()));

-- New tables get no default data grants in this project (see 092), so grant explicitly.
-- RLS above limits writes to admins. No edge function uses this table, so no service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_presets TO authenticated;

-- ── Seed: the 18 activities currently in the app (only into an empty table, so re-running is safe) ──
INSERT INTO activity_presets (key, emoji, name, color, bg_color, sort_order)
SELECT * FROM (VALUES
  ('brush_teeth',   '🪥',  'Brush Teeth',   '#4A90E2', '#EBF4FF',  1),
  ('shower',        '🚿',  'Take a Shower', '#5CBB7A', '#EDFBF2',  2),
  ('get_dressed',   '👗',  'Get Dressed',   '#9B59B6', '#F5EEFF',  3),
  ('eat_breakfast', '🍳',  'Eat Breakfast', '#F5A623', '#FFF8ED',  4),
  ('take_medicine', '💊',  'Take Medicine', '#E53E3E', '#FFF0F0',  5),
  ('go_for_walk',   '🚶',  'Go for a Walk', '#1ABC9C', '#E8FDFB',  6),
  ('make_bed',      '🛏️', 'Make Bed',      '#E91E8C', '#FFF0F8',  7),
  ('read_book',     '📚',  'Read a Book',   '#2563EB', '#EFF6FF',  8),
  ('tidy_room',     '🧹',  'Tidy Room',     '#7C3AED', '#F3EEFF',  9),
  ('eat_lunch',     '🥗',  'Eat Lunch',     '#16A34A', '#F0FDF4', 10),
  ('eat_dinner',    '🍲',  'Eat Dinner',    '#D97706', '#FFFBEB', 11),
  ('drink_water',   '💧',  'Drink Water',   '#0891B2', '#ECFEFF', 12),
  ('art_craft',     '🎨',  'Art & Craft',   '#DC2626', '#FFF1F2', 13),
  ('music_time',    '🎵',  'Music Time',    '#9B59B6', '#F5EEFF', 14),
  ('calm_time',     '🧘',  'Calm Time',     '#4A90E2', '#EBF4FF', 15),
  ('feed_pet',      '🐕',  'Feed Pet',      '#F5A623', '#FFF8ED', 16),
  ('wash_hands',    '🧴',  'Wash Hands',    '#5CBB7A', '#EDFBF2', 17),
  ('rest_nap',      '😴',  'Rest / Nap',    '#E91E8C', '#FFF0F8', 18)
) AS seed(key, emoji, name, color, bg_color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM activity_presets);

-- ── Admin setting: max activities a guardian can pick (app-side limit; today hard-coded as 10) ──
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS activity_max_daily integer NOT NULL DEFAULT 10
    CHECK (activity_max_daily > 0);
