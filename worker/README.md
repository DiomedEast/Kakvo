# Sharing with Open Food Facts (Cloudflare Worker)

When a scanned product has no Bulgarian ingredient list, Kakvo asks for a photo. With this worker running,
the framed photo and the checked text are also sent to Open Food Facts (if the person keeps the
"Сподели с Open Food Facts" box ticked), so the next person who scans the product gets the explanation at once.

```
phone (Kakvo) ──photo + text──▶ this worker (holds the password) ──▶ Open Food Facts
```

What it does, and never does:
- Adds the photo as the Bulgarian ingredients photo (or as an extra photo if one already exists).
- Writes the Bulgarian ingredient text **only if the product has none**. It never replaces existing data.
- Only existing products, only Bulgarian text, only JPEG under 3 MB, only from the Kakvo website.
- Every edit carries `app_name=Kakvo` and an anonymous per-phone ID (`app_uuid`), as Open Food Facts asks,
  so their moderators can block one bad user without blocking the whole app.
- No names, e-mails or locations are sent.

Until `CONTRIBUTE_URL` is set in `js/config.js`, the checkbox is hidden and nothing is sent.

## Setup (once, about 20 minutes)

1. **Open Food Facts app account.** Create an account at https://world.openfoodfacts.org for the app, not a
   personal one. Their wiki asks to name it like `YourApp_app`, e.g. `kakvo_app`. Then fill in the API usage
   form linked from https://openfoodfacts.github.io/openfoodfacts-server/api/ so they know who Kakvo is.
   For the test server (https://world.openfoodfacts.net) you need a second account created there.
2. **Cloudflare account** (free plan is enough to start): https://dash.cloudflare.com/sign-up
3. **Deploy** (needs Node.js on the computer):
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put OFF_USER        # the app account user name (not the e-mail)
   npx wrangler secret put OFF_PASSWORD
   npx wrangler deploy
   ```
   Wrangler prints the address, like `https://kakvo-contribute.<your-name>.workers.dev`.
4. **Connect the app:** paste that address into `js/config.js` → `CONTRIBUTE_URL`, bump `CACHE` in `sw.js`, push.
5. **Go live:** `wrangler.toml` starts on the Open Food Facts **test** server. It only accepts barcodes that
   exist on the test server, so most real scans answer "product not found" there. When one test works,
   set `OFF_BASE = "https://world.openfoodfacts.org"`, put the live account's user name and password in the
   secrets, and run `npx wrangler deploy` again.

## Tests (no real Open Food Facts needed)
- `node tests/worker.test.mjs` — the worker against a fake Open Food Facts.
- `node tests/bad-off-e2e.js` — the whole app flow: scan → photo → share → second scan.

## Limits
Cloudflare's free plan: 100,000 requests a day and 10 ms CPU per request. The photo is passed through
without decoding, so each request uses very little CPU. The per-phone limit (10 an hour) is best-effort.
