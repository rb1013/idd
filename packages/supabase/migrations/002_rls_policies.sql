-- Grant table-level privileges to roles (RLS still enforces row-level rules)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.guardians to authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_likes to authenticated;
grant select, insert, update, delete on public.user_dislikes to authenticated;
grant select, insert, update, delete on public.user_abilities to authenticated;
grant select, insert, update, delete on public.chat_preferences to authenticated;
grant select, insert, update, delete on public.health_info to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.guardian_notification_settings to authenticated;
grant select, insert on public.notifications to authenticated;
grant select on public.tutorials to authenticated;
grant select on public.categories to authenticated;
grant select on public.admins to authenticated;

-- Enable RLS on all tables
alter table guardians enable row level security;
alter table user_profiles enable row level security;
alter table user_likes enable row level security;
alter table user_dislikes enable row level security;
alter table user_abilities enable row level security;
alter table chat_preferences enable row level security;
alter table health_info enable row level security;
alter table friendships enable row level security;
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table guardian_notification_settings enable row level security;
alter table notifications enable row level security;
alter table tutorials enable row level security;
alter table admins enable row level security;
alter table categories enable row level security;

-- Helper: check if current user is an admin
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

-- Helper: check if current user (guardian) owns a user_profile
create or replace function owns_user_profile(profile_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from user_profiles
    where id = profile_id and guardian_id = auth.uid()
  );
$$;

-- ─── GUARDIANS ────────────────────────────────────────────────────────────────
create policy "Guardians can read own record" on guardians
  for select using (id = auth.uid());

create policy "Guardians can insert own record" on guardians
  for insert with check (id = auth.uid());

create policy "Guardians can update own record" on guardians
  for update using (id = auth.uid());

-- ─── CATEGORIES (public read) ─────────────────────────────────────────────────
create policy "Anyone can read categories" on categories
  for select using (true);

create policy "Admins can manage categories" on categories
  for all using (is_admin());

-- ─── USER PROFILES ────────────────────────────────────────────────────────────
create policy "Guardians can manage own users" on user_profiles
  for all using (guardian_id = auth.uid());

create policy "Authenticated users can read profiles" on user_profiles
  for select using (auth.role() = 'authenticated');

-- ─── USER LIKES / DISLIKES / ABILITIES ───────────────────────────────────────
create policy "Guardian manages likes" on user_likes
  for all using (owns_user_profile(user_id));

create policy "Authenticated users can read likes" on user_likes
  for select using (auth.role() = 'authenticated');

create policy "Guardian manages dislikes" on user_dislikes
  for all using (owns_user_profile(user_id));

create policy "Guardian manages abilities" on user_abilities
  for all using (owns_user_profile(user_id));

create policy "Authenticated users can read abilities" on user_abilities
  for select using (auth.role() = 'authenticated');

-- ─── CHAT PREFERENCES ────────────────────────────────────────────────────────
create policy "Guardian manages chat prefs" on chat_preferences
  for all using (owns_user_profile(user_id));

create policy "Authenticated can read chat prefs" on chat_preferences
  for select using (auth.role() = 'authenticated');

-- ─── HEALTH INFO ─────────────────────────────────────────────────────────────
create policy "Guardian manages health info" on health_info
  for all using (owns_user_profile(user_id));

-- ─── FRIENDSHIPS ─────────────────────────────────────────────────────────────
create policy "Users can see their friendships" on friendships
  for select using (
    owns_user_profile(requester_id) or owns_user_profile(addressee_id)
  );

create policy "Users can send friend requests" on friendships
  for insert with check (owns_user_profile(requester_id));

create policy "Addressee can update friendship status" on friendships
  for update using (owns_user_profile(addressee_id));

-- ─── CONVERSATIONS ───────────────────────────────────────────────────────────
create policy "Participants can read conversations" on conversations
  for select using (
    exists (
      select 1 from conversation_participants cp
      join user_profiles up on up.id = cp.user_id
      where cp.conversation_id = conversations.id
        and up.guardian_id = auth.uid()
    )
  );

create policy "Authenticated can create conversations" on conversations
  for insert with check (auth.role() = 'authenticated');

-- ─── CONVERSATION PARTICIPANTS ───────────────────────────────────────────────
create policy "Participants can read" on conversation_participants
  for select using (
    exists (
      select 1 from user_profiles where id = user_id and guardian_id = auth.uid()
    )
  );

create policy "Authenticated can insert participants" on conversation_participants
  for insert with check (auth.role() = 'authenticated');

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
create policy "Participants can read messages" on messages
  for select using (
    exists (
      select 1 from conversation_participants cp
      join user_profiles up on up.id = cp.user_id
      where cp.conversation_id = messages.conversation_id
        and up.guardian_id = auth.uid()
    )
  );

create policy "Participants can send messages" on messages
  for insert with check (owns_user_profile(sender_id));

-- ─── GUARDIAN NOTIFICATION SETTINGS ──────────────────────────────────────────
create policy "Guardian manages own notif settings" on guardian_notification_settings
  for all using (guardian_id = auth.uid());

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create policy "Guardian reads own notifications" on notifications
  for select using (guardian_id = auth.uid());

create policy "System inserts notifications" on notifications
  for insert with check (true);

-- ─── TUTORIALS (public read) ──────────────────────────────────────────────────
create policy "Authenticated can read tutorials" on tutorials
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage tutorials" on tutorials
  for all using (is_admin());

-- ─── ADMINS ──────────────────────────────────────────────────────────────────
grant select on public.admins to authenticated;

create policy "Users can check own admin status" on admins
  for select using (id = auth.uid());

-- ─── STORAGE BUCKETS ─────────────────────────────────────────────────────────
-- Run these in Supabase dashboard > Storage:
-- 1. Create bucket "avatars" (public: true)
-- 2. Create bucket "tutorials" (public: true)
