-- Guardian age/consent verification happens client-side (DOB is entered and
-- checked locally, never persisted) before account creation can begin — this
-- flag just records that a guardian passed that gate.
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS is_verified_guardian boolean NOT NULL DEFAULT false;
