-- Fix event_category_options: replace open-read policy with proper pattern
DROP POLICY IF EXISTS "Anyone authenticated can read event categories" ON event_category_options;

CREATE POLICY "public_read_event_categories"
  ON event_category_options FOR SELECT
  USING (true);

CREATE POLICY "admin_write_event_categories"
  ON event_category_options FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

GRANT SELECT ON event_category_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_category_options TO authenticated;

-- Fix categories table: add missing write grants (RLS already restricts to admins via is_admin())
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
