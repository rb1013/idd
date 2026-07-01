-- Two separate pin flags so each side of the friendship can independently be pinned
-- requester_pinned = the requester's guardian has marked this as a favourite
-- addressee_pinned = the addressee's guardian has marked this as a favourite
ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS requester_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addressee_pinned boolean NOT NULL DEFAULT false;
