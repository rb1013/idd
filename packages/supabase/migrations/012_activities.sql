-- ─── GUARDIAN ACTIVITIES ──────────────────────────────────────────────────────
-- Stores which preset activities a guardian has enabled (max 7, same for all their users)

create table if not exists guardian_activities (
  id          uuid primary key default uuid_generate_v4(),
  guardian_id uuid not null references guardians(id) on delete cascade,
  preset_key  text not null,
  sort_order  smallint default 0,
  created_at  timestamptz default now(),
  unique(guardian_id, preset_key)
);

-- ─── USER ACTIVITY LOGS ───────────────────────────────────────────────────────
-- Tracks which activities each user completed on which day

create table if not exists user_activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references user_profiles(id) on delete cascade,
  activity_id uuid not null references guardian_activities(id) on delete cascade,
  log_date    date not null default current_date,
  completed_at timestamptz default now(),
  unique(user_id, activity_id, log_date)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table guardian_activities enable row level security;
alter table user_activity_logs  enable row level security;

-- Guardians can read and manage their own activity list
create policy "guardian_manage_activities" on guardian_activities
  for all to authenticated
  using     (guardian_id = auth.uid())
  with check (guardian_id = auth.uid());

-- Authenticated users can read all guardian_activities (users need to read via RPC)
create policy "authenticated_read_guardian_activities" on guardian_activities
  for select to authenticated using (true);

-- Authenticated users can manage user_activity_logs (RPC enforces user scoping)
create policy "authenticated_manage_logs" on user_activity_logs
  for all to authenticated using (true) with check (true);

-- ─── PRUNE TRIGGER ────────────────────────────────────────────────────────────
-- Automatically removes logs older than 7 days on every insert

create or replace function prune_old_activity_logs()
returns trigger language plpgsql as $$
begin
  delete from user_activity_logs where log_date < current_date - interval '7 days';
  return null;
end;
$$;

create trigger trg_prune_old_activity_logs
  after insert on user_activity_logs
  for each statement execute function prune_old_activity_logs();

-- ─── RPC: get_user_activities_today ──────────────────────────────────────────
-- Returns today's activity list for a user with completion status

create or replace function get_user_activities_today(p_user_id uuid)
returns table(
  activity_id  uuid,
  preset_key   text,
  sort_order   smallint,
  completed    boolean,
  completed_at timestamptz
) language sql security definer as $$
  select
    ga.id          as activity_id,
    ga.preset_key,
    ga.sort_order,
    (ual.id is not null) as completed,
    ual.completed_at
  from guardian_activities ga
  join user_profiles up on up.guardian_id = ga.guardian_id
  left join user_activity_logs ual
    on  ual.activity_id = ga.id
    and ual.user_id     = p_user_id
    and ual.log_date    = current_date
  where up.id = p_user_id
  order by ga.sort_order, ga.created_at;
$$;

-- ─── RPC: toggle_user_activity ────────────────────────────────────────────────
-- Marks or unmarks a single activity for today

create or replace function toggle_user_activity(
  p_user_id    uuid,
  p_activity_id uuid,
  p_completed  boolean
) returns void language plpgsql security definer as $$
begin
  if p_completed then
    insert into user_activity_logs(user_id, activity_id, log_date)
    values (p_user_id, p_activity_id, current_date)
    on conflict (user_id, activity_id, log_date) do nothing;
  else
    delete from user_activity_logs
    where user_id     = p_user_id
      and activity_id = p_activity_id
      and log_date    = current_date;
  end if;
end;
$$;

-- ─── RPC: get_guardian_activities ─────────────────────────────────────────────
-- Returns current preset_keys for a guardian in sort order

create or replace function get_guardian_activities(p_guardian_id uuid)
returns table(
  activity_id uuid,
  preset_key  text,
  sort_order  smallint
) language sql security definer as $$
  select id as activity_id, preset_key, sort_order
  from guardian_activities
  where guardian_id = p_guardian_id
  order by sort_order, created_at;
$$;

-- ─── RPC: set_guardian_activities ─────────────────────────────────────────────
-- Replaces the guardian's activity list with the supplied ordered preset_keys (max 7)

create or replace function set_guardian_activities(
  p_guardian_id uuid,
  p_preset_keys text[]
) returns void language plpgsql security definer as $$
declare
  i int;
begin
  -- Remove activities that are no longer selected
  delete from guardian_activities
  where guardian_id = p_guardian_id
    and preset_key  != all(p_preset_keys);

  -- Upsert each selected key with its new sort_order
  for i in 1..coalesce(array_length(p_preset_keys, 1), 0) loop
    insert into guardian_activities(guardian_id, preset_key, sort_order)
    values (p_guardian_id, p_preset_keys[i], i)
    on conflict (guardian_id, preset_key)
    do update set sort_order = excluded.sort_order;
  end loop;
end;
$$;

-- ─── RPC: get_activity_report ─────────────────────────────────────────────────
-- Returns per-user per-activity completion for the last 7 days
-- Retained data: last 7 days only (enforced by prune trigger + this filter)

create or replace function get_activity_report(p_guardian_id uuid)
returns table(
  user_id    uuid,
  user_name  text,
  preset_key text,
  log_date   date,
  completed  boolean
) language sql security definer as $$
  select
    up.id        as user_id,
    up.name      as user_name,
    ga.preset_key,
    d.log_date::date,
    (ual.id is not null) as completed
  from user_profiles up
  cross join (
    select generate_series(
      current_date - 6,
      current_date,
      '1 day'::interval
    )::date as log_date
  ) d
  cross join guardian_activities ga
  left join user_activity_logs ual
    on  ual.user_id     = up.id
    and ual.activity_id = ga.id
    and ual.log_date    = d.log_date
  where up.guardian_id  = p_guardian_id
    and ga.guardian_id  = p_guardian_id
  order by up.name, d.log_date, ga.sort_order;
$$;
