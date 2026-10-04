# Guardian Deletion — Cascade Reference

When a guardian is deleted (via Supabase Authentication → Users), the following happens across all related tables.

## ON DELETE CASCADE — deleted automatically

| Table | Column | Effect |
|---|---|---|
| `user_profiles` | `guardian_id` | All their learners deleted (and all learner data cascades from there) |
| `guardian_notification_settings` | `guardian_id` | Their notification preferences deleted |
| `notifications` | `guardian_id` | All their notifications deleted |
| `guardian_tutorial_quota` | `guardian_id` | Their monthly AI tutorial quota record deleted |
| `activity_presets` | `guardian_id` | Their activity definitions deleted |
| `schedule_templates` | `guardian_id` | Their schedule templates deleted |
| `schedule_events` | `guardian_id` | Their schedule events deleted |
| `guardian_connections` | `requester_id` / `addressee_id` | Their guardian-to-guardian connections deleted (both sides) |
| `discussion_posts` | `guardian_id` | Their community posts deleted |
| `community_events` | `guardian_id` | Their events deleted |
| `event_rsvps` | `guardian_id` | Their RSVPs deleted |
| `discussion_comments` | `guardian_id` | Their comments deleted |
| `blocked_learners` | `blocked_by_guardian_id` | Their block records deleted |
| `reports` | `reported_by_guardian_id` | Reports they filed on behalf of learners deleted |

## ON DELETE SET NULL — record kept, reference nulled

| Table | Column | Effect |
|---|---|---|
| `friendships` | `requested_by_guardian_id` | Redundant — friendship rows are already deleted by the time this fires (learner deletion cascades first) |
| `tutorials` | `created_by_guardian_id` | Tutorial content stays, authorship nulled |

## Previously NO ACTION — fixed in migration 057

Both columns below originally had no ON DELETE clause (defaulting to NO ACTION, which blocks deletion). Fixed to SET NULL so guardian deletion no longer errors.

| Table | Column | Effect |
|---|---|---|
| `tutorials` | `created_by_guardian_id` | Tutorial stays, authorship nulled |
| `user_tutorials` | `added_by_guardian_id` | Assignment stays, attribution nulled |

## Notes

- Always delete from **Authentication → Users** in the Supabase dashboard, not from the `guardians` table directly. Deleting the auth user cascades to `guardians`, which then cascades everything above.
- Because `user_profiles` cascades, all learner-level data (likes, dislikes, friendships, messages, medical conditions, etc.) is also wiped as part of the guardian deletion.
- `blocked_words.added_by` previously referenced `guardians` but was migrated (056) to reference `admins` — no longer relevant to guardian deletion.
