-- Trigger function: notify guardian when a friend request is sent or accepted
create or replace function notify_guardian_on_friendship()
returns trigger language plpgsql security definer as $$
declare
  requester_guardian_id uuid;
  addressee_guardian_id uuid;
  requester_name text;
  addressee_name text;
begin
  select guardian_id, name into requester_guardian_id, requester_name
    from user_profiles where id = NEW.requester_id;

  select guardian_id, name into addressee_guardian_id, addressee_name
    from user_profiles where id = NEW.addressee_id;

  if TG_OP = 'INSERT' then
    -- Notify addressee's guardian
    insert into notifications (guardian_id, user_id, type, message)
    values (
      addressee_guardian_id,
      NEW.addressee_id,
      'friend_request',
      addressee_name || ' received a friendship request from ' || requester_name
    );
    -- Notify requester's guardian
    insert into notifications (guardian_id, user_id, type, message)
    values (
      requester_guardian_id,
      NEW.requester_id,
      'friend_request',
      requester_name || ' sent a friend request to ' || addressee_name
    );

  elsif TG_OP = 'UPDATE' and NEW.status = 'accepted' and OLD.status = 'pending' then
    -- Request accepted: notify requester's guardian
    insert into notifications (guardian_id, user_id, type, message)
    values (
      requester_guardian_id,
      NEW.requester_id,
      'friend_request',
      addressee_name || ' accepted ' || requester_name || '''s friend request'
    );
  end if;

  return NEW;
end;
$$;

create trigger friendship_notification_trigger
  after insert or update on friendships
  for each row execute function notify_guardian_on_friendship();
