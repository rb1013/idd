-- tutorials.created_by (a bare auth.users FK, distinct from the actively-used
-- created_by_guardian_id) was defined with no ON DELETE action back in
-- 001_initial_schema.sql, defaulting to NO ACTION — this silently blocks deleting
-- an auth.users row (guardian account deletion) if it's ever populated.
--
-- It turns out nothing in the app ever reads or writes this column — admin uploads
-- don't set it, guardian-created tutorials use created_by_guardian_id instead. It's
-- dead schema left over from before created_by_guardian_id existed. Drop it outright
-- rather than just patching its FK.
ALTER TABLE tutorials DROP COLUMN IF EXISTS created_by;
