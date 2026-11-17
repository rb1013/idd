-- 085_discussion_blocked_words.sql
-- Server-side blocked-words check for discussion posts (title + body) and replies (content).
--
-- Posts and replies are inserted/updated directly from the app, so the check lives in the
-- database: it runs on every write, however it arrives (app or direct API call).
--
-- Same rule as the chat edge functions (functions/_shared/blockedWords.ts):
--   whole word / whole phrase, case-insensitive; a word boundary is anything that isn't a
--   letter or digit. "ass" blocks "ass!" but not "class"; "shut up" matches as a phrase.
-- The list is the admin-managed blocked_words table (admin portal → Blocked Words).
-- The app shows "Let's use kind words" when it sees the BLOCKED_WORDS error (lib/contentFilter.ts).

-- ── Helper: does the text contain any blocked word? ─────────────────────────
-- SECURITY DEFINER so it can read blocked_words (admins-only under RLS).
CREATE OR REPLACE FUNCTION contains_blocked_word(p_text text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_text IS NOT NULL AND EXISTS (
    SELECT 1
    FROM blocked_words w
    WHERE btrim(w.word) <> ''
      AND p_text ~* (
        '(^|[^[:alnum:]])'
        -- escape regex special characters, then let spaces inside a phrase match any whitespace
        || regexp_replace(
             regexp_replace(btrim(w.word), '([.*+?^${}()|\[\]\\])', '\\\1', 'g'),
             '\s+', '\\s+', 'g')
        || '($|[^[:alnum:]])'
      )
  );
$$;

-- Not callable through the API (it would let anyone probe the blocked list); triggers only.
REVOKE EXECUTE ON FUNCTION contains_blocked_word(text) FROM PUBLIC, anon, authenticated;

-- ── Trigger: reject posts / replies that contain a blocked word ─────────────
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
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_blocked_words_discussion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS discussion_posts_blocked_words ON discussion_posts;
CREATE TRIGGER discussion_posts_blocked_words
  BEFORE INSERT OR UPDATE OF title, body ON discussion_posts
  FOR EACH ROW EXECUTE FUNCTION reject_blocked_words_discussion();

DROP TRIGGER IF EXISTS discussion_replies_blocked_words ON discussion_replies;
CREATE TRIGGER discussion_replies_blocked_words
  BEFORE INSERT OR UPDATE OF content ON discussion_replies
  FOR EACH ROW EXECUTE FUNCTION reject_blocked_words_discussion();
