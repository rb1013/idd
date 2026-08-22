-- Allow any authenticated user to read dislikes (same pattern as user_likes)
create policy "Authenticated users can read dislikes" on user_dislikes
  for select using (auth.role() = 'authenticated');
