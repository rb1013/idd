alter table tutorials
  add column if not exists is_public boolean not null default true;
