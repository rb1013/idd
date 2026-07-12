-- Edge functions use service_role key but need explicit grants on all tutorial
-- tables created in migration 010 (Supabase doesn't auto-grant service_role on new tables)
GRANT ALL ON public.tutorial_jobs    TO service_role;
GRANT ALL ON public.tutorial_frames  TO service_role;
GRANT ALL ON public.user_tutorials   TO service_role;
GRANT ALL ON public.guardian_tutorial_quota TO service_role;
