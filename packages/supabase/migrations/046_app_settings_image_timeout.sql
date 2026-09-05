alter table app_settings
  add column if not exists tutorial_image_timeout_ms integer not null default 65000;

update app_settings set tutorial_image_timeout_ms = 65000 where id = 1;
