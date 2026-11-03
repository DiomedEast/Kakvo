// Real label photo (Lidl Sondey cocoa biscuits) through the photo flow: frame the Bulgarian text, read it, explain it.
// Needs Tesseract files in /tmp/pk (see STATUS.md) and a local server on port 8765.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
fs.mkdirSync('/tmp/shots', { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await p.goto('http://localhost:8765/#/photo'); await p.waitForSelector('#file');
  await p.setInputFiles('#file', 'tests/photos/sondey-biscuits-ingredients.jpg'); await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
  const d = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const X = v => d.x + v / 1500 * d.w, Y = v => d.y + v / 2000 * d.h;
  await p.mouse.move(X(80), Y(655)); await p.mouse.down(); await p.mouse.move(X(1185), Y(1180), { steps: 6 }); await p.mouse.up();
  await p.click('#readbox');
  await p.waitForSelector('#edit', { timeout: 280000 });
  console.log('READ:', await p.$eval('#edit', e => e.value));
  console.log('FIX CHIPS:', await p.$$eval('[data-fix]', e => e.map(x => x.textContent)));
  for (const c of await p.$$('[data-fix]')) await c.click();
  await p.click('#explain');
  const skip = await p.waitForSelector('a[href="#/t"], #skipnut, a:has-text("Пропусни")', { timeout: 20000 }).catch(() => null);
  if (skip) await skip.click();
  await p.waitForSelector('.addrow', { timeout: 20000 });
  console.log('ROWS:', await p.$$eval('.addrow', e => e.map(x => x.innerText.replace(/\s+/g, ' ').trim())));
  const sec = await (await p.$('h2:has-text("съставка по съставка")')).evaluateHandle(e => e.parentElement);
  await sec.asElement().screenshot({ path: '/tmp/shots/sondey-list.png' });
  await p.click('a[href^="#/i/egg"]'); await p.waitForSelector('h1'); await p.screenshot({ path: '/tmp/shots/sondey-egg.png', fullPage: true });
  console.log('ERRORS:', errs); await b.close();
})();
