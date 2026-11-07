# Kakvo — project status (handoff note)

Last updated: 7 November 2026, version 0.2.6. Live at https://diomedeast.github.io/Kakvo/ (GitHub Pages, branch `main`, root).

## What Kakvo is
A free web app (PWA) for Bulgaria that explains what is in a food product in plain Bulgarian. Owner: Mo, sold by BonbelleGroup.
- No overall score. Only official sources (EU regulations, EFSA, WHO/IARC, UK FSA traffic-light criteria).
- Sugar shown as sugar cubes (1 cube ≈ 4 g). Aimed at parents. Positioned as different from Yuka (not available in Bulgaria).
- Look: "Fresh market v2" — green #246B2A, fonts Geologica (headings) and Onest (text), 3D sugar cubes.

## How it works
- Static site, no build step: `index.html`, `css/app.css`, `js/config.js`, `js/engine.js` (logic, also runs in node), `js/app.js` (views, hash routes), `data/library.json` (241 additives, 504 ingredients, from Mo's spreadsheet; ODbL), `data/explain.json` (Kakvo's own plain-Bulgarian explanations, see below), `sw.js` (bump `CACHE` on every release), `manifest.webmanifest`.
- Barcode: native BarcodeDetector, else bundled `vendor/zxing-browser.min.js`. Camera asks for 1920×1080, continuous focus, 2× zoom, torch button. Product data from Open Food Facts API v2.
- Photo flow: ingredients photo → auto-rotate if sideways → user frames the Bulgarian text → Tesseract.js 7 (`bul`, page mode 6) → keep only the Bulgarian part (`extractBulgarian`) → user checks text → **asks for the nutrition-table photo (or skip)** → frame the numbers → Tesseract `eng` → `parseNutrition` (EU row order Annex XV, portion-column cross-check, energy check Annex XIV) → user confirms numbers (unsure ones in orange) → one combined result.
- English ingredient lists are recognised; "read in English" fallback if no "Съставки" is found.
- If too little is recognised, the result says "Не успяхме да разчетем…" instead of a false all-clear.

## Ingredient explanations (v0.1.6)
- Result screen has "Какво ядеш: съставка по съставка": every ingredient and additive in label order, one plain line each, allergen marked; tap → `#/i/<tag>` (ingredient) or `#/a/<code>` (additive) with "Какво е", "Защо е в храната", allergen box and "Добре е да знаеш" notes with sources.
- Content lives in `data/explain.json`: 127 ingredients + 51 additives (the most common in Bulgaria). Fields: `w` what it is, `j` why it's there, `x` allergen (Reg. 1169/2011 Annex II), `n` notes with sources, `b`/`fr`/`en` extra label spellings, `v` variants (e.g. soy vs sunflower lecithin).
- Rule: plain descriptions need no source; any health/legal claim must be a note with an official source (EU regulations, EFSA, WHO, Codex). Sources used so far: Reg. 1169/2011, 1334/2008, 231/2012, 2023/2108; EFSA (lecithins 2017, nitrites 2017, palm-oil contaminants 2016); WHO (salt, sugars 2015); Codex CXS 280 (anhydrous milk fat).
- French labels are recognised for the explained items and the usual role words ("émulsifiant", "poudres à lever"…). "готварска сол" is now recognised (was unknown before).
- v0.1.7, tested on a real label (Lidl Sondey cocoa biscuits, `tests/photos/sondey-biscuits-ingredients.jpg`): all 19 ingredients recognised, typed and from the photo.
  - Brackets: "растителни масла (от палма, соя)" → palm oil + soybean oil (refined soybean oil is not an allergen, Annex II); "лецитини (соеви)" → soy allergen on E322.
  - Footnotes: "*", "**", "***" definitions are linked to the starred ingredients and explained when we know the term (`gloss` in explain.json: "подово отглеждане", Rainforest Alliance, "устойчиво"…). From photos the stars become quote marks, so footnote lines are shown as "Етикетът пише" notes instead.
  - Text before "Съставки:" (product name) is ignored; traces split per allergen; short OCR garbage dropped.
  - Photo test: `tests/sondey-photo-e2e.js` (needs Tesseract files in /tmp/pk: `npm pack tesseract.js@7.0.0 tesseract.js-core@7 @tesseract.js-data/bul @tesseract.js-data/eng`, unpack dist/core to /tmp/pk/t, /tmp/pk/core and the .traineddata.gz files to /tmp/pk).
- v0.1.8, found by Mo on the live site: some Open Food Facts entries have a broken ingredient list (Sondey biscuits: Italian OCR garbage, no Bulgarian text). Now: English/French list used if there is no Bulgarian one and it reads well; paragraph-long "ingredients" are never shown; if the list is unusable the page says so, hides the list and warnings, and "Снимай състава" keeps the product name and database nutrition (straight to the result, no table photo). Test: `tests/bad-off-e2e.js`.
- v0.1.9 (Mo's decision): barcode with no Bulgarian list in Open Food Facts → "Снимай състава на опаковката" screen first (photo, type it, or "Виж само данните от базата" = `#/p/<code>?db=1`). The photo result keeps the product name and database nutrition, opens as the product page, and is saved on the phone per barcode (`localStorage kakvo_labels`, last 50), so the next scan is explained at once. Database additive/allergen tags are not mixed into a photo-based result. Not shared with other users or sent to Open Food Facts (would need a server/account).
- v0.2.4 (7 Nov 2026): explanations for every unexplained ingredient found in ≥1% of products and every additive in ≥0.4% (plus E251): now 241 ingredients + 80 additives. New sources: EFSA nitrates 2017 (E251/E252), EFSA phosphates 2019 (E339–E341), Reg. 2019/649 (trans fats, note on hydrogenated fats). New allergen group `sulphites` (E220, E223, E224); the engine now reads `x` on additives too, not only on variants. Label spellings that already belonged to another item were left out on purpose.
- Not yet: kid-mode lines for ingredients, explanations for the remaining ~263 rarer ingredients and ~161 additives (they show "Още нямаме подробно обяснение").

## Nutrition tables in several languages (v0.2.5)
- Found by Mo (Nasladki fig biscuits, `tests/photos/nasladki-nutrition-5-languages.jpg`): rows in 5 languages wrap over 2–3 lines and the table grid made Tesseract skip rows → "could not read the numbers".
- Now: if the first reading is incomplete, the app reads again with the grid lines erased (`eraseGrid` in app.js), then in "columns" mode (page mode 4), and `mergeNutrition` combines the readings field by field: values that agree win, and the label's own maths decides (energy adds up, saturated ≤ fat, sugars ≤ carbs). Changed or split values ("0, 9") are marked orange.
- Parser: nutrient words in DE/NL/ES/FR/IT; a number alone on a line takes the name from the line above; "-от" read as "-0T" is ignored; "432 7 kcal" = 432,7; "32,89" without g = 32,8 g.
- v0.2.6 (second photo of the same box, `tests/photos/nasladki-nutrition-photo2.jpg`; Mo saw saturated fat 3,9, marked orange): energy is checked against kJ (1 kcal = 4,184 kJ) and numbers over 900 kcal / 3800 kJ lose a digit ("4327" → 432,7); "kal" accepted; a short number at the start of a line before a word ("07 Kou1o", "| 07 Koto" = "-от които") is ignored; "J, 1" = "0,1"; table edges ("|") stripped; guessed decimals and a final 9 that may be a "g" are marked orange; the energy-fit tolerance now prefers the closest fit. Both photos: all values right in the app (photo 2: salt left empty). Tests: `tests/nut-5lang-e2e.js`, `tests/nut-5lang-photo2-e2e.js`.
- Saturated fat and sugars cannot be checked by the energy maths: they rely on agreement between readings (orange when they disagree) and on sat ≤ fat, sugars ≤ carbs.
- On that photo all values are right except salt (1 or 0,9 instead of 0,1), which is marked "провери". Tests: `node tests/engine.test.js`, `tests/nut-5lang-e2e.js`. Worst case 4 readings: slower on old phones.

## Sharing photos with Open Food Facts (v0.2.0, built, not switched on)
- Mo said yes. After a "Снимай състава" photo for a scanned product, a ticked-by-default "Сподели с Open Food Facts" box sends the framed label photo (JPEG, ≥640×160) and the checked Bulgarian text to `worker/contribute.js` (Cloudflare Worker), which writes to Open Food Facts with the app account: photo as `ingredients_bg` (or `other` if one exists), text only if the product has none. Never replaces data. Anonymous per-phone `app_uuid`. Offline → outbox of 5, retried on next start.
- **LIVE since 7 Nov 2026**: worker uses `OFF_BASE=https://world.openfoodfacts.org`; Mo's phone test with Sondey (4056489257967) got "Благодарим!". The earlier 403s (test and live) were a wrong stored password ("Incorrect user name or password" in the log); v0.2.4 worker trims spaces/line breaks around OFF_USER/OFF_PASSWORD — paste the new worker/contribute.js into Cloudflare when convenient.
- Switched on 3 Nov 2026 (v0.2.1), first on the Open Food Facts TEST server: worker `https://kakvo-contribute.mimo-ray83-ae3.workers.dev/` on Mo's Cloudflare account (mimo.ray83), OFF accounts `kakvoapp` on .org and .net. To go live: set `OFF_BASE` to `https://world.openfoodfacts.org` and the .org password in `OFF_PASSWORD` (Cloudflare → kakvo-contribute → Settings → Variables and secrets).
- Original setup steps (done) in `worker/README.md`: Open Food Facts app account (+ API usage form), Cloudflare account, `wrangler secret put OFF_USER/OFF_PASSWORD`, `wrangler deploy`, then the worker address into `CONTRIBUTE_URL` in `js/config.js`. Worker starts on the OFF test server; switch `OFF_BASE` to live after one test.
- Tests: `node tests/worker.test.mjs`, `node tests/bad-off-e2e.js` (fake OFF on :8790, worker on :8791).
- v0.2.2 (after Mo's real phone test): text sent to OFF stops before footnotes / "may contain" / best-before; it is sent only if ≤2 unsure words remain in it or the person edited it, otherwise photo only (worker accepts empty text). Bulgarian part now also stops at "Неотворен…", "годен за…", "Партида". **Worker code in Cloudflare must be the v0.2.2 version** (photo-only support).
- Text from photos can still contain number misreadings ("5,595" for "5,5%"); the photo goes with it as proof.

## Paid plan (decided by Mo)
€19,99/year, sold by BonbelleGroup. Paid: profiles + personal avoid list, sugar per portion, read aloud, child mode, "how much did I eat" calculator, "Без украси" mode, offline mode, early access to cosmetics, recipes.
Today the supporter flag is local only (`?supporter=1`), so it can be bypassed. `SUPPORT_URL` in `js/config.js` is empty.

## Tests
- `node tests/engine.test.js` (add a folder of Open Food Facts JSON files as an argument for real-product tests).
- Browser tests with Playwright: `tests/nut-e2e.js`, `tests/flow-e2e.js`, `tests/ing2-e2e.js`, `tests/ing-explain-e2e.js` (typed BG + FR label, ingredient and additive pages; screenshots in /tmp/shots). They expect a local server on port 8765 and Tesseract files served locally (see the `route` block in each file). Real label photos in `tests/photos/`.

## Waiting on Mo / to check on a real phone
- Retest photo reading and the new nutrition step on the phone.
- Barcode camera: is 2× zoom right, or should it be 1.5×? Do autofocus and the torch work?

## Next steps (not started)
1. Payments: Stripe Payment Link from BonbelleGroup into `SUPPORT_URL`, then a server-side check of supporters.
2. Explain the rest of the library (by frequency) and add kid-mode lines for ingredients.
3. Offline cache, cosmetics, recipes, "Без украси" mode (one sourced fact per additive).
4. WhatsApp link previews per product (needs a server).
5. Trademark check for the name "Kakvo" (possible confusion with "Kakao").
