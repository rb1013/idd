-- Recreate link_count trigger functions as SECURITY DEFINER so they bypass RLS.
-- The guardian inserting/deleting from user_tutorials may not own the linked tutorial,
-- so the default SECURITY INVOKER context fails the "Guardian can update own tutorials" RLS policy.

CREATE OR REPLACE FUNCTION increment_tutorial_link_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE tutorials SET link_count = link_count + 1 WHERE id = NEW.tutorial_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_tutorial_link_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE tutorials SET link_count = GREATEST(0, link_count - 1) WHERE id = OLD.tutorial_id;
  RETURN OLD;
END;
$$;
