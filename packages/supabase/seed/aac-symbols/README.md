# AAC picture symbols (learner chat board)

The 25 picture symbols shown on the learner chat board. They are uploaded **once, manually** to the
public Supabase Storage bucket **`aac-symbols`** (Storage → aac-symbols → upload these files with
the same names), and listed in the **`aac_symbols`** table (migration `095_aac_symbols.sql`, column
`image_path` = file name). The app loads them from Storage; it no longer searches OpenSymbols.

Keep this folder as the source of truth: if a symbol is replaced, replace the file here too.

## Source and license

All 25 are **ARASAAC** pictograms, downloaded via OpenSymbols (opensymbols.org) on 2026-11-22.

> The pictographic symbols used are the property of the Government of Aragón and have been created
> by Sergio Palao for ARASAAC (arasaac.org), which distributes them under a Creative Commons
> **BY-NC-SA** license.

Non-commercial: fine while Co-Heart is free and ad-free; revisit if it ever charges. Shown unmodified
(ShareAlike applies only to modified versions). Credit: `docs/credits.md` and the privacy page.

## Files

| File | Label | Original ARASAAC file (OpenSymbols CDN `libraries/arasaac/…`) |
|---|---|---|
| hello.png | Hello | hello.png.varianted-skin.png |
| goodbye.png | Goodbye | goodbye.png.varianted-skin.png |
| happy.png | Happy | happy.png.varianted-skin.png |
| sad.png | Sad | sad.png.varianted-skin.png |
| tired.png | Tired | tired.png.varianted-skin.png |
| angry.png | Angry | angry.png.varianted-skin.png |
| yes.png | Yes | yes_2.png |
| no.png | No | no_1.png *(re-picked: red ✕; was "no entry" sign)* |
| help.png | Help | help_4.png.varianted-skin.png |
| thank_you.png | Thank you | thanks.png.varianted-skin.png *(re-picked; was handshake)* |
| hug.png | Hug | to embrace.png.varianted-skin.png *(re-picked; was Sclera)* |
| love.png | Love | love.png.varianted-skin.png |
| hungry.png | Hungry | hungry.png.varianted-skin.png |
| play.png | Play | to play.png *(re-picked; was "to play volleyball")* |
| wait.png | Wait | wait.png |
| bathroom.png | Bathroom | toilet bowl.png |
| water.png | Water | glass of water.png |
| eat.png | Eat | to eat_1.png.varianted-skin.png |
| drink.png | Drink | to drink.png.varianted-skin.png |
| sleep.png | Sleep | to sleep_2.png.varianted-skin.png |
| more.png | More | more_1.png |
| stop.png | Stop | stop_4.png *(re-picked; was Sclera. Note ARASAAC "stop.png" is a bus stop)* |
| please.png | Please | please.png.varianted-skin.png |
| sorry.png | Sorry | sorry.png |
| friend.png | Friend | friend_2.png.varianted-skin.png |
