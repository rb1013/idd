# Co-Heart

Co-Heart is a mobile platform for guardians supporting learners with intellectual and developmental disabilities (IDD). One app, two very different experiences:

- **Guardians** get a full-featured dashboard: they create and manage their learner's profile, set up the daily schedule and activities checklist, create or link learning tutorials, connect with other guardians, browse community events and discussions, manage their learner's friends, and oversee learner chat safety (block/delete/report, PIN-gated).
- **Learners** get a simplified, safety-first experience: today's schedule and activities to check off, tutorials assigned to them, and a friends/chat experience built around pre-set phrases and picture symbols instead of open-ended typing.

## Try it out

Want to experience the app for real? The app is already set up in TestFlight and is being actively tested — we can invite you to join our group of internal testers.

**⚠️ Currently iOS only.**

Send an email to **reyaansh.bansal@gmail.com** with the subject **"Co-Heart TestFlight"**, and we'll send you a TestFlight invitation. Please use the email address that's linked to your Apple account on your iOS device — that's the one the invitation needs to go to.

## Repo layout

This is an npm-workspaces monorepo:

- **`apps/mobile`** — the React Native / Expo app used by both guardians and learners (single codebase, mode-switching between the two — see below).
- **`apps/admin`** — a React web portal for Co-Heart staff/admins (tutorial moderation, content review).
- **`packages/supabase`** — Supabase backend: SQL migrations, RLS policies, and Deno edge functions.

Backend: Supabase (Postgres + Row Level Security + Edge Functions). Styling: a shared design system with a recurring "butterfly" color palette used across cards and tiles.

## How the one app serves two people

A guardian account has exactly one learner attached to it. The app has two modes on the same device: guardian mode, where the guardian manages everything from their own dashboard, and learner mode, which the guardian switches into and hands the device over for the learner to use directly. A "return to guardian" action switches back out of learner mode, signing back into the guardian's own session using stored credentials. Guardian screens and learner screens are deliberately different apps-within-the-app: guardians get full management/admin controls, while learner screens are simplified, larger-touch-target, and restrict open-ended input (e.g. no free-text chat — see Safety below).

---

## For Guardians

**Account & access**
- Sign-up requires an age/consent verification step (`GuardianVerificationScreen`) before an account can be created, plus email OTP verification.
- Guardian PIN — a 6-digit PIN set at registration, required to unlock guardian-only moderation actions from inside the learner's chat.

**Managing their learner**
- Create and edit their learner's profile (name, DOB, gender, county, likes/dislikes/abilities, languages, comprehension level, photo).

**Schedule**
- Set up recurring weekly classes (day, time, date range) and one-off events, or mark a single occurrence of a recurring class as cancelled.

**Daily Activities**
- Pick up to 10 activity presets (same checklist for all of a guardian's learners) for the learner to check off each day.
- A 7-day report shows completion history per learner; activity-log data is auto-deleted after 7 days.

**Tutorials**
- **AI-generated**: describe a target skill and core action; the system generates a slideshow tutorial (subject to a guardian-configurable monthly quota) and queues it for admin approval before it's visible to other guardians.
- **Link a YouTube video**: embed a public YouTube video as a tutorial directly (no admin approval needed, since no new content is generated). **These linked videos are always private** — visible only to the guardian who linked them and their own learner, never to any other guardian or learner.
- Browse a shared library of admin-approved tutorials from all guardians and link any of them to a learner.

**Guardian network**
- Connect with other guardians (connection requests, a "Find" tab with name/county/Regional Support Category filters), then message connected guardians directly.
- A "sneak peek" bottom sheet (photo, name, county, Regional Support Category tags) lets a guardian see who someone is before connecting, without exposing full profile details until connected.

**Learner's friends**
- Manage who a learner is friends with — review/accept friend requests, search/discover other learners, view a public profile summary for any connection (including that learner's own guardian's info).

**Community**
- **Events**: browse/create community events with RSVP (going/interested/not going), with category and date filters.
- **Discussions**: a forum-style board for guardians to post topics and reply; guardians can edit/delete their own posts.
- **Resources**: a static library of informational/support content.

## For Learners

**Home**
- A simplified dashboard greeting the learner by name, showing today's full class schedule (color-coded: happening now, upcoming, already finished) and daily activity progress, plus a mood picker.

**Activities**
- The day's checklist (set up by their guardian) to mark off as completed.

**Friends**
- A friends list/discovery view scoped to the learner's own experience.

**Tutorials**
- View tutorials linked to them by their guardian, in a video player or an auto-advancing slideshow player with narration.

**Chat & communication**
- Free-text typing is disabled. Communication happens through a fixed set of pre-written phrases and AAC/picture-symbol cards (a communication board), not open typing.
- Both an on-device and a server-side profanity filter still run as a defense-in-depth check on whatever is sent — but since there's no free typing, there's little for them to actually catch in practice; they mainly guard against the pre-set phrase/symbol content itself ever being unsafe, not user-authored text.
- A guardian can step in (PIN-gated, verified server-side) to block a user, delete a chat, or report a user from inside the learner's own chat screen.

**Profile**
- Learners have no profile screen of their own — their profile is set up and fully managed by their guardian; the learner can't view or edit it.

---

## Safety & data-handling notes

- Guardian signup requires explicit age/consent verification before an account exists.
- Learner chat has no free-text typing — only pre-set phrases and AAC picture symbols — with profanity filtering as an additional defense-in-depth layer.
- Guardian moderation actions on learner chats (block/delete/report) are gated behind the guardian's own PIN, verified server-side.
- YouTube-linked tutorials are private to the guardian/learner pair that created them — never shared with or visible to anyone else.
- Activity completion logs are automatically deleted after 7 days.
- All data access is governed by Postgres Row Level Security policies in `packages/supabase/migrations/`.

## Getting started (developers)

```bash
npm install                        # from repo root — installs all workspaces
cd apps/mobile && npx expo start   # run the mobile app
cd apps/admin && npm run dev       # run the admin portal
```

Supabase migrations (`packages/supabase/migrations/*.sql`) and edge functions (`packages/supabase/supabase/functions/`) are applied manually via the Supabase Dashboard — they are not run automatically as part of any build step.
