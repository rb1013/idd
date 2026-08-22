-- Migration 032: Guardian PIN for tile-picker authentication

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE guardians ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Set a hashed PIN for the authenticated guardian
CREATE OR REPLACE FUNCTION set_guardian_pin(pin_input TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE guardians SET pin_hash = crypt(pin_input, gen_salt('bf', 8)) WHERE id = auth.uid();
END;
$$;

-- Verify the PIN for the authenticated guardian; returns true if correct
CREATE OR REPLACE FUNCTION verify_guardian_pin(pin_input TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash FROM guardians WHERE id = auth.uid();
  IF stored_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_hash = crypt(pin_input, stored_hash);
END;
$$;
