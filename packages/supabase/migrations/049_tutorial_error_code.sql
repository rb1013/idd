-- 049_tutorial_error_code.sql
-- Tracks playback errors (e.g. YouTube embed disabled) so the app can
-- surface them in the UI without re-checking on every open.

alter table tutorials add column if not exists tutorial_error_code integer null;
