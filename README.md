# Kakvo

Сканирай баркод и виж с прости думи какво има в храната: захар в бучки, добавки и официални предупреждения.
A free web app (PWA) for Bulgaria. Plain HTML, CSS and JavaScript, no build step.

## What works in v0.1
- **Barcode scan** with the phone camera (built-in reader on Android Chrome, bundled ZXing reader on iPhone), or type the barcode.
- **Product lookup** from Open Food Facts, explained with the Kakvo ingredient library (`data/library.json`).
- **Plain summary**, sugar/saturated fat/salt levels (UK front-of-pack criteria), sugar cubes, ingredient groups, every additive explained, official warnings with links.
- **Not in the database?** Photograph the ingredients (blur check, text reading with unsure words marked and fix suggestions) or type them in.
- **History** on the phone (last 20 free), **sharing** (link, or an Instagram Story image), **support page** (€19.99 / year).
- **Supporter features** (child mode, read aloud, per-portion sugar, "how much did I eat", profiles with an avoid list, full history) are built and locked behind the supporter flag.

## Not live yet
- **Payments.** Create a Stripe Payment Link for BonbelleGroup and paste it in `js/config.js` → `SUPPORT_URL`.
  Until then the button says payments start soon. The supporter flag is stored on the phone only; a real account/receipt check needs a small server and is the next step.
- **Preview supporter features:** open the app with `?supporter=1` (turn off with `?supporter=0`).
- Offline product cache, cosmetics, recipes, per-product WhatsApp preview images (needs a small server).

## Run locally
```
python3 -m http.server 8000
```
Open http://localhost:8000. The camera needs HTTPS or localhost.

## Tests
```
node tests/engine.test.js
```

## Publish (GitHub Pages)
Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`. The site appears at `https://diomedeast.github.io/kakvo/`.

## Data and licences
- `data/library.json` is derived from the **Open Food Facts** database (products sold in Bulgaria), © Open Food Facts contributors, **ODbL 1.0**. Changes to that data must stay under ODbL. Product data is fetched live from the Open Food Facts API.
- `vendor/zxing-browser.min.js`: ZXing for the browser, MIT (see `vendor/zxing-browser.LICENSE`).
- Text reading: Tesseract.js 7.0.0 (Apache-2.0), loaded from jsDelivr only when a photo is taken.
- Fonts: Geologica and Onest from Google Fonts (SIL Open Font License).
- Warnings in the app cite their sources: EU Regulations 1333/2008, 1169/2011, 2022/63, 2019/649; EFSA; WHO.

Kakvo explains, it does not give medical advice.
