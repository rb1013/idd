-- 105_west_grants_and_storage_policies.sql
-- Fixes found when comparing the new West project with the old East one (2026-11-26).
-- Generated from East's ACTUAL permissions and storage rules, so West matches East exactly.
--
-- 1. PERMISSIONS. East gave new tables/functions NO default access (each migration granted what it
--    needed). The new West project grants FULL access to anon / authenticated / service_role by
--    default, so everything loaded from the dump was over-granted. With that, rules written as
--    "allow everything" (service_role_all_reports, service_role_all_blocked_learners, System inserts
--    notifications, Authenticated can create conversations) let ANYONE — even signed out — read /
--    change / delete reports and learner blocks; functions East deliberately locked (e.g.
--    contains_blocked_word, trigger / private helper functions) became callable. Here: revoke, then
--    re-grant exactly East's set, and set West's default privileges to East's.
--    NOTE: functions East left at Postgres' default (EXECUTE to PUBLIC — e.g. prune_old_activity_logs,
--    set_guardian_pin) stay callable by everyone, as on East; tightening those is a separate change.
-- 2. STORAGE RULES. The dump didn't include policies on storage.objects, so West had none (photo
--    uploads and admin AAC symbol uploads failed). Recreated exactly as on East.
--
-- West only — East already has all of this. Safe to re-run.

BEGIN;

-- ═══ 1a. Tables, views, sequences (public) ═══════════════════════════════════
REVOKE ALL ON TABLE public.aac_phrases FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.aac_phrases TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.aac_phrases TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.aac_phrases TO service_role;
REVOKE ALL ON TABLE public.aac_symbols FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.aac_symbols TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.aac_symbols TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.aac_symbols TO service_role;
REVOKE ALL ON TABLE public.admins FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.admins TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.admins TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admins TO service_role;
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.app_settings TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.app_settings TO authenticated;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.app_settings TO service_role;
REVOKE ALL ON TABLE public.blocked_learners FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.blocked_learners TO anon;
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.blocked_learners TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.blocked_learners TO service_role;
REVOKE ALL ON TABLE public.blocked_words FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.blocked_words TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.blocked_words TO authenticated;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.blocked_words TO service_role;
REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.categories TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.categories TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.categories TO service_role;
REVOKE ALL ON TABLE public.chat_preferences FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.chat_preferences TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.chat_preferences TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.chat_preferences TO service_role;
REVOKE ALL ON TABLE public.conversation_participants FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.conversation_participants TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversation_participants TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversation_participants TO service_role;
REVOKE ALL ON TABLE public.conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.conversations TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversations TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversations TO service_role;
REVOKE ALL ON TABLE public.discussion_category_options FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.discussion_category_options TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.discussion_category_options TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_category_options TO service_role;
REVOKE ALL ON TABLE public.discussion_posts FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_posts TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.discussion_posts TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_posts TO service_role;
REVOKE ALL ON TABLE public.discussion_replies FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_replies TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.discussion_replies TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_replies TO service_role;
REVOKE ALL ON TABLE public.discussion_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_reports TO anon;
GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.discussion_reports TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.discussion_reports TO service_role;
REVOKE ALL ON TABLE public.event_category_options FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.event_category_options TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_category_options TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.event_category_options TO service_role;
REVOKE ALL ON TABLE public.event_participants FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.event_participants TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_participants TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.event_participants TO service_role;
REVOKE ALL ON TABLE public.event_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.event_reports TO anon;
GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.event_reports TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.event_reports TO service_role;
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.events TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.events TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.events TO service_role;
REVOKE ALL ON TABLE public.friendships FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.friendships TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.friendships TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.friendships TO service_role;
REVOKE ALL ON TABLE public.guardian_activities FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_activities TO anon;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_activities TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_activities TO service_role;
REVOKE ALL ON TABLE public.guardian_blocks FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_blocks TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.guardian_blocks TO authenticated;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.guardian_blocks TO service_role;
REVOKE ALL ON TABLE public.guardian_chat_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_chat_reports TO anon;
GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_chat_reports TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_chat_reports TO service_role;
REVOKE ALL ON TABLE public.guardian_connections FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_connections TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_connections TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_connections TO service_role;
REVOKE ALL ON TABLE public.guardian_conversation_participants FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_conversation_participants TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_conversation_participants TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_conversation_participants TO service_role;
REVOKE ALL ON TABLE public.guardian_conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_conversations TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_conversations TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_conversations TO service_role;
REVOKE ALL ON TABLE public.guardian_messages FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_messages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_messages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_messages TO service_role;
REVOKE ALL ON TABLE public.guardian_notification_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_notification_settings TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_notification_settings TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_notification_settings TO service_role;
REVOKE ALL ON TABLE public.guardian_profile_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_profile_reports TO anon;
GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_profile_reports TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_profile_reports TO service_role;
REVOKE ALL ON TABLE public.guardian_tutorial_quota FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardian_tutorial_quota TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.guardian_tutorial_quota TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardian_tutorial_quota TO service_role;
REVOKE ALL ON TABLE public.guardians FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.guardians TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardians TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.guardians TO service_role;
REVOKE ALL ON TABLE public.health_info FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.health_info TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.health_info TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.health_info TO service_role;
REVOKE ALL ON TABLE public.medical_conditions FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.medical_conditions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.medical_conditions TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.medical_conditions TO service_role;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.messages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.messages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.messages TO service_role;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.notifications TO anon;
GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO service_role;
REVOKE ALL ON TABLE public.reports FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.reports TO anon;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.reports TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reports TO service_role;
REVOKE ALL ON TABLE public.schedule_events FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_events TO anon;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_events TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_events TO service_role;
REVOKE ALL ON TABLE public.schedule_templates FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_templates TO anon;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_templates TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.schedule_templates TO service_role;
REVOKE ALL ON TABLE public.tutorial_frames FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.tutorial_frames TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorial_frames TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorial_frames TO service_role;
REVOKE ALL ON TABLE public.tutorial_jobs FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.tutorial_jobs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorial_jobs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorial_jobs TO service_role;
REVOKE ALL ON TABLE public.tutorial_skills FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.tutorial_skills TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorial_skills TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.tutorial_skills TO service_role;
REVOKE ALL ON TABLE public.tutorials FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.tutorials TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorials TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tutorials TO service_role;
REVOKE ALL ON TABLE public.user_abilities FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_abilities TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_abilities TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_abilities TO service_role;
REVOKE ALL ON TABLE public.user_activity_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_activity_logs TO anon;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_activity_logs TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_activity_logs TO service_role;
REVOKE ALL ON TABLE public.user_dislikes FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_dislikes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_dislikes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_dislikes TO service_role;
REVOKE ALL ON TABLE public.user_likes FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_likes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_likes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_likes TO service_role;
REVOKE ALL ON TABLE public.user_medical_conditions FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_medical_conditions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_medical_conditions TO authenticated;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_medical_conditions TO service_role;
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO service_role;
REVOKE ALL ON TABLE public.user_tutorials FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.user_tutorials TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_tutorials TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_tutorials TO service_role;

-- ═══ 1b. Functions (public, private) ══════════════════════════════════════════
REVOKE ALL ON FUNCTION private.discussion_post_author(p_post_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.discussion_post_author(p_post_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.event_host(p_event_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.event_host(p_event_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.guardian_conversation_blocked(p_conversation_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.guardian_conversation_blocked(p_conversation_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.is_blocked_between(a uuid, b uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_blocked_between(a uuid, b uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.learner_conversation_blocked(p_conversation_id uuid, p_sender_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.learner_conversation_blocked(p_conversation_id uuid, p_sender_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.aac_set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aac_set_updated_at() TO PUBLIC;
REVOKE ALL ON FUNCTION public.add_schedule_event(p_guardian_id uuid, p_user_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_emoji text, p_is_cancellation boolean, p_template_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_schedule_event(p_guardian_id uuid, p_user_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_emoji text, p_is_cancellation boolean, p_template_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.contains_blocked_word(p_text text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_conversation_with_participants(participant_a uuid, participant_b uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_conversation_with_participants(participant_a uuid, participant_b uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_tutorial_link_count() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decrement_tutorial_link_count() TO PUBLIC;
REVOKE ALL ON FUNCTION public.delete_schedule_event(p_guardian_id uuid, p_event_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_schedule_event(p_guardian_id uuid, p_event_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.delete_schedule_template(p_guardian_id uuid, p_template_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_schedule_template(p_guardian_id uuid, p_template_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.discussion_reports_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.event_reports_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.find_or_create_conversation(p_user_a uuid, p_user_b uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_conversation(p_user_a uuid, p_user_b uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.find_or_create_guardian_conversation(p_guardian_a uuid, p_guardian_b uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_guardian_conversation(p_guardian_a uuid, p_guardian_b uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_activity_report(p_guardian_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_activity_report(p_guardian_id uuid, p_today date) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_guardian_activities(p_guardian_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_guardian_activities(p_guardian_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_guardian_templates(p_guardian_id uuid, p_user_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_guardian_templates(p_guardian_id uuid, p_user_id uuid, p_today date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_templates(p_guardian_id uuid, p_user_id uuid, p_today date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_templates(p_guardian_id uuid, p_user_id uuid, p_today date) TO service_role;
REVOKE ALL ON FUNCTION public.get_guardian_unread_counts(p_guardian_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_guardian_unread_counts(p_guardian_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_blocked_guardians() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_guardians() TO authenticated;
REVOKE ALL ON FUNCTION public.get_schedule_events(p_guardian_id uuid, p_user_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_schedule_events(p_guardian_id uuid, p_user_id uuid, p_today date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_schedule_events(p_guardian_id uuid, p_user_id uuid, p_today date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedule_events(p_guardian_id uuid, p_user_id uuid, p_today date) TO service_role;
REVOKE ALL ON FUNCTION public.get_user_activities_today(p_user_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_activities_today(p_user_id uuid, p_today date) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_conversations(p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(p_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_schedule_today(p_user_id uuid, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_schedule_today(p_user_id uuid, p_today date) TO PUBLIC;
REVOKE ALL ON FUNCTION public.guardian_blocks_after_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guardian_chat_reports_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guardian_messages_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guardian_profile_reports_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.increment_tutorial_link_count() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_tutorial_link_count() TO PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
REVOKE ALL ON FUNCTION public.is_email_registered(check_email text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_email_registered(check_email text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_registered(check_email text) TO service_role;
REVOKE ALL ON FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_user_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.mark_guardian_conversation_read(p_conversation_id uuid, p_guardian_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_guardian_conversation_read(p_conversation_id uuid, p_guardian_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.messages_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_connection_request() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_connection_request() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_connection_status_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_connection_status_change() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_discussion_reply() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_discussion_reply() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_event_rsvp() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_event_rsvp() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_event_rsvp_removed() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_event_rsvp_removed() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_guardian_on_friendship() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_guardian_on_friendship() TO PUBLIC;
REVOKE ALL ON FUNCTION public.notify_tutorial_status_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_tutorial_status_change() TO PUBLIC;
REVOKE ALL ON FUNCTION public.owns_user_profile(profile_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_user_profile(profile_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.prune_old_activity_logs() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prune_old_activity_logs() TO PUBLIC;
REVOKE ALL ON FUNCTION public.reject_blocked_words_discussion() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.report_reporter_guardian_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.report_status_before_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_guardian_activities(p_guardian_id uuid, p_preset_keys text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_guardian_activities(p_guardian_id uuid, p_preset_keys text[]) TO PUBLIC;
REVOKE ALL ON FUNCTION public.set_guardian_pin(pin_input text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_guardian_pin(pin_input text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_user_activity(p_user_id uuid, p_activity_id uuid, p_completed boolean, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_user_activity(p_user_id uuid, p_activity_id uuid, p_completed boolean, p_today date) TO PUBLIC;
REVOKE ALL ON FUNCTION public.update_schedule_event(p_guardian_id uuid, p_event_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_today date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_schedule_event(p_guardian_id uuid, p_event_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_today date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_schedule_event(p_guardian_id uuid, p_event_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_today date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_schedule_event(p_guardian_id uuid, p_event_id uuid, p_event_date date, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_today date) TO service_role;
REVOKE ALL ON FUNCTION public.upsert_schedule_template(p_guardian_id uuid, p_user_id uuid, p_day_of_week smallint, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_emoji text, p_valid_from date, p_valid_until date, p_template_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_schedule_template(p_guardian_id uuid, p_user_id uuid, p_day_of_week smallint, p_start_time time without time zone, p_end_time time without time zone, p_title text, p_emoji text, p_valid_from date, p_valid_until date, p_template_id uuid) TO PUBLIC;
REVOKE ALL ON FUNCTION public.verify_guardian_pin(pin_input text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_guardian_pin(pin_input text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.verify_guardian_pin_for_learner(guardian_id_input uuid, pin_input text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_guardian_pin_for_learner(guardian_id_input uuid, pin_input text) TO PUBLIC;

-- ═══ 1c. Default privileges for objects created by postgres in public (= East) ═══
-- East: tables → only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for the API roles; functions and
-- sequences → nothing beyond Postgres' own default (functions: EXECUTE to PUBLIC).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES TO anon, authenticated, service_role;

-- ═══ 2. Storage rules on storage.objects (= East) ═════════════════════════════
DROP POLICY IF EXISTS "AAC symbols are publicly readable" ON storage.objects;
CREATE POLICY "AAC symbols are publicly readable" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'aac-symbols'::text));
DROP POLICY IF EXISTS "Admins delete AAC symbols" ON storage.objects;
CREATE POLICY "Admins delete AAC symbols" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'aac-symbols'::text) AND ( SELECT is_admin() AS is_admin)));
DROP POLICY IF EXISTS "Admins replace AAC symbols" ON storage.objects;
CREATE POLICY "Admins replace AAC symbols" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'aac-symbols'::text) AND ( SELECT is_admin() AS is_admin)))
  WITH CHECK (((bucket_id = 'aac-symbols'::text) AND ( SELECT is_admin() AS is_admin)));
DROP POLICY IF EXISTS "Admins upload AAC symbols" ON storage.objects;
CREATE POLICY "Admins upload AAC symbols" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'aac-symbols'::text) AND ( SELECT is_admin() AS is_admin)));
DROP POLICY IF EXISTS "Tutorial audio is publicly readable" ON storage.objects;
CREATE POLICY "Tutorial audio is publicly readable" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'tutorial-audio'::text));
DROP POLICY IF EXISTS "Tutorial images are publicly readable" ON storage.objects;
CREATE POLICY "Tutorial images are publicly readable" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'tutorial-images'::text));
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
CREATE POLICY avatars_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'avatars'::text));
DROP POLICY IF EXISTS avatars_select ON storage.objects;
CREATE POLICY avatars_select ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'avatars'::text));
DROP POLICY IF EXISTS avatars_update ON storage.objects;
CREATE POLICY avatars_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((bucket_id = 'avatars'::text));
DROP POLICY IF EXISTS tutorials_insert ON storage.objects;
CREATE POLICY tutorials_insert ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'tutorials'::text) AND (auth.role() = 'authenticated'::text)));
DROP POLICY IF EXISTS tutorials_select ON storage.objects;
CREATE POLICY tutorials_select ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'tutorials'::text));
DROP POLICY IF EXISTS tutorials_update ON storage.objects;
CREATE POLICY tutorials_update ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING (((bucket_id = 'tutorials'::text) AND (auth.role() = 'authenticated'::text)));

COMMIT;
