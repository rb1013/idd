# Block Learner Feature

## Context

Guardians need the ability to block another learner from their learner's social experience. This is a safeguarding control — only guardians can perform this action, not the learner themselves. Access is PIN-protected.

This feature is part of a broader guardian chat management set that also includes Report and Delete (discussed separately).

---

## Behaviour

### Visibility

- Blocked learner disappears from the learner's **Friends list** (FriendsHubScreen)
- Blocked learner disappears from the **Find results** (LearnerFriendsScreen → Find tab)
- Block is **mutual** — the blocked learner also cannot see the learner in their own friends list or find results

### Existing Friendship

- If the two learners were already friends, the friendship record is **kept in the DB** but suppressed in the UI
- This means if the guardian unblocks later, the friendship is restored automatically without re-adding

### Actions — what each one does

| Action | Block user | Delete chat | Message snapshot | Report to admin |
|---|---|---|---|---|
| **Delete Chat** | ✗ | ✓ | ✗ | ✗ |
| **Block User** | ✓ | ✗ | ✗ | ✗ |
| **Report User** | ✗ | ✗ | ✗ | ✓ (no snapshot) |
| **Block & Delete Chat** | ✓ | ✓ | ✗ | ✗ |
| **Block, Delete Chat & Report** | ✓ | ✓ | ✓ | ✓ (with snapshot) |

**Message snapshot** — last N messages (N = `app_settings.report_snapshot_limit`, default 20) saved as JSON in the `reports` table. Only taken for **Block, Delete Chat & Report**.

Snapshot includes: `sender_id`, `content`, `created_at` per message. If fewer than N messages exist, all are saved. Visible only in admin portal.

### Unblock

- Guardian removes the block record → friendship and find visibility are restored

---

## Database

### blocked_learners table

```sql
CREATE TABLE blocked_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blocked_learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  blocked_by_guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  reason TEXT,                  -- optional reason entered by guardian at time of block
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (learner_id, blocked_learner_id)
);
```

### reports table

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reported_learner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reported_by_guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  reason TEXT,                  -- 'block_and_delete' or manual reason from Report action
  message_snapshot JSONB,       -- last 25 messages at time of action: [{sender_id, content, created_at}]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Filtering Logic

Both `FriendsHubScreen` and `LearnerFriendsScreen` (Find tab) must exclude entries where:
- `blocked_learner_id = other_learner_id` (A blocked B — hide B from A)
- `learner_id = other_learner_id` (B blocked someone — hide A from B's perspective — mutual)

Since the block is mutual, a single record covers both directions.

---

## UI Entry Points

### 1. Chat screen — block action

- Guardian shield icon 🛡️ in the chat header (ChatScreen)
- Tapping prompts for guardian PIN (reuses existing biometricStore verification)
- On success, shows a bottom sheet with 5 options:
  1. **Delete Chat** — wipe messages only, no block, no report
  2. **Block User** — hide from friends/find only, no chat change, no report
  3. **Report User** — flag to admin, no block, no deletion, no snapshot
  4. **Block & Delete Chat** — hide + wipe messages, no report, no snapshot
  5. **Block, Delete Chat & Report** — hide + wipe + snapshot + report to admin
- Learner sees the icon but cannot get past the PIN prompt

### Confirmation & Reason prompt (all 5 actions)

Every action goes through a 2-step confirmation flow after the bottom sheet:

**Step 1 — Reason**
- A text input prompt: "Why are you taking this action?" (optional but encouraged)
- Short free-text field, placeholder: e.g. "Inappropriate language", "Bullying"
- Reason is saved to `blocked_learners.reason` (for block actions) or `reports.reason` (for report actions)

**Step 2 — Delete scope** *(only for Delete Chat, Block & Delete Chat, Block & Delete Chat & Report)*
- Guardian is asked: "How many messages do you want to delete?"
- Two options:
  - **All messages** — wipes entire conversation history
  - **Last N messages** — number input field, guardian types a count (e.g. 10, 50)
- If "Last N" is chosen and N exceeds total messages in the conversation, all messages are deleted
- The snapshot (for Block, Delete Chat & Report only) always uses `report_snapshot_limit` from `app_settings` — independent of the guardian's chosen deletion scope

**Step 3 — Confirmation**
- A confirmation dialog summarising what is about to happen
- For actions involving deletion (**Block & Delete Chat**, **Delete Chat**):
  - Shows scope chosen: "All messages" or "Last N messages"
  - Prominent disclaimer: **"This cannot be undone. Chat history will be permanently deleted for both learners."**
  - Confirm button labelled "Yes, Delete" in red
- For block-only and report (no deletion):
  - Standard confirmation: "Are you sure?" with action name
  - Confirm button labelled "Confirm"
- Cancel always available at all steps

### Edge Functions

**block-delete-report** *(Block, Delete Chat & Report)*
Executes in sequence (all or nothing):
1. Read `report_snapshot_limit` from `app_settings` table (default: 20 if not set)
2. Fetch last N messages as snapshot
3. Insert record into `reports` with `message_snapshot` and `reason`
4. Delete messages from conversation (all or last N per guardian's choice)
5. Insert record into `blocked_learners` with `reason`

**block-delete** *(Block & Delete Chat)*
1. Delete messages from conversation (all or last N per guardian's choice)
2. Insert record into `blocked_learners` with `reason`

**block-user**, **report-user**, **delete-chat** — simpler single-step edge functions.

### app_settings key

| key | value | description |
|---|---|---|
| `report_snapshot_limit` | `20` | Number of messages saved in evidence snapshot for Block, Delete Chat & Report action. Configurable by admin without app release. |

### 2. LearnerFriendsScreen — Blocked tab

- A new 4th tab **Blocked 🚫** added to the Friends screen (alongside Friends / Requests / Find)
- Lists all learners blocked by the guardian for this learner, showing their name, photo, and reason (if provided)
- Each row has an **Unblock** button
- Tapping Unblock shows a confirmation prompt: "Are you sure you want to unblock this person?"
- On confirm, removes the record from `blocked_learners` → friendship and visibility restored immediately
- Tab is visible to the guardian only context (guardian is the one navigating to LearnerFriendsScreen)

---

## Pending Decisions

- None — approach agreed.

## Not Yet Implemented

- `blocked_learners` table migration
- `reports` table migration
- Filtering in FriendsHubScreen and LearnerFriendsScreen
- Guardian shield icon + PIN prompt in ChatScreen
- 5-option action bottom sheet in ChatScreen
- Edge function: `block-delete-report`
- Edge function: `block-delete`
- Edge function: `block-user`
- Edge function: `report-user`
- Edge function: `delete-chat`
- Blocked tab in LearnerFriendsScreen with unblock button
- Reports view in admin portal (with message snapshot viewer)
