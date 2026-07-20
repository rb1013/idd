-- Guardian-to-guardian connections
-- Auto-created (status = accepted) when their respective learners become friends.
-- Also supports future direct guardian discovery/requests.

CREATE TABLE IF NOT EXISTS guardian_connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'accepted'
               CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_connections_addressee
  ON guardian_connections(addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_guardian_connections_requester
  ON guardian_connections(requester_id, status);
