alter table app_settings
  add column if not exists tutorial_default_duration integer not null default 25;

update app_settings set tutorial_default_duration = 25 where id = 1;
