# IDD Mobile App — Todo List

All items below have been implemented.

## ✅ Database Migrations

- [x] Add `last_seen_at` to `user_profiles` — `008_last_seen_at.sql`
- [x] Add `requester_pinned` / `addressee_pinned` to `friendships` — `009_friendships_pinned.sql`
  - Two separate columns so each side of a friendship can independently be pinned

## ✅ App

- [x] Update `last_seen_at` on login and on app foreground (`AppState` listener in `AuthContext`)

## ✅ Home Screen (`UserHomeScreen`)

- [x] 2×2 tile grid: Friends 🤝 · Messages 💬 · My Mood 😊 · Learn 📚
- [x] Messages tile is a placeholder (no action on click, slightly dimmed)
- [x] Mood tile opens inline picker (😊 😔 😡 😴)
  - Long-press each emoji speaks the mood name via TTS (soft volume)
  - Tap to select — chosen emoji appears as badge on avatar (top-right)
  - Bold ✕ button dismisses the picker
  - No navigation to a child page

## ✅ Friends Hub (`FriendsHubScreen`)

- [x] Single-column full-width cards
- [x] Name only on card (city and status text removed)
- [x] Likes emoji row below name (max 4, no dislikes shown)
  - Category → emoji map: Music 🎵, Sports ⚽, Art 🎨, Cooking 🍳, Movies 🎬, Reading 📚, Dancing 💃, Gaming 🎮, Animals 🐾, Nature 🌿, Swimming 🏊
- [x] Long-press friend's name → speak name via TTS
- [x] Long-press individual likes emoji → speak that like's label via TTS
- [x] 🔊 Speaker button speaks full intro: *"Rahman. Likes: Music, Gaming, Animals"*
- [x] Sort: Pinned → Online → Offline (A–Z within each group), shown under Favourites / All Friends section headers
- [x] ⭐ pinned badge + gold border on favourited cards
- [x] Online status ring: green if `last_seen_at` within 5 min, gray otherwise
- [x] Tap full card to open chat (no separate chat button)
- [x] Search icon removed from header

## ✅ Guardian — Edit User Screen (`EditUserScreen`)

- [x] New **Favourite Friends** step added to guardian flow (between Health and Account)
  - Lists all accepted friends with pin toggle (⭐)
  - Max 3 pinned — shows alert if limit reached
  - Displays current pin count (e.g. "2/3 pinned")
  - Saves `requester_pinned` or `addressee_pinned` column depending on friendship direction

---

> **Next steps:** Run the two new migrations (`008`, `009`) in Supabase before testing.
