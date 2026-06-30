# IDD Mobile App — Todo List

## Database Migrations

- [ ] Add `last_seen_at` to `user_profiles`
- [ ] Add `is_pinned` to `friendships` (max 3 per guardian)

## App

- [ ] Update `last_seen_at` on app foreground (AppState listener)

## Home Screen (`UserHomeScreen`)

- [ ] Add **Messages** tile as placeholder (no action on click)
- [ ] Add **Mood** tile — inline emoji picker (😊 😔 😡 😴)
  - On hover / long-press each emoji, speak the mood name in a soft tone via TTS
  - On select, set the chosen emoji as a badge on the avatar (top-right of header)
  - Dismiss via thick bold ✕ icon (tooltip: "Cancel" on hover)
  - No navigation to a child page

## Friends Hub (`FriendsHubScreen`)

- [ ] Switch to single-column full-width cards
- [ ] Show name only on card (remove city and status text)
- [ ] Show likes emoji row only below name (max 4 — no dislikes shown)
- [ ] On hover / long-press over friend's name, speak the name via TTS
- [ ] On hover / long-press over individual likes emoji, speak that like's label via TTS
- [ ] 🔊 Speaker button speaks friend's name then their likes via TTS
      e.g. *"Rahman. Likes: Music, Gaming, Dogs, Pizza"*
- [ ] Sort order: Pinned → Online → Offline (A–Z within each group)
- [ ] Show ⭐ pinned badge on favourited cards
- [ ] Online status ring: green if `last_seen_at` within 5 min, gray otherwise
- [ ] Tap full card to open chat (no separate chat button)
- [ ] Remove search icon from top-right header

## Guardian — Edit User Screen (`EditUserScreen`)

- [ ] Add pin / unpin friend option (max 3 pinned per guardian)
