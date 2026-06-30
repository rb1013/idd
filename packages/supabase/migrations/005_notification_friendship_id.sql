-- Add friendship_id to notifications so guardians can act on friend requests
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS friendship_id UUID REFERENCES friendships(id) ON DELETE SET NULL;

-- Update trigger to include friendship_id
DROP TRIGGER IF EXISTS friendship_notification_trigger ON friendships;

CREATE OR REPLACE FUNCTION notify_guardian_on_friendship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  requester_guardian_id uuid;
  addressee_guardian_id uuid;
  requester_name text;
  addressee_name text;
BEGIN
  SELECT guardian_id, name INTO requester_guardian_id, requester_name
    FROM user_profiles WHERE id = NEW.requester_id;

  SELECT guardian_id, name INTO addressee_guardian_id, addressee_name
    FROM user_profiles WHERE id = NEW.addressee_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify addressee's guardian (actionable — can accept/reject)
    INSERT INTO notifications (guardian_id, user_id, type, message, friendship_id)
    VALUES (
      addressee_guardian_id,
      NEW.addressee_id,
      'friend_request',
      addressee_name || ' received a friendship request from ' || requester_name,
      NEW.id
    );
    -- Notify requester's guardian (informational)
    INSERT INTO notifications (guardian_id, user_id, type, message, friendship_id)
    VALUES (
      requester_guardian_id,
      NEW.requester_id,
      'friend_request',
      requester_name || ' sent a friend request to ' || addressee_name,
      NEW.id
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (guardian_id, user_id, type, message, friendship_id)
    VALUES (
      requester_guardian_id,
      NEW.requester_id,
      'friend_request',
      addressee_name || ' accepted ' || requester_name || '''s friend request',
      NEW.id
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (guardian_id, user_id, type, message, friendship_id)
    VALUES (
      requester_guardian_id,
      NEW.requester_id,
      'friend_request',
      addressee_name || ' declined ' || requester_name || '''s friend request',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER friendship_notification_trigger
  AFTER INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_guardian_on_friendship();
