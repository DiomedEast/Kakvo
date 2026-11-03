// A barcode whose Open Food Facts entry has a broken ingredient list (Sondey biscuits: Italian OCR garbage, no Bulgarian text).
// Expect: we ask for a photo first; the photo result keeps the name and database nutrition and is remembered for the barcode.
// Needs a local server on port 8765 and Tesseract files in /tmp/pk (see STATUS.md).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
fs.mkdirSync('/tmp/shots', { recursive: true });
const product = { code: '4056489999990', product_name: 'Sondey Biscotti crema al cioccolato', brands: 'Sondey', quantity: '150 g',
  ingredients: [
    { id: 'it:sondey-biscotti-crema-al-cioccolato-delcerri-al-casas-no-40-ripiene', text: 'Sondey Biscotti crema al cioccolato Delcerri al casas no 40% ripiene di c YS Cuccolato fredi e Praments wall pains 2004) as input pe di gheal parts clate the ten p satte utero' },
    { id: 'it:pasta-di-are', text: 'Pasta di are" be dr taran etionare leche a mom.canidhi mollel conili dcammed OM "Coat Ra Pob conteneve tracce di attra frutta a gusto' },
    { id: 'it:arachidie', text: 'Arachidie Сендра Cense to ego esce a estiu de YER vary in shoes chiusa esimaze atta 5g ba coral proferilmente atro e contero vedere lato inferiore 150g' },
    { id: 'it:xostenereta', text: 'Xostenereta and Alliance.che with a promovere un agrishora pla snowble sul plany ambientain sociale www.ag' }],
  additives_tags: ['en:e322', 'en:e500', 'en:e503'], allergens_tags: ['en:eggs', 'en:gluten', 'en:milk', 'en:nuts', 'en:soybeans'], traces_tags: ['en:mustard', 'en:nuts', 'en:peanuts'],
  nutriments: { 'energy-kcal_100g': 517, fat_100g: 25, 'saturated-fat_100g': 9.4, carbohydrates_100g: 65, sugars_100g: 34, proteins_100g: 6.4, salt_100g: 0.5 } };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('https://world.openfoodfacts.org/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 1, product }) }));
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  // 1. Scan: no Bulgarian list in the database -> we ask for a photo.
  await p.goto('http://localhost:8765/#/p/' + product.code); await p.waitForSelector('a[data-pf][href="#/photo"]');
  console.log('ASK SCREEN:', await p.textContent('.wrap h1'));
  await p.screenshot({ path: '/tmp/shots/ask-photo.png', fullPage: true });
  // 2. "Only the database data" still works and never shows garbage.
  await p.click('a[href$="?db=1"]'); await p.waitForSelector('#photofor');
  console.log('DB ONLY LEAD:', await p.textContent('.lead'), '| garbage rows:', await p.$$eval('.addrow', e => e.length));
  await p.goBack(); await p.waitForSelector('a[data-pf][href="#/photo"]');
  // 3. Photo of the label.
  await p.click('a[data-pf][href="#/photo"]'); await p.waitForSelector('#file');
  await p.setInputFiles('#file', 'tests/photos/sondey-biscuits-ingredients.jpg'); await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
  const d = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const X = v => d.x + v / 1500 * d.w, Y = v => d.y + v / 2000 * d.h;
  await p.mouse.move(X(80), Y(655)); await p.mouse.down(); await p.mouse.move(X(1185), Y(1180), { steps: 6 }); await p.mouse.up();
  await p.click('#readbox'); await p.waitForSelector('#edit', { timeout: 280000 }); await p.click('#explain');
  await p.waitForSelector('.addrow'); console.log('AFTER PHOTO URL:', p.url(), '| TITLE:', await p.textContent('h1'));
  console.log('LEAD:', await p.textContent('.lead')); console.log('ROWS:', await p.$$eval('.addrow b', e => e.length), '| note:', await p.$eval('.note', e => e.textContent.trim()));
  await p.screenshot({ path: '/tmp/shots/after-photo.png' });
  // 4. Scan the same barcode again: explained straight away from the saved photo.
  await p.goto('http://localhost:8765/#/'); await p.waitForTimeout(300);
  await p.goto('http://localhost:8765/#/p/' + product.code); await p.waitForSelector('.addrow');
  console.log('SECOND SCAN ROWS:', await p.$$eval('.addrow b', e => e.length));
  console.log('ERRORS:', errs); await b.close();
})();
