# Co-Heart — Credits & Licenses

**Last updated:** 2026-11-22
**Published:** on the website privacy page (yianetwork.org/co-heart/privacy), and in `PRIVACY_POLICY_AND_TERMS.md` (Part 3). Keep all three in sync.

## Before publishing — confirm the **[bracketed]** items
1. **Symbols:** check which libraries the learner chat's picture symbols come from (OpenSymbols shows the source and license on each symbol's page). Keep the matching lines, delete the rest. ARASAAC is almost certainly included.
2. **Non-commercial licenses** (ARASAAC, Sclera): fine for a free, ad-free app; revisit if Co-Heart ever charges.
3. **Word list:** confirm where `apps/mobile/src/lib/badWordsList.json` came from; if it isn't LDNOOBW, replace that line.

## Where each item is used in the code
| Item | Code |
|---|---|
| OpenSymbols search API | `apps/mobile/src/lib/aacSymbols.ts` (`fetchRemoteSymbol`) |
| bad-words / badwords-list | `apps/mobile/src/lib/contentFilter.ts` (npm `bad-words` ^4.1.5) |
| Extra word list | `apps/mobile/src/lib/badWordsList.json` |
| YouTube embeds | `apps/mobile/src/components/YoutubePlayer.tsx` |
| OpenAI images, Google TTS | `packages/supabase/supabase/functions/process-tutorial-job`, `regenerate-frame`, `_shared/tts.ts` |

---

## Text for the website (Credits & Licenses section)

Co-Heart uses the following third-party content and open-source software. We thank their creators.

### Picture symbols (learner chat)
The picture-symbol cards learners use to chat are found through **OpenSymbols** (opensymbols.org), a free service that gathers symbols from open symbol libraries. Each symbol remains the property of its creator and is used under its own license:

- **ARASAAC:** The pictographic symbols are the property of the Government of Aragón and were created by Sergio Palao for ARASAAC (arasaac.org), which distributes them under a Creative Commons BY-NC-SA license.
- **Mulberry Symbols:** by Steve Lee, licensed under CC BY-SA 2.0 UK. **[confirm used]**
- **Twemoji:** by Twitter, Inc. and other contributors, licensed under CC BY 4.0. **[confirm used]**
- **Sclera Pictograms:** by Sclera vzw, licensed under CC BY-NC 2.0 BE. **[confirm used]**

### Content filtering
To help keep conversations kind, Co-Heart checks text against lists of inappropriate words:

- **bad-words** (JavaScript library) by Michael Price, MIT License.
- **badwords-list**, MIT License.
- **"List of Dirty, Naughty, Obscene, and Otherwise Bad Words"** by Shutterstock, licensed under CC BY 4.0 (github.com/LDNOOBW). **[confirm this is the source of the extra word list]**

These lists are used only to block words. They are never shown to users.

### Videos, images and narration
- **YouTube** videos linked by guardians are shown through YouTube's embedded player and are subject to the YouTube Terms of Service. YouTube and its videos belong to their respective owners.
- **AI tutorial images** are created with OpenAI's image models, and **narration audio** is created with Google Cloud Text-to-Speech.

### Open-source software
Co-Heart is built with open-source software, including **React Native** and **Expo** (MIT License) and the **Supabase** client libraries (MIT License). A full list of open-source components and their licenses is available on request at **coheartsupport@gmail.com**.

All trademarks belong to their respective owners.
