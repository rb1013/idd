-- Allow either learner's guardian to delete (unfriend) a friendship
CREATE POLICY "Users can delete their friendships" ON friendships
  FOR DELETE USING (
    owns_user_profile(requester_id) OR owns_user_profile(addressee_id)
  );
