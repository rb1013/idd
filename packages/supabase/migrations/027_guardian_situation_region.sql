-- Guardian self-declared situation tags, used for guardian discovery filters
-- Location filter uses the learner's region (same household assumption)
-- region column was added by mistake in an earlier run and is dropped here

ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS situation_tags text[] NOT NULL DEFAULT '{}',
  DROP COLUMN IF EXISTS region;
