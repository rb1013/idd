# Guardian Block: Design & Task List

**Written:** 2026-11-17 · **Status:** Planned, not started
Paths are relative to the repo root. Related: `docs/apple-review-checklist.md` #1 (Apple Guideline 1.2 requires users to be able to block abusive users), `docs/admin-todo.md`.

---

## Decisions

| # | Decision |
|---|---|
| 1 | **Both ways (mutual).** "A blocks B" hides each from the other and stops all interaction. B is **not notified** |
| 2 | **Enforced in the database** (RLS + triggers), not by app-side filtering. No extra queries in screens, covers every screen, can't be bypassed via the API |
| 3 | **Replies hidden completely** (no "hidden reply" placeholder), including on a third person's post |
| 4 | **Reply count = replies the viewer can read** (not a stored number). Already the case: `DiscussionsScreen.tsx:229` counts the loaded replies, so it becomes correct automatically |
| 5 | **Guardian block affects guardians only.** Learners' friendships and learner chat are unchanged (learner-level blocking already exists on the Learner Friends page) |
| 6 | **Hide the blocked guardian's shared tutorials** too |
| 7 | **On block, remove RSVPs between the two** (both directions), in addition to removing their connection |
| 8 | **Only the blocker can unblock.** Blocks are private to the blocker. Mutual blocks are two separate rows, so they stay hidden until **both** unblock |
| 9 | **Unblock does not reconnect** and does not restore RSVPs |
| 10 | **Icon-only `🚫`** next to 🚩, in: guardian peek sheets, guardian chat header, Connections cards on **My Connections, Requests and Find** |
| 10a | **Icon layout rule:** if a card/header would show **4 or more** action icons in total, put 🚩 🚫 on a **second row** below the main action icons; otherwise keep everything in **one row**. Avoids clutter and long names colliding with icons (see table in Phase 3) |
| 11 | **Connections tabs:** **Connected · Requests · Find · Blocked** (Blocked tab lists who **you** blocked, with Unblock) |
| 12 | **New table** `guardian_blocks` (not `guardian_connections.status = 'blocked'`: unclear direction, can't represent mutual blocks, visible to the blocked person, needs a connection row) |

### What Block hides / stops (both ways)

| Area | Hidden | Stopped |
|---|---|---|
| Discussions | Each other's **posts and replies** (everywhere, incl. others' posts) | Replying to each other's posts |
| Events | Events **hosted** by the other; the other's name in **attendee / RSVP lists** | RSVPing to each other's events; existing RSVPs between them are **removed** on block |
| Guardian chat | The conversation, from both chat lists | **Sending messages** either way |
| Connections | Each other in **Find, Requests, Connected** | The connection (incl. pending requests) is **removed** on block; new requests refused |
| Peek sheet / profile | Can't open each other's profile | — |
| Tutorials | Shared tutorials **created by** the other | — |
| Notifications | Notifications caused by the other | — |

**Kept (hidden only, not deleted):** chat messages, posts, replies, events. Reports and their snapshots keep working; content reappears if unblocked.

### Example: replies on a third person's post
A blocks B. On C's post: **A** sees C's post and everyone's replies **except B's**, and the count reflects that. **B** sees their own reply but not A's. **C** and everyone else see everything.

### Example: events
X blocks A. **A's events are hidden for X** (and X's for A). On events hosted by someone else, A's name is hidden from X's attendee list and the "going" count excludes A. Any RSVP X made to A's events (and A to X's) is **deleted** at block time.

---

## Phase 1: Database (`packages/supabase/migrations/088_guardian_blocks.sql`): written 2026-11-17, apply + test pending

Implementation notes: hiding/stopping uses **RESTRICTIVE** policies added alongside the existing ones (no existing policy edited); helpers are in a `private` schema (not callable via the API); `send-guardian-message` checks `guardian_blocks` itself (service role); RSVP removal on block suppresses the "withdrew their RSVP" notification. Reply notifications have no source column, so pre-block ones aren't hidden (new ones can't occur: replies are refused).

- [x] **1.1 Table `guardian_blocks`**: `blocker_guardian_id`, `blocked_guardian_id`, `created_at`; primary key on the pair; `CHECK (blocker <> blocked)`; `ON DELETE CASCADE` on both; indexes for both directions
- [x] **1.2 RLS on `guardian_blocks`**: a guardian can insert, read and delete **only their own** blocks; admins can read all
- [x] **1.3 Helper `is_blocked_between(a, b)`**: true if either has blocked the other (used by all rules below)
- [x] **1.4 On block (trigger after insert), in one step:**
  - remove `guardian_connections` rows between the two (both directions, incl. pending requests)
  - remove `event_participants` rows where either guardian RSVPed to an event hosted by the other (all RSVPs, past and upcoming)
  - keep conversations and messages (hidden only)
- [x] **1.5 Read rules (hide)**: add "not blocked between me and the owner" to SELECT policies on:
  - `discussion_posts`, `discussion_replies`
  - `events` (host), `event_participants` (attendee lists)
  - `guardian_connections`
  - `guardian_conversations` / `guardian_conversation_participants` / `guardian_messages`
  - `guardians` (peek sheet, Find)
  - `tutorials` (shared tutorials created by a blocked guardian)
  - `notifications` (those caused by the other guardian; check which column holds the actor)
- [x] **1.6 Write rules (stop)**:
  - reply to a post whose author is blocked either way → refused
  - RSVP to a blocked host's event → refused
  - connection request / accept between a blocked pair → refused
  - opening a guardian chat (conversation-creation RPC) → refused
  - sending a message: `send-guardian-message` refuses, **and** remove the direct `INSERT` policy on `guardian_messages` (`077_guardian_chat.sql:72`)
- [x] **1.7 Notification triggers** (e.g. `063_guardian_notifications.sql`): don't notify one guardian about the other's activity when blocked
- [x] **1.8 Learners**: confirm nothing recreates guardian connections from learner friendships (comment in `025_guardian_connections.sql` says "auto-created", but no code inserts them today; connections are only created in `GuardianConnectionsScreen`)
- [x] **1.9 Admins** keep seeing everything (`is_admin()`), so moderation and reports still work
- [ ] **1.10 Existing joins**: screens that join `guardians` for names (attendee lists, tutorial creator, reply authors) must handle a hidden guardian gracefully (no crash / "undefined")

## Phase 2: Shared app pieces

- [x] **2.1 `apps/mobile/src/lib/blocking.ts`**:
  - `blockGuardian(id, name)` with confirmation: *"Block {name}? You won't see their posts, replies or events, and you won't be able to message each other. You can unblock them later in Connections → Blocked."* → **Cancel · Block**
  - `unblockGuardian(id, name)` with confirmation: *"Unblock {name}?"* → **Cancel · Unblock**
  - error messages
- [x] **2.2 `apps/mobile/src/components/BlockButton.tsx`**: icon-only `🚫`, same 28px light-grey circle as 🚩, 44pt touch area, VoiceOver "Block guardian", `onBlocked` callback; never shown for yourself

## Phase 3: Screens: written 2026-11-17 (needs migration `089_get_my_blocked_guardians.sql` for the Blocked tab)

- [x] **3.1 Guardian peek sheet** (`components/GuardianPeekSheet.tsx`): 🚫 next to 🚩 → after blocking, sheet closes and the screen behind reloads (Discussions, Events list, Event detail, Tutorial library)
- [x] **3.2 Guardian chat header** (`GuardianChatScreen.tsx`): 🚫 next to 🚩 → after blocking, leave the chat; conversation hidden from the chat list
- [x] **3.3 Connections → Connected** cards: 🚫 → card disappears
- [x] **3.4 Connections → Requests** cards: 🚫 → request disappears
- [x] **3.5 Connections → Find** cards: 🚫 → card disappears
- [x] **3.5a Icon layout rule (decision 10a):** 4+ action icons → 🚩 🚫 move to a **second row** under the main icons (right-aligned); fewer → all in **one row**. Applies to the existing 🚩 on these cards too (currently in the main row):

  | Place | Main icons | + Safety icons | Total | Layout |
  |---|---|---|---|---|
  | Connected card | 💬 ✕ | 🚩 🚫 | 4 | **Two rows**: `💬 ✕` on top, `🚩 🚫` below |
  | Requests card (received) | ✓ ✕ | 🚫 (+ 🚩 if added later) | 3 (4 with 🚩) | One row (**two rows** if 🚩 is added) |
  | Find card | 🤝 | 🚩 🚫 | 3 | One row: `🚩 🚫 🤝` |
  | Guardian peek sheet | — | 🚩 🚫 | 2 | One row |
  | Guardian chat header | — | 🚩 🚫 | 2 | One row |

  Second row sits where the county line is, so the card shouldn't get taller; long names get the full top-row width minus the main icons.
- [x] **3.6 Tabs** renamed to **Connected · Requests · Find · Blocked** (`GuardianConnectionsScreen.tsx`)
- [x] **3.7 Blocked tab**: guardians **you** blocked (photo, name, county) with **Unblock**; empty state *"You haven't blocked anyone."*; no count badge; loads with the page (one small query, needed to list blocks)
- [ ] **3.8** Confirm Discussions, Events, chat list and Tutorials reload when returned to, so blocks take effect without restarting

No filtering code is needed in Discussions, Events, Tutorials or Notifications; the database hides blocked content.

## Phase 4: Docs

- [x] **4.1 FAQ**: *"How do I block a guardian?"* (🚫 locations; hides both ways; the other person isn't told; unblock in Connections → Blocked; learners' friendships aren't affected; RSVPs between you are removed)
- [ ] **4.2 Privacy policy**: blocks you create are stored and visible only to you (and admins)
- [x] **4.3 Apple checklist #1**: mark Block done for guardians; update App Review notes ("users can report and block")

## Phase 5: Testing

- [ ] **Both ways**: A blocks B → A doesn't see B's posts, replies, events, profile; **B doesn't see A's**
- [ ] **Third-party post**: on C's post, A doesn't see B's reply; A's reply count excludes it; C sees everything
- [ ] **Events**: B's events and B's name in attendee lists hidden for A; RSVP refused
- [ ] **RSVP removal**: X RSVPs "Going" to A's event → X blocks A → RSVP gone (A's going count drops; not in X's Attending) → X unblocks A → event visible again, X **not** going until they RSVP again
- [ ] **Chat**: conversation hidden for both; sending refused (incl. direct API call)
- [ ] **Connections**: connection and pending requests removed; neither in the other's Find; new requests refused
- [ ] **Tutorials**: B's shared tutorials hidden for A (and A's for B)
- [ ] **Notifications**: none about the other guardian
- [ ] **Learners**: their learners' friendship and learner chat unaffected
- [ ] **Unblock**: only A can (B's Blocked tab doesn't show it); after unblock, content reappears, not reconnected, RSVPs not restored
- [ ] **Mutual blocks**: hidden until both unblock
- [ ] **Admins** still see everything; reports from before the block still show snapshots
- [ ] **🚫 placement**: peek sheet, chat header, Connected / Requests / Find cards; never on yourself; VoiceOver label
- [ ] **Icon layout rule**: Connected card shows `💬 ✕` on top and `🚩 🚫` on a second row; Find card and Requests card (3 icons) stay in one row; a long guardian name doesn't collide with the icons (check on a small iPhone)

## Order and size

| Phase | Depends on | Size |
|---|---|---|
| 1. Database | — | **L** (changes several existing rules; riskiest part) |
| 2. Shared pieces | 1 | S |
| 3. Screens | 2 | M |
| 4. Docs | — | S |
| 5. Testing | all | M |
