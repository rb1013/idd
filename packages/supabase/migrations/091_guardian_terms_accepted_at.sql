-- 091_guardian_terms_accepted_at.sql
-- When the guardian agreed to the Privacy Policy & Terms of Service at sign-up
-- (PrivacyConsentScreen → "Agree"). Set when the guardian row is created after email
-- verification (lib/AuthContext.tsx). NULL for guardians who signed up before this existed.
--
-- ⚠️ Apply BEFORE shipping the app build that writes it — the app's guardian insert includes
-- this column, so without it new sign-ups would fail.

ALTER TABLE guardians ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
