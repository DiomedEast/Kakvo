const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) { console.log('MISSING', r.request().url()); return r.fulfill({ status: 404, body: '' }); }
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await p.goto('http://localhost:8765/#/photo?m=nut'); await p.waitForSelector('#file');
  await p.screenshot({ path: '/tmp/nut-photo.png' });
  await p.setInputFiles('#file', 'tests/photos/nasladki-nutrition-5-languages.jpg'); await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
  const r = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const X = v => r.x + v / 1080 * r.w, Y = v => r.y + v / 1920 * r.h;
  await p.mouse.move(X(262), Y(690)); await p.mouse.down(); await p.mouse.move(X(787), Y(1330), { steps: 6 }); await p.mouse.up();
  await p.click('#readbox'); await p.waitForSelector('#nutgo', { timeout: 200000 });
  console.log('FIELDS:', await p.$$eval('.wrap input', e => e.map(i => i.id + '=' + i.value).join(' ')));
  console.log('UNSURE:', await p.$$eval('label', e => e.filter(l => /провери/.test(l.textContent)).map(l => l.textContent).join(' | ')));
  console.log('CHECK:', await p.textContent('#echeck')); console.log(await p.evaluate(() => window.KAKVO_LAST_OCR.join('\n')));
  await b.close(); return;
  await p.screenshot({ path: '/tmp/shots/nasladki-confirm.png', fullPage: true });
  for (const [k, v] of [['sat', '29'], ['carbs', '21,2']]) await p.fill('#f-' + k, v);
  console.log('CHECK2:', await p.textContent('#echeck'));
  await p.click('#nutgo'); await p.waitForSelector('.lead');
  console.log('URL:', p.url(), 'LEAD:', await p.textContent('.lead'));
  await p.screenshot({ path: '/tmp/nut-result.png', fullPage: true });
  // English typed + garbage guard
  await p.evaluate(() => sessionStorage.setItem('kakvo_text', JSON.stringify({ text: 'Ingredients: wheat flour, sugar, palm oil, emulsifier: lecithins (soya), raising agent: sodium carbonates. May contain traces of milk.', name: '' })));
  await p.goto('http://localhost:8765/#/t'); await p.waitForSelector('.lead'); console.log('EN LEAD:', await p.textContent('.lead'));
  await p.evaluate(() => sessionStorage.setItem('kakvo_text', JSON.stringify({ text: 'Kakaotasha, zosket, totefeteg, wapyuezaai, sbvsaet', name: '' })));
  await p.goto('http://localhost:8765/#/'); await p.goto('http://localhost:8765/#/t'); await p.waitForSelector('.lead'); console.log('GARBAGE LEAD:', await p.textContent('.lead'));
  console.log('ERRORS:', errs); await b.close();
})();
