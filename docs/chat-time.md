# Chat — why a message takes ~1 second to appear (discussion)

**Functions:** `packages/supabase/supabase/functions/send-message` (learner chat), `send-guardian-message` (guardian chat), `_shared/blockedWords.ts`
**Status:** **guardian chat** — replaced by a direct database insert (migration 099, `GuardianChatScreen.tsx`, 2026-11-25): no function, no sequential steps; the database checks sender, participant, guardian block and blocked words. **Learner chat** (`send-message`) — still the function; options 2 + 3 below still apply to it.
**Written:** 2026-11-24

---

## 1. Why it takes about a second

The app waits for the server to confirm a message before it shows it. This applies to both learner chat and guardian chat.

1. Tapping Send calls a server function: `send-message` for learners (`ChatScreen.tsx:262`) or `send-guardian-message` for guardians (`GuardianChatScreen.tsx:132`).
2. That function runs **5–6 database steps one after another**:
   - checks who is sending
   - checks they belong to this chat
   - finds the other person in the chat
   - checks for blocks
   - loads the blocked-words list
   - saves the message
3. The app shows the message **only after the function replies** (line 285 for learners, line 160 for guardians).

**Why that adds up to about a second:**
- Each step is a separate trip to the database, at roughly 50–150 ms each.
- If nobody has sent a message for a while, the server function has to start up first ("cold start"), which adds 300–800 ms or more.
- The request also has to travel from the phone to Supabase and back.

The other person sees the message as soon as it's saved, through the live chat connection.

**Ways to make it feel faster:**
1. **Show the message straight away** (biggest win). Add it to the chat as soon as Send is tapped, faded or marked "sending…". When the server confirms, it turns normal. If the server rejects it (blocked word, blocked user), remove it and show the error. *Not chosen for now.*
2. **Run the checks at the same time.** **Chosen.**
3. **Keep the blocked-words list in memory** in the server function. **Chosen.**

---

## 2. Option 2: run the checks at the same time

**Guardian chat** (`send-guardian-message`):

| Today: 6 steps, one after another | After |
|---|---|
| 1. Check who is sending (login token) | 1. Check who is sending |
| 2. Am I in this chat? | 2. **At the same time:**<br>• everyone in this chat (one query answers both "am I in it?" and "who's the other person?")<br>• any guardian blocks involving me<br>• the blocked-words list (from memory, see option 3) |
| 3. Who's the other person? | |
| 4. Any block between us? (needs step 3) | |
| 5. Load the blocked-words list | |
| 6. Save the message | 3. Save the message |

- The block check doesn't need to wait for the other person anymore. It fetches all blocks involving me, then checks against the other person in code.
- **Result: 6 waits → 3.**

**Learner chat** (`send-message`):

| Today: 5 steps | After |
|---|---|
| 1. Check who is sending | 1. Check who is sending |
| 2. Is this learner mine? | 2. **At the same time:** is this learner mine? · am I in this chat? · blocked words |
| 3. Am I in this chat? | |
| 4. Load the blocked words | |
| 5. Save the message | 3. Save the message |

- **Result: 5 waits → 3.**
- The checks and their order of rejection stay the same: wrong user → not in chat → blocked → blocked word.

---

## 3. Option 3: keep the blocked-words list in memory

- A shared helper in `_shared/blockedWords.ts` loads the list once and keeps it for **5 minutes**. Messages sent in that window don't reload it.
- On the first message after a cold start, the list is fetched **at the same time as** the login check, so even then nothing waits for it.
- **Trade-off:** a word an admin adds or removes on the Blocked Words page takes **up to 5 minutes** to apply. Each function keeps its own copy, so the timing can differ slightly between learner chat and guardian chat. The time can be shorter, for example 1 minute.

---

## 4. Expected effect

- About **2–3 fewer database round trips per message**, roughly 150–400 ms faster.
- **Unchanged:**
  - cold starts (the first message after a quiet period is still slower)
  - the trip from the phone to Supabase
  - the app waiting for the server before showing the message (that's option 1)
- **The app doesn't change**; only the two server functions and the shared helper do.

---

## 5. Found while reading (could be fixed in the same change)

1. **Bug in `send-message`:** its error responses use `profileError` and `participantError`, which don't exist. When the "learner is mine" or "in this chat" check fails, the function crashes, so the app gets a 500 error instead of the proper "Access denied" (403).
2. **Learner chat doesn't check learner blocks.** Guardian chat refuses messages between blocked guardians, but `send-message` never checks `blocked_learners`. Today a block only works because the learner's Friends screen hides the blocked friend. Adding the check would be one more query in the parallel step, so it adds no wait.
3. **Disable Messaging isn't enforced on the server either** (`user_profiles.messaging_disabled` is only checked in the learner's Friends screen). It could be checked in the same parallel step, also at no extra wait.

---

## 6. Deploy and test

- Redeploy both functions: `supabase functions deploy send-message` and `supabase functions deploy send-guardian-message`.
- Test:
  - a normal message (learner and guardian chat)
  - a blocked word
  - guardian blocks
  - a message from someone who isn't in the chat

---

## 7. Guardian chat — done (direct insert, 2026-11-25)

- Migration **099**: insert rule on `guardian_messages` (send as yourself · participant · no guardian block via `private.guardian_conversation_blocked`) + `guardian_messages_before_insert` trigger (trim · reject empty · blocked words via `contains_blocked_word` · server `created_at`). Run on **West and East**.
- `GuardianChatScreen.tsx` inserts directly; refusal (42501) → neutral "This conversation is no longer available" (block not revealed).
- `send-guardian-message` is no longer used — delete it when convenient.

---

## 8. Learner chat — direct insert (same pattern) — **code done 2026-11-25**: migration **100** + `ChatScreen.tsx`; run 100 on West (and East), then test and delete `send-message`

### Finding: learner chat already has a weak direct-insert door
`messages` has the insert rule **"Participants can send messages"**: `WITH CHECK (owns_user_profile(sender_id))`. `owns_user_profile` is true for the learner's own login **or their guardian**, so either can insert straight into `messages` (outside the app) into **any** conversation — no participant, blocked-word, learner-block or Disable Messaging check. The `send-message` function is only the app's path. **Fix regardless of speed.**

### What the checks become
| Check | `send-message` today | New insert rule / trigger |
|---|---|---|
| Sender is my learner login | ✅ | ✅ `user_profiles.auth_user_id = auth.uid()` (learner login **only**) |
| Sender is in the conversation | ✅ | ✅ |
| Blocked words | ✅ | ✅ trigger (`contains_blocked_word`) |
| Learner block (`blocked_learners`, either way) | ❌ missing | ✅ new `private.learner_conversation_blocked()` |
| Disable Messaging (`messaging_disabled`) | ❌ app only | ✅ |
| Still friends | ❌ | ❌ **not added** (decided) |
| Reported learner | ❌ | ❌ **keep chatting** (decided) |

### Decisions (2026-11-25)
1. **Learner login only.** Learner mode signs the app in as the learner's own account (`LearnerSelectScreen.tsx:130`), so a guardian sending from the learner's chat **is the learner** to the database (`sender_id` = learner) — allowed. Guardian mode sending as the learner (the old loophole) — refused. Disable Messaging and learner blocks apply to whoever is in learner mode. Guardians can still **read** their learner's chats (read rule unchanged) and use the 🛡️ PIN actions (`guardian-action`).
2. **No "still friends" check** — a removed friend's chat isn't shown anyway.
3. **Reported learners: keep chatting.**
4. **Refusal wording** (block, messaging off, not a participant): "You can't send messages in this chat right now."

### Changes
1. **Migration (100)**
   - Drop "Participants can send messages"; create a new insert rule: sender = my learner login **and** participant **and** `NOT private.learner_conversation_blocked(conversation_id, sender_id)` **and** sender's `messaging_disabled` is false.
   - `private.learner_conversation_blocked()` — like the guardian helper: true if the sender and the other participant have a `blocked_learners` row either way (owner rights; not on the API).
   - Before-insert trigger on `messages`: trim · reject empty · blocked words → `BLOCKED_WORDS` · `created_at = now()` · `read_at = null`.
   - Still no update / delete rules.
2. **App — `ChatScreen.tsx` `sendMessage`**: `supabase.from('messages').insert({ conversation_id, sender_id: activeUser.id, content }).select().single()`; blocked word → existing kind-words banner + sound; refusal (42501) → "You can't send messages in this chat right now."; keep the duplicate check.
3. **Function**: delete `send-message` afterwards (also removes it from `supabase-keys.md`).
4. **Run** the migration on West (and East, to keep the fallback in step).

### Test
- normal message / symbol card / phrase → appears once, live on the other device
- blocked word → kind-words banner, nothing saved
- learner blocked either way → refused, including with the chat already open
- Disable Messaging on → refused (also when a guardian sends from learner mode)
- empty message → refused
- guardian-mode direct insert as the learner (API) → refused

---

## Open question

1. ~~Include fixes 1–3 from §5, or only options 2 and 3?~~ — superseded: guardian chat moved to direct insert (§7); learner chat planned the same way (§8), which covers fixes 1–3.
