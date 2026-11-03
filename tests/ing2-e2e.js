const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const mode = process.argv[2] || 'box';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await p.goto('http://localhost:8765/#/photo'); await p.waitForSelector('#file');
  await p.setInputFiles('#file', 'tests/photos/chocolate-ingredients-sideways.jpg'); await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
  const dims = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, cw: c.width, ch: c.height }; });
  console.log('crop canvas', dims.cw, 'x', dims.ch, dims.cw > dims.ch ? '(turned upright)' : '(still sideways)');
  await p.screenshot({ path: '/tmp/ing2-crop.png' });
  if (mode === 'box') {
    const X = v => dims.x + v / 2000 * dims.w, Y = v => dims.y + v / 1500 * dims.h;
    await p.mouse.move(X(225), Y(872)); await p.mouse.down(); await p.mouse.move(X(1990), Y(980), { steps: 6 }); await p.mouse.up();
    await p.click('#readbox');
  } else await p.click('#readall');
  await p.waitForSelector('#edit', { timeout: 280000 });
  console.log('EDIT:', await p.$eval('#edit', e => e.value));
  console.log('CHIPS:', await p.$$eval('[data-fix]', e => e.map(x => x.textContent)));
  for (const c of await p.$$('[data-fix]')) await c.click();
  await p.click('#explain'); await p.waitForSelector('.lead');
  console.log('LEAD:', await p.textContent('.lead'));
  await p.screenshot({ path: '/tmp/ing2-result.png', fullPage: true });
  console.log('ERRORS:', errs); await b.close();
})();
