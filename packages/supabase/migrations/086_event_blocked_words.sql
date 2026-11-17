-- 086_event_blocked_words.sql
-- Extends the blocked-words check from 085_discussion_blocked_words.sql to events:
-- name, description, venue and duration (all four free-text fields on Create / Edit Event).
-- Requires 085 (uses contains_blocked_word()).
--
-- Same rule as discussions and chat: whole word / phrase, case-insensitive, against the
-- admin-managed blocked_words list. On a match the write is rejected with BLOCKED_WORDS and the
-- app shows "Let's use kind words" (lib/contentFilter.ts).

-- Re-create the shared trigger function with an events branch (discussion branches unchanged)
CREATE OR REPLACE FUNCTION reject_blocked_words_discussion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'discussion_posts' THEN
    IF contains_blocked_word(NEW.title) OR contains_blocked_word(NEW.body) THEN
      RAISE EXCEPTION 'BLOCKED_WORDS' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'discussion_replies' THEN
    IF contains_blocked_word(NEW.content) THEN
      RAISE EXCEPTION 'BLOCKED_WORDS' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'events' THEN
    IF contains_blocked_word(NEW.name)
       OR contains_blocked_word(NEW.description)
       OR contains_blocked_word(NEW.venue)
       OR contains_blocked_word(NEW.duration) THEN
      RAISE EXCEPTION 'BLOCKED_WORDS' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_blocked_words_discussion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_blocked_words ON events;
CREATE TRIGGER events_blocked_words
  BEFORE INSERT OR UPDATE OF name, description, venue, duration ON events
  FOR EACH ROW EXECUTE FUNCTION reject_blocked_words_discussion();
