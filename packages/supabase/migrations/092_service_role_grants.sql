-- 092_service_role_grants.sql
-- Edge functions run as service_role. It bypasses RLS but still needs table-level GRANTs, and
-- this project doesn't give new tables default data grants: these two had only
-- TRIGGER / REFERENCES / TRUNCATE for service_role. Both are only read by functions.

-- send-guardian-message checks guardian_blocks before sending (blocked pairs can't message).
-- 088 granted the table only to authenticated → every guardian message failed with
-- "Block check failed: permission denied for table guardian_blocks".
GRANT SELECT ON guardian_blocks TO service_role;

-- create-tutorial, regenerate-tutorial, process-tutorial-job and guardian-action read admin
-- settings (tutorial_quota_limit, tutorial_max_frames, tutorial_image_timeout_ms,
-- report_snapshot_limit). The read error was swallowed, so they silently used built-in defaults
-- instead of the values set in the admin portal.
GRANT SELECT ON app_settings TO service_role;
