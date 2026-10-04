-- Learner "medical condition" and "health info" features removed entirely
-- (profile picker, display, and Find-tab filtering all pulled from the app).
-- `medical_conditions` (the lookup table) is NOT touched — it's still the
-- shared options source for the guardian's own "Regional Support Category"
-- tag (guardians.situation_tags), per migration 069.
DROP TABLE IF EXISTS user_medical_conditions;
DROP TABLE IF EXISTS health_info;
