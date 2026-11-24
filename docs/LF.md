# Find Friends & Manage Friends — test cases

**Screens:** `FindFriendsScreen.tsx` (new), `LearnerFriendsScreen.tsx` (Manage Friends), `GuardianHomeScreen.tsx` (tiles), `LearnerPublicProfileScreen.tsx`
**Plan / background:** [learnerFriend.md](learnerFriend.md) §7–§9

**Setup:** three guardian accounts, each with one learner:

| Guardian | Learner |
|---|---|
| **Avantika** | **Shahin** |
| **Ceasar** | **Julia** |
| **Sam** (block and report cases) | **Sara** |

**How blocking / reporting a learner works:** a learner can't block or report. The **guardian** does it from the **learner's chat**: Shahin and Sara must be friends → open Shahin's chat with Sara → 🛡 guardian actions (Avantika's PIN) → **Block User** or **Report User** → reason → confirm. Blocking doesn't remove the friendship.

Run migration **096** first. Test with a **non-admin** guardian.

---

## Dashboard
| # | Steps | Expected |
|---|---|---|
| D1 | Log in as Avantika, open Home | Learner zone shows **Find Friends 🔍** and **Manage Friends 👥** as separate full-width rows; the page scrolls |
| D2 | Ceasar sends Julia → Shahin a request; Avantika opens Home | Badge with the count shows on **Manage Friends** only |
| D3 | Tap each row | Opens a screen titled "Find Friends" / "Manage Friends" |
| D4 | Phone and iPad | Rows aren't cut off, and the text wraps cleanly |

## Find Friends
| # | Steps | Expected |
|---|---|---|
| F1 | Open Find Friends (first time) | Spinner, then the list. Your own learner isn't in it. |
| F2 | Card contents | Photo with **"N yrs" below**, name, county, "Guardian: …" |
| F3 | Learner with no DOB or no photo | No age line; a coloured initial instead of the photo |
| F4 | Name search "be" | Only matching names; the count updates |
| F5 | County pill → pick a county | Only that county's learners |
| F6 | More Filters | Only 3 sections: **Age Group, Likes, What can they do?** (no Dislikes, no Comprehension Level) |
| F7 | Pick a Like | Only learners with that like; a chip shows; ✕ on the chip removes it; Clear all resets |
| F8 | Combine a like and an ability | A learner must match both filter groups |
| F9 | Tap 🤝 on Julia | Spinner on the button → "Request sent!" alert → the card shows **Pending** |
| F10 | Tap Julia's card | Opens Julia's profile, which says "Request sent — waiting…" |
| F11 | Back from the profile | **No full-screen spinner**; the list stays and refreshes quietly |
| F12 | Ceasar sent Julia → Shahin (pending) | Julia **isn't listed** in Avantika's Find (incoming requests are hidden; handled in Manage Friends) |
| F13 | Shahin and Julia are friends | Julia isn't listed in Find |
| F14 | Avantika blocks Sara from Shahin's chat (see Setup) → Find Friends | Sara isn't listed |
| F15 | Avantika reports Sara from Shahin's chat (see Setup) → Find Friends | Sara isn't listed (see the note at the end) |
| F16 | Many learners (more than one page) | "Load N more" shows, and the list resets to the top when filters change |
| F17 | Avantika blocked guardian Ceasar (Connections) | Julia's card shows **no Guardian line** (the name is hidden) |

## Manage Friends: loading
| # | Steps | Expected |
|---|---|---|
| M1 | Open Manage Friends | Tabs: **Friends · Requests · Blocked** (no Find). Spinner in the tab area only, not over the tab bar. |
| M2 | Open Requests for the first time | Spinner once, then the list |
| M3 | Switch back to Friends | No spinner; the list stays |
| M4 | Open a friend's profile → back | No spinner; the current tab refreshes quietly and keeps its scroll position |
| M5 | Send a request on Find Friends → go to Manage Friends › Requests › **Sent** | The new request is listed (**the original bug**) |

## Friends tab
| # | Steps | Expected |
|---|---|---|
| T1 | No friends | "No friends yet" and "Use 'Find Friends' tile on dashboard to add friends for your learner" (no button) |
| T2 | Has friends | Card: photo with age below, name, county, "Guardian: …" |
| T3 | The friendship was sent **by** Shahin, or **to** Shahin | Shows the **other** learner either way, never Shahin |
| T4 | ✕ on a card → Remove | The friend disappears. On Find Friends, they're back with 🤝. |
| T5 | Avantika blocks Sara from Shahin's chat → Manage Friends › Friends | Sara is hidden. After Unblock (Blocked tab), Sara is back. |
| T6 | Avantika reports Sara from Shahin's chat → Manage Friends › Friends | Sara shows a "⚠️ Reported" pill; the ⓘ icon shows the reason |

## Requests tab
| # | Steps | Expected |
|---|---|---|
| R1 | Julia → Shahin pending; Avantika opens Requests › Received | Julia listed (age, county, guardian); badge on Received and on the Requests tab |
| R2 | **Accept** | "Connected!" alert; the request is removed; the Friends tab shows Julia; Find no longer lists Julia |
| R3 | **Decline** → confirm | The request is removed |
| R4 | After R3, Ceasar checks | Ceasar's Sent tab **no longer shows the request**; Ceasar gets **no notification** |
| R5 | After R3, Find Friends (both Avantika and Ceasar) | Each shows the other with **🤝** (not "Pending"); a new request can be sent |
| R6 | After R3, Julia's profile (as Avantika) | "Send Friend Request" (not "waiting") |
| R7 | Sent tab → **Cancel** | Removed; Find shows 🤝 again for that learner |
| R8 | Empty Received or Sent | Empty message; Received hint mentions "Find Friends" |
| R9 | Julia → Shahin pending; open Julia's profile | Nothing at the bottom — no "Respond" button, no message, no empty box (accept / decline only in Manage Friends › Requests) |
| R10 | Received → tap Julia's card (not a button) | Opens Julia's profile (nothing at the bottom); back → Requests tab, no spinner |
| R11 | Sent → tap a card (not Cancel) | Opens that learner's profile ("Request sent — waiting…"); Accept / Decline / Cancel still work on their own |

## Blocked tab
| # | Steps | Expected |
|---|---|---|
| B1 | No blocks | "No blocked users" |
| B2 | After T5's block | Sara listed with name, photo, reason |
| B3 | Unblock → confirm | Removed. The learner reappears on Friends (if still friends) or on Find. |

## Data and migration
| # | Steps | Expected |
|---|---|---|
| X1 | Before 096: a `rejected` row exists. Run 096. | Row deleted; any notification for it stays (`friendship_id` is cleared) |
| X2 | After 096 | `select count(*) from friendships where status='rejected'` = 0 |
| X3 | Older app build declines a request | The row becomes `rejected`. New-build Find treats it as no request (🤝). Ceasar gets a "declined" notification (the known gap). |

---

## Note on F15 and T6
Guardians may not be able to read the `reports` table: it has read rules only for admins and learners (`053_reports.sql`). If F15 and T6 fail on a **non-admin** guardian account, that's the cause; it isn't new. Test with a non-admin guardian, since an admin account would pass and hide the problem.

**Also note for F14 / F15:** because blocking and reporting are done from a chat, Sara is already Shahin's friend — and Find never lists friends anyway. So F14 / F15 only prove something if the friendship is gone (e.g. Sam removes Shahin from Sara's friends with ✕ in their Manage Friends) while the block / report stays.
