# Kakvo — project status (handoff note)

Last updated: 3 November 2026, version 0.1.5. Live at https://diomedeast.github.io/Kakvo/ (GitHub Pages, branch `main`, root).

## What Kakvo is
A free web app (PWA) for Bulgaria that explains what is in a food product in plain Bulgarian. Owner: Mo, sold by BonbelleGroup.
- No overall score. Only official sources (EU regulations, EFSA, WHO/IARC, UK FSA traffic-light criteria).
- Sugar shown as sugar cubes (1 cube ≈ 4 g). Aimed at parents. Positioned as different from Yuka (not available in Bulgaria).
- Look: "Fresh market v2" — green #246B2A, fonts Geologica (headings) and Onest (text), 3D sugar cubes.

## How it works
- Static site, no build step: `index.html`, `css/app.css`, `js/config.js`, `js/engine.js` (logic, also runs in node), `js/app.js` (views, hash routes), `data/library.json` (241 additives, 504 ingredients, from Mo's spreadsheet; ODbL), `sw.js` (bump `CACHE` on every release), `manifest.webmanifest`.
- Barcode: native BarcodeDetector, else bundled `vendor/zxing-browser.min.js`. Camera asks for 1920×1080, continuous focus, 2× zoom, torch button. Product data from Open Food Facts API v2.
- Photo flow: ingredients photo → auto-rotate if sideways → user frames the Bulgarian text → Tesseract.js 7 (`bul`, page mode 6) → keep only the Bulgarian part (`extractBulgarian`) → user checks text → **asks for the nutrition-table photo (or skip)** → frame the numbers → Tesseract `eng` → `parseNutrition` (EU row order Annex XV, portion-column cross-check, energy check Annex XIV) → user confirms numbers (unsure ones in orange) → one combined result.
- English ingredient lists are recognised; "read in English" fallback if no "Съставки" is found.
- If too little is recognised, the result says "Не успяхме да разчетем…" instead of a false all-clear.

## Paid plan (decided by Mo)
€19,99/year, sold by BonbelleGroup. Paid: profiles + personal avoid list, sugar per portion, read aloud, child mode, "how much did I eat" calculator, "Без украси" mode, offline mode, early access to cosmetics, recipes.
Today the supporter flag is local only (`?supporter=1`), so it can be bypassed. `SUPPORT_URL` in `js/config.js` is empty.

## Tests
- `node tests/engine.test.js` (add a folder of Open Food Facts JSON files as an argument for real-product tests).
- Browser tests with Playwright: `tests/nut-e2e.js`, `tests/flow-e2e.js`, `tests/ing2-e2e.js`. They expect a local server on port 8765 and Tesseract files served locally (see the `route` block in each file). Real label photos in `tests/photos/`.

## Waiting on Mo / to check on a real phone
- Retest photo reading and the new nutrition step on the phone.
- Barcode camera: is 2× zoom right, or should it be 1.5×? Do autofocus and the torch work?

## Next steps (not started)
1. Payments: Stripe Payment Link from BonbelleGroup into `SUPPORT_URL`, then a server-side check of supporters.
2. Offline cache, cosmetics, recipes, "Без украси" mode (one sourced fact per additive).
3. WhatsApp link previews per product (needs a server).
4. Trademark check for the name "Kakvo" (possible confusion with "Kakao").
