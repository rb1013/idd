-- Declining a friend request now DELETES the friendship row (like Cancel) instead of setting
-- status = 'rejected'. A rejected row showed as "Pending" forever on Find / the learner profile,
-- blocked a new request (unique(requester_id, addressee_id)) and left the decliner with a dead
-- "Respond" button. See docs/learnerFriend.md §8.
--
-- One-time cleanup of the rejected rows already stored. The delete policy (065) already lets
-- either side delete; notifications.friendship_id is ON DELETE SET NULL, so notifications stay.

DELETE FROM friendships WHERE status = 'rejected';
