-- Track which guardian initiated a learner friendship request
-- Allows the addressee's guardian to see who sent the request and notify them

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS requested_by_guardian_id uuid references guardians(id) on delete set null;

-- Index for fast lookup of pending requests by addressee (for incoming request inbox)
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_pending
  ON friendships(addressee_id, status)
  WHERE status = 'pending';

-- Index for fast lookup by requester (for outgoing pending requests)
CREATE INDEX IF NOT EXISTS idx_friendships_requester_pending
  ON friendships(requester_id, status)
  WHERE status = 'pending';
