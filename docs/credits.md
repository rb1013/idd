# Co-Heart — Credits & Licenses

**Last updated:** 2026-11-22 (symbols: ARASAAC only)
**Published:** on the website privacy page (yianetwork.org/co-heart/privacy), in the app (`apps/mobile/src/constants/legalContent.ts` → footer → Credits & Licenses), and in `PRIVACY_POLICY_AND_TERMS.md` (Part 3). Keep all in sync — the website is the master.

## Notes
1. **Symbols (confirmed 2026-11-22):** all 25 picture symbols are **ARASAAC** pictograms, reviewed and stored in our own Storage (`aac-symbols` bucket; files in `packages/supabase/seed/aac-symbols/`, see its README). The app no longer searches OpenSymbols. If a symbol from another library is ever added, add its credit here.
2. **Non-commercial license** (ARASAAC, CC BY-NC-SA): fine for a free, ad-free app; revisit if Co-Heart ever charges. Symbols are shown unmodified (ShareAlike only applies to modified versions).
3. **Word list (confirmed 2026-11-22):** `apps/mobile/src/lib/badWordsList.json` is from the LDNOOBW English list (260 of its 261 words, same order; "booty" was added by us). The server `blocked_words` table is our own admin-entered data, not a third-party list.
4. **Website timing:** publish this version (and remove OpenSymbols from §5 Service providers) once the app build that loads symbols from our Storage is live; earlier builds still contact OpenSymbols.

## Where each item is used in the code
| Item | Code |
|---|---|
| ARASAAC symbols (our Storage) | `apps/mobile/src/lib/aacSymbols.ts` (`refreshBoard`), table `aac_symbols` (migration 095) |
| bad-words / badwords-list | `apps/mobile/src/lib/contentFilter.ts` (npm `bad-words` ^4.1.5) |
| Extra word list | `apps/mobile/src/lib/badWordsList.json` |
| YouTube embeds | `apps/mobile/src/components/YoutubePlayer.tsx` |
| OpenAI images, Google TTS | `packages/supabase/supabase/functions/process-tutorial-job`, `regenerate-frame`, `_shared/tts.ts` |

---

## Text for the website (Credits & Licenses section)

Co-Heart uses the following third-party content and open-source software. We thank their creators.

### Picture symbols (learner chat)
The picture symbols learners use to chat are **ARASAAC** pictograms (obtained via OpenSymbols, opensymbols.org). The pictographic symbols are the property of the Government of Aragón and were created by Sergio Palao for ARASAAC (arasaac.org), which distributes them under a Creative Commons BY-NC-SA license. They are shown unmodified.

### Content filtering
To help keep conversations kind, Co-Heart checks text against lists of inappropriate words:

- **bad-words** and its word list **badwords-list**, by Michael Price, MIT License.
- **"List of Dirty, Naughty, Obscene, and Otherwise Bad Words"** by Shutterstock, licensed under CC BY 4.0 (github.com/LDNOOBW).

These lists are used only to block words. They are never shown to users.

### Videos, images and narration
- **YouTube** videos linked by guardians are shown through YouTube's embedded player and are subject to the YouTube Terms of Service. YouTube and its videos belong to their respective owners.
- **AI tutorial images** are created with OpenAI's image models, and **narration audio** is created with Google Cloud Text-to-Speech.

### Open-source software
Co-Heart is built with open-source software, including **React Native** and **Expo** (MIT License) and the **Supabase** client libraries (MIT License). A full list of open-source components and their licenses is available on request at **coheartsupport@gmail.com**.

All trademarks belong to their respective owners.
