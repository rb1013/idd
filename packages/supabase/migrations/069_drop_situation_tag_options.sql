-- "Situation Tags" and "Medical Conditions" were two separate admin-managed vocabularies
-- describing the same concept (a learner's specific needs/medical conditions). They are
-- now merged: medical_conditions is the single shared vocabulary for both the guardian's
-- self-selected "Learner Situation" (guardians.situation_tags, unchanged) and the
-- learner-scoped user_medical_conditions join table (unchanged).
--
-- situation_tag_options is no longer read by any screen (mobile or admin) — everything
-- now fetches its option list from medical_conditions instead. Safe to drop.
DROP TABLE IF EXISTS situation_tag_options;
