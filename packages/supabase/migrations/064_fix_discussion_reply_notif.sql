-- Fix: include replier's name in discussion reply notification message
CREATE OR REPLACE FUNCTION notify_discussion_reply()
RETURNS TRIGGER AS $$
DECLARE
  post_guardian_id uuid;
  post_title       text;
  replier_name     text;
BEGIN
  SELECT guardian_id, title INTO post_guardian_id, post_title
  FROM discussion_posts WHERE id = NEW.post_id;

  IF NEW.guardian_id = post_guardian_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO replier_name FROM guardians WHERE id = NEW.guardian_id;

  INSERT INTO notifications (guardian_id, type, message, ref_id)
  VALUES (
    post_guardian_id,
    'discussion_reply',
    COALESCE(replier_name, 'Someone') || ' replied to your post "' || COALESCE(post_title, 'your post') || '"',
    NEW.post_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
