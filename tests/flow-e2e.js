const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://cdn.jsdelivr.net/**', r => {
    const name = path.basename(new URL(r.request().url()).pathname);
    const f = ['/tmp/pk/t/package/dist/' + name, '/tmp/pk/core/package/' + name, '/tmp/pk/' + name].find(c => fs.existsSync(c));
    if (!f) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const frame = async (x0, y0, x1, y1, W, H) => {
    await p.waitForSelector('#cropview'); await p.waitForTimeout(300);
    const d = await p.$eval('#cropview', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await p.mouse.move(d.x + x0 / W * d.w, d.y + y0 / H * d.h); await p.mouse.down(); await p.mouse.move(d.x + x1 / W * d.w, d.y + y1 / H * d.h, { steps: 6 }); await p.mouse.up();
    await p.click('#readbox');
  };
  await p.goto('http://localhost:8765/#/photo'); await p.waitForSelector('#file');
  await p.setInputFiles('#file', 'tests/photos/chocolate-ingredients-sideways.jpg'); await frame(225, 872, 1990, 980, 2000, 1500);
  await p.waitForSelector('#edit', { timeout: 280000 }); await p.click('#explain');
  await p.waitForSelector('a[href="#/photo?m=nut&pair=t"]'); console.log('ASK SCREEN:', await p.textContent('h1'));
  await p.screenshot({ path: '/tmp/flow-ask.png' });
  await p.click('a[href="#/photo?m=nut&pair=t"]'); await p.waitForSelector('#file');
  await p.setInputFiles('#file', 'tests/photos/chocolate-nutrition-table.jpg'); await frame(1080, 995, 1370, 1295, 1500, 2000);
  await p.waitForSelector('#nutgo', { timeout: 280000 }); await p.fill('#f-sat', '29'); await p.click('#nutgo');
  await p.waitForSelector('.lead'); console.log('URL:', p.url()); console.log('LEAD:', await p.textContent('.lead'));
  console.log('TILES:', await p.$$eval('.tile .v', e => e.map(x => x.textContent)));
  await p.screenshot({ path: '/tmp/flow-result.png', fullPage: true });
  console.log('ERRORS:', errs); await b.close();
})();
