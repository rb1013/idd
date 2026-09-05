alter table app_settings
  add column if not exists tutorial_max_frames integer not null default 4;

update app_settings set tutorial_max_frames = 4 where id = 1;
