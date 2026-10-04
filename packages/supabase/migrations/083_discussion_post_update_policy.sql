-- discussion_posts was granted table-level UPDATE in 028_discussions_events.sql
-- but never got a matching RLS policy, so .update() calls were silently denied
-- regardless of caller. Adds editing support for the author's own post.

CREATE POLICY "Author can update own post" ON discussion_posts
  FOR UPDATE USING (guardian_id = auth.uid()) WITH CHECK (guardian_id = auth.uid());
