-- RLS for guardian_connections (table created in 025 without RLS)

grant select, insert, update, delete on public.guardian_connections to authenticated;

alter table guardian_connections enable row level security;

-- Either party can read their connections
create policy "Guardian can read own connections" on guardian_connections
  for select using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Either party can create the connection row
-- (auto-insert on learner friend accept: current guardian is addressee)
create policy "Guardian can insert connection" on guardian_connections
  for insert with check (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Either party can update (e.g. future block/unfriend)
create policy "Guardian can update own connection" on guardian_connections
  for update using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Either party can remove
create policy "Guardian can delete own connection" on guardian_connections
  for delete using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );
