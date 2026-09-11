-- Allows a learner session to verify their guardian's PIN by guardian_id.
-- SECURITY DEFINER so the caller doesn't need direct access to the guardians table.
CREATE OR REPLACE FUNCTION verify_guardian_pin_for_learner(guardian_id_input UUID, pin_input TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash FROM guardians WHERE id = guardian_id_input;
  IF stored_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_hash = crypt(pin_input, stored_hash);
END;
$$;
