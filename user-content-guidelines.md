# User Content Guidelines — Chat Message Filtering

## Context

Chat in the ELIS app is used by IDD users. Since this is a vulnerable user group, all text messages must be filtered against inappropriate content before delivery.

---

## Chosen Approach: Two-Layer Filtering (Option 1 + Option 2)

### Layer 1 — Client-side (`bad-words` npm package)

- Runs instantly on device before the message leaves the app
- Catches the bulk of common profanity from the package's built-in list
- User gets immediate inline feedback with no network delay
- Base list cannot be updated without an app release
- Supports customization:
  - `filter.addWords('word1', 'word2')` — add to base list
  - `filter.removeWords('word1', 'word2')` — whitelist words (useful for IDD context where some words may be innocent false positives)
  - `new Filter({ list: [...] })` — replace entire list with custom one

### Layer 2 — Server-side (Supabase Edge Function + `blocked_words` table)

- Edge Function acts as gatekeeper before inserting into the `messages` table
- Checks message against custom additions managed by admin via admin portal
- List can be updated anytime without touching the app
- Edge Function handles **both validation and message insertion** (client cannot bypass the check by calling insert directly)

---

## Message Flow

```
User taps Send
  → Client checks bad-words list
      → Blocked? Show inline error. Stop.
  → Passes client → Call Edge Function with message text
      → Server checks blocked_words table
          → Blocked? Return error, show to user. Stop.
      → Passes server → Insert into messages table → Message appears in chat
```

---

## Storage: Custom Word List

Dedicated Supabase table:

```sql
CREATE TABLE blocked_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES guardians(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Managed via admin portal UI — no app release needed for additions/removals.

---

## Edge Function Notes

- Deno runtime cannot use the `bad-words` npm package directly
- Clean separation: client handles `bad-words` base list, Edge Function handles custom `blocked_words` table only
- Edge Function loads custom list from DB at runtime and checks against it

---

## Admin Management

- Small UI in React admin portal to add/remove words from `blocked_words` table
- Optional: audit trail via `added_by` and `created_at` columns

---

## Error UX — Blocked Message Feedback

### Where to show it

Inline banner **just above the text input** — not a modal (too disruptive, IDD users may not know how to dismiss) and not a toast (disappears too fast). The banner stays visible while the learner re-types.

### Message content

Simple, non-shaming, positively framed. Avoid words like "inappropriate," "blocked," "rejected," or "flagged" — they feel punishing.

> **"Let's use kind words 😊"**

- Short, one clear ask
- No explanation of what was wrong (avoids teaching filter evasion)

### Audio — two parts

1. **Soft chime** — gentle sound (not an error beep) played first via `expo-av` using a bundled audio file
2. **TTS via `expo-speech`** — speaks the message at a slow, warm rate after the chime (100–200ms delay)

```ts
await Audio.Sound.createAsync(require('../assets/sounds/gentle-chime.mp3'));
Speech.speak("Let's use kind words!", {
  rate: 0.75,
  pitch: 1.1,
});
```

Audio plays automatically when the banner appears — no user action needed.

### Behaviour

- Banner appears + chime + TTS play automatically on blocked send
- Text input is **not cleared** — learner edits what they typed rather than starting over
- Banner disappears as soon as the learner starts editing again
- If they hit send again and still blocked, repeat audio + banner

### What to avoid

- Red colour on banner — alarming for some IDD users. Use amber/yellow instead.
- Technical language ("filter", "system", "flagged")
- Auto-clearing the learner's message
