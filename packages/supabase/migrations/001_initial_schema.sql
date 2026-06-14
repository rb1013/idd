-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── GUARDIANS ────────────────────────────────────────────────────────────────
create table guardians (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  phone       text,
  created_at  timestamptz default now()
);

-- ─── CATEGORIES (likes / dislikes / abilities) ────────────────────────────────
create type category_type as enum ('like', 'dislike', 'ability');

create table categories (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null,
  type  category_type not null,
  unique(name, type)
);

-- Seed default categories
insert into categories (name, type) values
  ('Music', 'like'), ('Sports', 'like'), ('Art', 'like'), ('Cooking', 'like'),
  ('Movies', 'like'), ('Reading', 'like'), ('Dancing', 'like'), ('Gaming', 'like'),
  ('Animals', 'like'), ('Nature', 'like'), ('Swimming', 'like'),
  ('Loud noises', 'dislike'), ('Crowds', 'dislike'), ('Spicy food', 'dislike'),
  ('Lift a table', 'ability'), ('Do basic maths', 'ability'), ('Kick a ball', 'ability'),
  ('Read simple words', 'ability'), ('Draw shapes', 'ability'), ('Count to 100', 'ability'),
  ('Ride a bicycle', 'ability'), ('Cook simple meals', 'ability');

-- ─── USER PROFILES ────────────────────────────────────────────────────────────
create table user_profiles (
  id           uuid primary key default uuid_generate_v4(),
  guardian_id  uuid not null references guardians(id) on delete cascade,
  name         text not null,
  age          int not null,
  gender       text,
  languages    text[] default '{}',
  photo_url    text,
  city         text not null,
  region       text,
  country      text,
  created_at   timestamptz default now()
);

-- ─── USER LIKES / DISLIKES / ABILITIES ───────────────────────────────────────
create table user_likes (
  user_id      uuid not null references user_profiles(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  primary key (user_id, category_id)
);

create table user_dislikes (
  user_id      uuid not null references user_profiles(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  primary key (user_id, category_id)
);

create table user_abilities (
  user_id      uuid not null references user_profiles(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  primary key (user_id, category_id)
);

-- ─── CHAT PREFERENCES ────────────────────────────────────────────────────────
create type comprehension_level as enum ('easy', 'medium', 'complex', 'fluent');

create table chat_preferences (
  user_id               uuid primary key references user_profiles(id) on delete cascade,
  open_to_online_chat   boolean default true,
  open_to_zoom          boolean default false,
  open_to_voice_chat    boolean default false,
  available_days        text[] default '{}',
  available_time_start  time,
  available_time_end    time,
  comprehension_level   comprehension_level default 'easy'
);

-- ─── HEALTH INFO ─────────────────────────────────────────────────────────────
create table health_info (
  user_id         uuid primary key references user_profiles(id) on delete cascade,
  willing_to_share boolean default false,
  description     text
);

-- ─── FRIENDSHIPS ─────────────────────────────────────────────────────────────
create type friendship_status as enum ('pending', 'accepted', 'rejected', 'blocked');

create table friendships (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references user_profiles(id) on delete cascade,
  addressee_id  uuid not null references user_profiles(id) on delete cascade,
  status        friendship_status default 'pending',
  created_at    timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- ─── CONVERSATIONS + MESSAGES ─────────────────────────────────────────────────
create table conversations (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now()
);

create table conversation_participants (
  conversation_id  uuid not null references conversations(id) on delete cascade,
  user_id          uuid not null references user_profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references user_profiles(id) on delete cascade,
  content          text not null,
  created_at       timestamptz default now(),
  read_at          timestamptz
);

-- ─── GUARDIAN NOTIFICATION SETTINGS ──────────────────────────────────────────
create table guardian_notification_settings (
  guardian_id                  uuid primary key references guardians(id) on delete cascade,
  notify_on_friend_request     boolean default true,
  notify_on_message            boolean default true,
  notify_on_profile_change     boolean default false
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create type notification_type as enum ('friend_request', 'message', 'profile_change');

create table notifications (
  id           uuid primary key default uuid_generate_v4(),
  guardian_id  uuid not null references guardians(id) on delete cascade,
  user_id      uuid not null references user_profiles(id) on delete cascade,
  type         notification_type not null,
  message      text not null,
  read         boolean default false,
  created_at   timestamptz default now()
);

-- ─── TUTORIALS ───────────────────────────────────────────────────────────────
create table tutorials (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  description    text,
  category       text not null,
  video_url      text not null,
  thumbnail_url  text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz default now()
);

-- ─── ADMINS ──────────────────────────────────────────────────────────────────
create table admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz default now()
);
