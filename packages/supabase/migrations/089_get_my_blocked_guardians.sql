-- 089_get_my_blocked_guardians.sql
-- For the Connections → Blocked tab (docs/guardian-block.md, task 3.7).
--
-- Migration 088 hides blocked guardians' profiles from the blocker (guardians table RLS), so the
-- app can't read their name/photo for the Blocked list with a normal query. This function returns
-- ONLY the caller's own blocks, with just what the list shows. It never reveals who blocked you.

CREATE OR REPLACE FUNCTION public.get_my_blocked_guardians()
RETURNS TABLE (guardian_id uuid, full_name text, photo_url text, county text, blocked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.full_name, g.photo_url, g.county, b.created_at
  FROM guardian_blocks b
  JOIN guardians g ON g.id = b.blocked_guardian_id
  WHERE b.blocker_guardian_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_blocked_guardians() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_blocked_guardians() TO authenticated;
