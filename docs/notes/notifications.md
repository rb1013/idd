# Guardian Notifications — Discussions & Tutorials

## Overview

Guardians receive in-app notifications for two categories:

- **Discussions** — when another guardian replies to their post
- **Tutorials** — when their submitted tutorial is approved or rejected by an admin

Both are surfaced on the `GuardianNotificationsScreen`, accessible by tapping the bell icon on `GuardianHomeScreen`.

---

## Database

### Table: `notifications`

Key columns used by this feature:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `guardian_id` | uuid | Guardian who receives the notification |
| `type` | notification_type enum | See types below |
| `message` | text | Human-readable message shown in the UI |
| `ref_id` | uuid | ID of the related entity (post ID or tutorial ID) |
| `read` | boolean | Default `false`. Set to `true` when guardian taps the notification |
| `dismissed` | boolean | Default `false`. Tutorials only — set to `true` when guardian taps ✕ |
| `created_at` | timestamptz | When the notification was created |

### Relevant enum values

```sql
'discussion_reply'   -- someone replied to the guardian's discussion post
'tutorial_approved'  -- admin approved the guardian's tutorial
'tutorial_rejected'  -- admin rejected the guardian's tutorial
```

---

## How Notifications Are Created

### Discussion replies — DB trigger

**Trigger:** `trg_discussion_reply` on `discussion_replies` (AFTER INSERT)
**Function:** `notify_discussion_reply()` (SECURITY DEFINER)

Fires when a reply is inserted. Looks up the post's author guardian and inserts a notification for them. Skips if the replier is the post author (no self-notification).

```sql
INSERT INTO notifications (guardian_id, type, message, ref_id)
VALUES (
  post_guardian_id,
  'discussion_reply',
  '<replier name> replied to your post "<post title>"',
  NEW.post_id   -- ref_id points to the discussion post
);
```

Migration: `063_guardian_notifications.sql`
Fix (replier name): `064_fix_discussion_reply_notif.sql`

### Tutorial status change — DB trigger

**Trigger:** `trg_tutorial_status_change` on `tutorials` (AFTER UPDATE)
**Function:** `notify_tutorial_status_change()` (SECURITY DEFINER)

Fires when a tutorial's `status` changes to `approved` or `rejected`.

```sql
INSERT INTO notifications (guardian_id, type, message, ref_id)
VALUES (
  NEW.created_by_guardian_id,
  'tutorial_approved' | 'tutorial_rejected',
  'Your tutorial "<title>" has been approved/was not approved',
  NEW.id   -- ref_id points to the tutorial
);
```

Migration: `063_guardian_notifications.sql`

---

## Notifications Screen

**File:** `apps/mobile/src/screens/guardian/GuardianNotificationsScreen.tsx`

### Tabs

| Tab | Types shown | Filter |
|---|---|---|
| Discussions | `discussion_reply` | Unread only (`read = false`) |
| Tutorials | `tutorial_approved`, `tutorial_rejected` | Last N hours + not dismissed |

### Settings (fetched from `app_settings` on load)

| Setting | Column | Default | Admin label |
|---|---|---|---|
| Tutorial window | `notif_tutorial_window_hours` | 48 hours | Tutorial Notification Window |
| Discussion limit | `notif_discussion_limit` | 30 | Discussion Notification Limit |

Settings are configurable in the admin panel under **App Settings**.

### Read / Unread behaviour

- **Unread cards** — light blue (`NICO.chatBubbleMe`) background, teal left stripe, red dot (top right)
- **Read cards** — white background, green tick ✓ (top right)
- `read` is set to `true` only when the guardian **taps** the notification card (not on page open)
- For discussion posts: `read` is also set to `true` when the guardian opens the discussion post directly (fire-and-forget UPDATE by `ref_id` in `DiscussionDetailScreen`)

### Dismiss (tutorials only)

Each tutorial card has a ✕ button. Tapping it:
1. Sets `dismissed = true` in the DB (fire-and-forget)
2. Removes the card from local state immediately

Dismissed notifications are excluded from future fetches via `.eq('dismissed', false)`.

### Deep-links on tap

| Notification type | Navigates to |
|---|---|
| `discussion_reply` | `DiscussionDetailScreen` with `postId = ref_id` |
| `tutorial_approved` | `TutorialPreviewScreen` with `tutorialId = ref_id` |
| `tutorial_rejected` | `TutorialPreviewScreen` with `tutorialId = ref_id` |

### Timestamp format

- **Discussions** — relative only: `"17m ago"`, `"2h ago"`
- **Tutorials** — relative + absolute: `"2h ago  ·  Sep 18, 3:45 PM"` — helps distinguish repeated rejections of the same tutorial

---

## Bell Icon (GuardianHomeScreen)

- Tapping the bell navigates directly to `GuardianNotificationsScreen` (no dropdown)
- Shows a red badge with unread count (across all guardian notification types)
- Badge shows `9+` if count exceeds 9
- Bell icon and badge are scaled with `scale()` for tablet

---

## Admin Panel Settings

**File:** `apps/admin/src/pages/AppSettingsPage.tsx`

Two settings under the **Notifications** section:

### Tutorial Notification Window
- Column: `notif_tutorial_window_hours`
- Controls how many hours back tutorial notifications are shown
- Range: 1–168 hours (1 week max)
- Default: 48 hours

### Discussion Notification Limit
- Column: `notif_discussion_limit`
- Controls the maximum number of unread discussion notifications fetched
- Range: 1–200
- Default: 30

---

## Migrations

| File | Purpose |
|---|---|
| `063_guardian_notifications.sql` | Extends notification_type enum, adds `ref_id`, creates 4 triggers |
| `064_fix_discussion_reply_notif.sql` | Fixes replier name in discussion reply notification message |
| `066_notifications_dismissed.sql` | Adds `dismissed boolean DEFAULT false` to notifications |
| `067_notif_settings.sql` | Adds `notif_tutorial_window_hours` and `notif_discussion_limit` to `app_settings` |
