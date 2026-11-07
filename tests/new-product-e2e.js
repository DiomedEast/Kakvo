// A barcode Open Food Facts does not have: photo of the ingredients and of the table -> explanation,
// remembered on this phone, and "Добави продукта" creates it on (a fake) Open Food Facts with three photos.
// Needs a local server on port 8765 and Tesseract files in /tmp/pk (see STATUS.md).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
fs.mkdirSync('/tmp/shots', { recursive: true });
const code = '3800000000123';
(async () => {
  const { fakeOff, serveWorker } = await import('./worker-local.mjs');
  const offProducts = {}; const off = await fakeOff(8790, offProducts);
  const wk = await serveWorker(8791, { OFF_BASE: 'http://localhost:8790', OFF_USER: 'kakvo-app', OFF_PASSWORD: 'secret', ALLOWED_ORIGINS: 'http://localhost:8765', APP_VERSION: 'test' });
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('http://localhost:8765/js/config.js', async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + "\nwindow.KAKVO_CONFIG.CONTRIBUTE_URL = 'http://localhost:8791/';" }); });
  await p.route('https://world.openfoodfacts.org/api/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ status: 0 }) }));
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const frame = async (img, W, H, x0, y0, x1, y1) => {
    await p.setInputFiles('#file', img); await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
    const d = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await p.mouse.move(d.x + x0 / W * d.w, d.y + y0 / H * d.h); await p.mouse.down(); await p.mouse.move(d.x + x1 / W * d.w, d.y + y1 / H * d.h, { steps: 6 }); await p.mouse.up();
    await p.click('#readbox');
  };
  // 0. A barcode typed by hand: no "add" offer (camera-read barcodes only).
  await p.goto('http://localhost:8765/#/p/' + code); await p.waitForSelector('a[data-pf]');
  console.log('TYPED BARCODE NOTE:', (await p.textContent('.note')).trim().slice(0, 60));
  // 1. Scanned with the camera (the scanner sets this), not on Open Food Facts.
  await p.evaluate(c => sessionStorage.setItem('kakvo_scanned', JSON.stringify(c)), code);
  await p.goto('http://localhost:8765/#/'); await p.goto('http://localhost:8765/#/p/' + code); await p.waitForSelector('a[data-pf]');
  console.log('NOT FOUND:', await p.textContent('h1'), '|', (await p.textContent('.note')).trim().slice(0, 70));
  await p.click('a[data-pf][href="#/photo"]'); await p.waitForSelector('#file');
  await frame('tests/photos/sondey-biscuits-ingredients.jpg', 1500, 2000, 80, 655, 1185, 1180);
  await p.waitForSelector('#edit', { timeout: 280000 });
  console.log('SHARE CHECKBOX SHOWN:', !!(await p.$('#shareoff')));
  await p.click('#explain'); await p.waitForSelector('a[href="#/photo?m=nut&pair=t"]');
  await p.click('a[href="#/photo?m=nut&pair=t"]'); await p.waitForSelector('#file');
  await frame('tests/photos/nasladki-nutrition-5-languages.jpg', 1080, 1920, 262, 690, 787, 1330);
  await p.waitForSelector('#nutgo', { timeout: 280000 }); await p.click('#nutgo');
  await p.waitForSelector('.addrow');
  console.log('AFTER PHOTOS URL:', p.url(), '| META:', await p.textContent('.head'));
  console.log('ROWS:', await p.$$eval('.addrow b', e => e.length), '| ADD CARD:', !!(await p.$('a[href="#/add/' + code + '"]')));
  await p.screenshot({ path: '/tmp/shots/new-result.png', fullPage: true });
  // 2. Same phone, same barcode again: explained straight away.
  await p.goto('http://localhost:8765/#/'); await p.goto('http://localhost:8765/#/p/' + code); await p.waitForSelector('.addrow');
  console.log('SECOND SCAN ROWS:', await p.$$eval('.addrow b', e => e.length));
  // 3. Add it to Open Food Facts.
  await p.click('a[href="#/add/' + code + '"]'); await p.waitForSelector('#pname');
  console.log('SEND DISABLED AT START:', await p.$eval('#send', e => e.disabled));
  await p.fill('#pname', 'Насладки с мармалад от смокини');
  await p.setInputFiles('#frontin', 'tests/photos/nasladki-nutrition-photo2.jpg'); await p.waitForSelector('#frontprev img');
  await p.check('#agree'); console.log('SEND DISABLED AFTER:', await p.$eval('#send', e => e.disabled));
  await p.screenshot({ path: '/tmp/shots/add-screen.png', fullPage: true });
  await p.click('#send'); await p.waitForSelector('.toast', { timeout: 20000 }); console.log('TOAST:', await p.textContent('.toast'));
  const w = off.log.find(x => x.path && x.path.includes('jqm2'));
  console.log('OFF NEW PRODUCT:', w && w.fields.product_name_bg, '| kcal', w && w.fields['nutriment_energy-kcal'], '| text:', w && (w.fields.ingredients_text_bg || '(photo only)').slice(0, 50));
  console.log('OFF PHOTOS:', off.log.filter(x => x.path && x.path.includes('image_upload')).map(x => x.fields.imagefield).join(','));
  await p.waitForSelector('.addrow'); console.log('AFTER SEND:', await p.textContent('.flag h3').catch(() => '-'));
  console.log('ERRORS:', errs); await b.close(); off.server.close(); wk.close();
})();
